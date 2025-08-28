import json
from openai import OpenAI
from fastapi import UploadFile, HTTPException
from typing import List
from api.models import ResumeAnalysisRequest
from config.settings import settings
from services.utils.file_extractor import extract_text_from_file
from services.audit_service import log_audit

class ResumeService:
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)

        # --- THIS PROMPT IS UPDATED WITH THE FIX ---
        self.profile_extraction_prompt = """
You are an elite data extraction AI. Your task is to analyse the raw text of a resume/CV and extract specific information. You MUST respond ONLY with a single, valid JSON object. Do not include any text, explanations, or Markdown formatting before or after the JSON object.

CRITICAL INSTRUCTIONS:
1. The language of the CV is unknown. Analyse and extract the details regardless of language.
2. The output MUST be a JSON object with the specified keys.
3. For summary fields, provide a concise, one-paragraph summary.
4. If you cannot find a specific piece of information, the value for that key MUST be null.
5. This is a JSON request; ensure your entire output is a single, valid JSON structure.

Example JSON Output:
```json
{
  "name": "John Doe",
  "job_title": "Senior Data Analyst",
  "email": "john.doe@example.com",
  "phone_number": "+44 7123 456789",
  "location": "London, UK",
  "work_experience_summary": "An accomplished Senior Data Analyst with over 8 years of experience in data-driven decision making, ETL processes, and creating insightful visualisations using Tableau and Python.",
  "skills_summary": "Key skills include Python (Pandas, NumPy), SQL, Microsoft Excel, Power BI, and statistical analysis. Proven ability to communicate complex findings to stakeholders.",
  "education_summary": "Holds a Master's degree in Data Science from the University of Edinburgh and a Bachelor's degree in Economics from the University of Manchester."
}
```

Now, process the following CV text and provide only the JSON object as a response.
"""

        self.cv_comparison_prompt = """
You are an expert Senior Technical Recruiter. Your task is to analyse a Job Description (JD) and a set of candidate CVs. You must provide a detailed comparison in three distinct parts, written in **British English (UK)**.

**CRITICAL & STRICT FORMATTING REQUIREMENTS:**
1.  **NO BOLD TEXT OR EMPHASIS:** Your entire response must be in plain text. You MUST NOT use asterisks (`**`) or any other characters for bolding or emphasis.
2.  **USE EXACT HEADINGS:** You MUST produce exactly three sections, and their headings MUST be exactly as follows, including the '##' and capitalization: `## PART 1: INDIVIDUAL ANALYSIS`, `## PART 2: COMPARATIVE ANALYSIS`, `## FINAL RECOMMENDATION`.
3.  **ALL TABLES MUST BE MARKDOWN:** All content under PART 1 and PART 2 must be valid Markdown tables.
4.  **NO TEXT BEFORE FIRST HEADING:** Do not include any introductory text or summary before the first `##` heading. Your response must be parsable by a script that splits the text by these exact headings.

**PART 1: INDIVIDUAL ANALYSIS**
- Create a Markdown table comparing each CV against the JD.
- Table columns MUST be: `Applicant`, `Overall Score (/100)`, `Key Strengths`, `Potential Gaps`.

**PART 2: COMPARATIVE ANALYSIS**
- Create a Markdown table comparing the top applicants against each other on key criteria.
- Table columns MUST be: `Criterion`, `[Applicant 1 Name]`, `[Applicant 2 Name]`, `[etc...]`.

**FINAL RECOMMENDATION**
- Write a concluding paragraph justifying your choice. State the best fit, why, and any risks.

Now, perform the full analysis on the following Job Description and Candidate CVs.
"""

    def extract_profile_from_cv(self, file: UploadFile | None = None, raw_text: str | None = None) -> dict:
        """Extract structured profile fields from CV text.

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

        try:
            completion = self.client.chat.completions.create(
                model="gpt-4o-mini",
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": self.profile_extraction_prompt},
                    {"role": "user", "content": raw_text},
                ],
            )
            response_content = completion.choices[0].message.content or "{}"
            extracted_data = json.loads(response_content)
            extracted_data["full_extracted_text"] = raw_text
            # Audit log: capture the extraction event (non-blocking)
            try:
                log_audit(
                    user_id=None,
                    action='extract_profile',
                    model='gpt-4o-mini',
                    prompt=(self.profile_extraction_prompt[:1000] if self.profile_extraction_prompt else None),
                    output=(response_content[:4000] if response_content else None),
                    details={"source": (getattr(file, 'filename', None) if file is not None else 'raw_text')},
                )
            except Exception as e:
                print(f"[resume_service] audit log failed: {e}")
            return extracted_data
        except Exception as e:
            print(f"Error in profile extraction: {e}")
            raise HTTPException(status_code=500, detail="AI profile extraction failed.")

    def compare_cvs_to_jd(self, jd: str, cv_files: List[UploadFile]) -> str:
        cv_texts = []
        for cv_file in cv_files:
            filename = cv_file.filename or "unknown"
            raw_text = extract_text_from_file(cv_file)
            # Attempt to extract applicant name from CV text. This uses the same
            # AI extractor but provided with raw_text so we don't re-read the file.
            profile = self.extract_profile_from_cv(raw_text=raw_text)
            name = None
            if isinstance(profile, dict):
                name = profile.get('name') or profile.get('full_name')
            if not name:
                name = filename
            cv_texts.append((name, raw_text))

        cv_data_str = "\n".join([f"### CV: {name}\n---\n{text}\n---\n" for name, text in cv_texts])
        user_prompt = f"## Job Description:\n{jd}\n\n## Candidate CVs:\n{cv_data_str}"
        try:
            completion = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": self.cv_comparison_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
            output = completion.choices[0].message.content or "Error: Could not generate comparison."
            # Audit log for CV comparison
            try:
                log_audit(
                    user_id=None,
                    action='compare_cvs',
                    model='gpt-4o-mini',
                    prompt=(user_prompt[:2000] if user_prompt else None),
                    output=(output[:8000] if output else None),
                    details={"cv_count": len(cv_files)},
                )
            except Exception as e:
                print(f"[resume_service] audit log failed: {e}")
            return output
        except Exception as e:
            print(f"Error in CV comparison: {e}")
            raise HTTPException(status_code=500, detail="AI comparison failed.")

    def compare_texts_to_jd(self, jd: str, cv_texts: List[tuple]) -> str:
        """Accepts a list of tuples (name, raw_text) and performs the same comparison.

        This is useful for background jobs where files have been pre-extracted to text.
        """
        cv_data_str = "\n".join([f"### CV: {name}\n---\n{text}\n---\n" for name, text in cv_texts])
        user_prompt = f"## Job Description:\n{jd}\n\n## Candidate CVs:\n{cv_data_str}"
        try:
            completion = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": self.cv_comparison_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
            output = completion.choices[0].message.content or "Error: Could not generate comparison."
            # Audit
            try:
                log_audit(
                    user_id=None,
                    action='compare_cvs_background',
                    model='gpt-4o-mini',
                    prompt=(user_prompt[:2000] if user_prompt else None),
                    output=(output[:8000] if output else None),
                    details={"cv_count": len(cv_texts)},
                )
            except Exception as e:
                print(f"[resume_service] background audit log failed: {e}")
            return output
        except Exception as e:
            print(f"Error in CV comparison (background): {e}")
            raise HTTPException(status_code=500, detail="AI comparison failed.")

resume_service = ResumeService()


def compare_texts_to_jd(jd: str, cv_texts: list) -> str:
    """Module-level wrapper for background tasks.

    Delegates to the ResumeService instance to keep backward-compatible
    imports for RQ task modules.
    """
    return resume_service.compare_texts_to_jd(jd, cv_texts)