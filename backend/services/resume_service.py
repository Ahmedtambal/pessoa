import json
import asyncio
from openai import OpenAI
from fastapi import UploadFile, HTTPException
from typing import List, Dict, Any
from api.models import ResumeAnalysisRequest
from config.settings import settings
from services.utils.file_extractor import extract_text_from_file
import hashlib
import time
from functools import lru_cache

class ResumeService:
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        # Performance: Simple in-memory cache for AI responses
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.cache_ttl = 3600  # 1 hour cache TTL

    def _get_cache_key(self, prompt: str, content: str) -> str:
        """Generate a cache key from prompt and content."""
        content_hash = hashlib.md5(content.encode('utf-8')).hexdigest()[:16]
        prompt_hash = hashlib.md5(prompt.encode('utf-8')).hexdigest()[:16]
        return f"{prompt_hash}_{content_hash}"

    def _get_cached_response(self, cache_key: str) -> Dict[str, Any] | None:
        """Get cached response if still valid."""
        if cache_key in self.cache:
            cached_item = self.cache[cache_key]
            if time.time() - cached_item['timestamp'] < self.cache_ttl:
                return cached_item['data']
            else:
                # Remove expired cache entry
                del self.cache[cache_key]
        return None

    def _cache_response(self, cache_key: str, data: Dict[str, Any]) -> None:
        """Cache the response with timestamp."""
        self.cache[cache_key] = {
            'data': data,
            'timestamp': time.time()
        }
        # Limit cache size to prevent memory issues
        if len(self.cache) > 100:
            # Remove oldest entries
            oldest_key = min(self.cache.keys(),
                          key=lambda k: self.cache[k]['timestamp'])
            del self.cache[oldest_key]

        # Performance: Optimized concise prompt
        self.profile_extraction_prompt = """Extract information from this CV/resume as JSON. Respond ONLY with valid JSON object.

Required format:
{
  "name": string or null,
  "job_title": string or null,
  "email": string or null,
  "phone_number": string or null,
  "location": string or null,
  "work_experience_summary": string or null,
  "skills_summary": string or null,
  "education_summary": string or null
}

Rules:
- Extract in original language if non-English
- Use null for missing information
- Keep summaries concise (1-2 sentences max)
- Return ONLY the JSON object"""

        # Performance: Optimized concise prompt
        self.cv_comparison_prompt = """Compare CVs to job description. Use British English.

Format requirements:
- Start with ## PART 1: INDIVIDUAL ANALYSIS
- Then ## PART 2: COMPARATIVE ANALYSIS
- End with ## FINAL RECOMMENDATION
- Use Markdown tables only
- No bold text or emphasis

PART 1: Table with columns: Applicant, Overall Score (/100), Key Strengths, Potential Gaps
PART 2: Comparison table with key criteria
FINAL RECOMMENDATION: Justify your choice"""

    def extract_profile_from_cv(self, file: UploadFile | None = None, raw_text: str | None = None) -> dict:
        """Extract structured profile fields from CV text with caching and optimization.

        Accept either an UploadFile or pre-extracted raw_text. Returning a dict with
        keys like 'name', 'email', etc. If extraction fails, this returns an empty dict
        or raises an HTTPException on AI errors.
        """
        if raw_text is None:
            if file is None:
                return {}
            raw_text = extract_text_from_file(file)

        if not raw_text:
            return {}

        # Performance: Check cache first
        cache_key = self._get_cache_key(self.profile_extraction_prompt, raw_text)
        cached_result = self._get_cached_response(cache_key)
        if cached_result:
            return cached_result

        try:
            # Performance: Optimized AI call with shorter timeout and focused model
            completion = self.client.chat.completions.create(
                model="gpt-4o-mini",
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": self.profile_extraction_prompt},
                    {"role": "user", "content": f"CV Text:\n{raw_text[:4000]}..."}  # Limit input size
                ],
                max_tokens=500,  # Limit output size
                temperature=0.1,  # Lower temperature for consistent results
            )
            response_content = completion.choices[0].message.content or "{}"
            extracted_data = json.loads(response_content)
            extracted_data["full_extracted_text"] = raw_text

            # Performance: Cache the successful result
            self._cache_response(cache_key, extracted_data)

            return extracted_data
        except Exception as e:
            print(f"Error in profile extraction: {e}")
            raise HTTPException(status_code=500, detail="AI profile extraction failed.")

    def compare_cvs_to_jd(self, jd: str, cv_files: List[UploadFile]) -> str:
        """Compare CVs to job description with performance optimizations."""
        # Performance: Limit number of CVs to prevent excessive processing
        if len(cv_files) > 5:
            raise HTTPException(status_code=400, detail="Maximum 5 CVs allowed for comparison.")

        cv_texts = []
        for cv_file in cv_files:
            filename = cv_file.filename or "unknown"
            raw_text = extract_text_from_file(cv_file)

            # Performance: Truncate very long CVs to prevent token limits
            if len(raw_text) > 8000:
                raw_text = raw_text[:8000] + "...[truncated]"

            # Attempt to extract applicant name from CV text
            profile = self.extract_profile_from_cv(raw_text=raw_text)
            name = None
            if isinstance(profile, dict):
                name = profile.get('name') or profile.get('full_name')
            if not name:
                name = filename
            cv_texts.append((name, raw_text))

        # Performance: Check cache for similar comparisons
        cv_data_str = "\n".join([f"### CV: {name}\n---\n{text[:2000]}...\n---\n" for name, text in cv_texts])
        user_prompt = f"## Job Description:\n{jd[:2000]}\n\n## Candidate CVs:\n{cv_data_str}"

        cache_key = self._get_cache_key(self.cv_comparison_prompt, user_prompt)
        cached_result = self._get_cached_response(cache_key)
        if cached_result and isinstance(cached_result, str):
            return cached_result

        try:
            # Performance: Optimized AI call
            completion = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": self.cv_comparison_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=1500,  # Reasonable limit for comparison output
                temperature=0.2,  # Slightly higher for creative analysis
            )
            result = completion.choices[0].message.content or "Error: Could not generate comparison."

            # Performance: Cache successful results
            self._cache_response(cache_key, result)

            return result
        except Exception as e:
            print(f"Error in CV comparison: {e}")
            raise HTTPException(status_code=500, detail="AI comparison failed.")

resume_service = ResumeService()