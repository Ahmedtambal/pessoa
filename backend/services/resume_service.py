import json
from openai import OpenAI
from fastapi import UploadFile
from typing import List
from api.models import ResumeAnalysisRequest
from config.settings import settings
from services.utils.file_extractor import extract_text_from_file


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
You are an expert Senior Technical Recruiter. Your task is to analyse a Job Description (JD) and a set of candidate CVs. Produce a clear, structured report in British English (UK).

CRITICAL FORMATTING RULES:
1. No bolding or emphasis characters (no **, __, etc.). Plain text only.
2. Produce exactly four sections with the headings shown below (in this order).
3. All tables must be valid Markdown tables.
4. Do not include any text before the first heading.

PART 1: INDIVIDUAL ANALYSIS
- Create a Markdown table comparing each CV against the JD.
- Table columns: `Applicant`, `Overall Score (/100)`, `Key Strengths`, `Potential Gaps`.

PART 2: COMPARATIVE ANALYSIS
- Create a Markdown table comparing the top applicants on key criteria.
- Table columns: `Criterion`, `[Applicant 1 Name]`, `[Applicant 2 Name]`, `[etc...]`.

PART 3: BRIEF CONCLUSIONS
- Provide a short (1-3 sentences) neutral summary of the comparison results and any important context or tie-breakers used.

FINAL RECOMMENDATION
- This must be a separate section with the heading exactly: `FINAL RECOMMENDATION` (all caps).
- Present the recommendation as a concise, user-friendly block containing the following sub-items (use plain text lines or a short bullet list):
  - Best fit: the candidate's full name (plain text).
  - Why: 2-3 specific points summarising the decisive strengths that make them the best fit.
  - Main risks or gaps: 1-2 short notes about potential concerns and how to mitigate them.
  - Suggested next steps: 2 concrete, actionable recommendations (e.g., specific interview focus, a technical test, or a reference check).

Keep the tone helpful and practical; the recommendation should be easy for a hiring manager to act on.

Now, perform the full analysis on the following Job Description and Candidate CVs.
"""

    def extract_profile_from_cv(self, file: UploadFile) -> dict:
        raw_text = extract_text_from_file(file)
        if not raw_text:
            return {}

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
        return extracted_data

    def compare_cvs_to_jd(self, jd: str, cv_files: List[UploadFile]) -> str:
        cv_texts = {}
        for cv_file in cv_files:
            if cv_file.filename:
                cv_texts[cv_file.filename] = extract_text_from_file(cv_file)

        cv_data_str = "\n".join([
            f"### CV: {name}\n---\n{text}\n---\n" for name, text in cv_texts.items()
        ])
        user_prompt = f"## Job Description:\n{jd}\n\n## Candidate CVs:\n{cv_data_str}"

        completion = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": self.cv_comparison_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        return completion.choices[0].message.content or "Error: Could not generate comparison."


resume_service = ResumeService()