from openai import OpenAI
from api.models import JobDescriptionRequest
from config.settings import settings
from services.audit_service import log_audit

class JDService:
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.system_prompt = """
You are "PessoaAI", an expert HR copywriter and recruitment specialist. Your task is to transform raw user input into a complete, professional, and compelling job description written in **British English (UK)**.

**Your Guiding Principles:**
1.  **Enrich and Expand:** Take the user's basic points and expand on them using professional industry knowledge. If a user writes "handle clients," you must elaborate with specifics like "Serve as the primary point of contact for our key accounts, building and maintaining strong, long-lasting customer relationships."
2.  **Professional UK English Tone:** Write in a clear, engaging, and professional voice using standard British English spelling and grammar (e.g., "optimise" not "optimize", "behaviour" not "behavior"). The language must be inclusive and free from bias.
3.  **Correct & Enhance:** Fix all grammatical errors and rephrase weak language into strong, action-oriented statements.

**CRITICAL & STRICT FORMATTING REQUIREMENTS:**
1.  **Markdown Headings Only:** You MUST structure your entire response in Markdown, using `##` for all main headings.
2.  **No Text Before First Heading:** Your response must begin IMMEDIATELY with the first `##` heading.
3.  **No Bold Text:** You MUST NOT use bold formatting.
4.  **No Hyphenated Words in Headings:** All headings must not contain hyphenated words.
5.  **No "About Us" Section:** You MUST NOT include an "About Us" section.
6.  **Follow the Example:** The structure of your output must exactly match the example provided below.

---
**EXAMPLE OF PERFECT OUTPUT STRUCTURE:**

## Job Title From User
Location: [Location] | Type: [Job Type]

## Job Summary
[Your generated summary here...]

## Key Responsibilities
*   [Responsibility 1]
*   [Responsibility 2]

## Required Skills and Qualifications
*   [Qualification 1]
*   [Qualification 2]
---

**User Input:**
Now, generate the job description based on the user's data below.
"""

    def generate_jd(self, request: JobDescriptionRequest) -> str:
        user_input = f"""
        - Job Title: {request.job_title}
        - Job Type: {request.job_type}
        - Location: {request.location}
        - Responsibilities: {request.responsibilities}
        - Requirements: {request.requirements}
        - Skills: {request.skills}
        """
        try:
            completion = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": user_input}
                ]
            )
        except Exception as e:
            print('[jd_service] OpenAI generate_jd error:', repr(e))
            raise Exception('AI job description generation failed: ' + str(e))

        # Ensure content is not None before returning
        try:
            output = completion.choices[0].message.content or ""
            try:
                log_audit(
                    user_id=None,
                    action='generate_jd',
                    model='gpt-4o-mini',
                    prompt=(user_input[:2000] if user_input else None),
                    output=(output[:8000] if output else None),
                    details={"job_title": request.job_title},
                )
            except Exception as e:
                print(f"[jd_service] audit log failed: {e}")
            return output
        except Exception as e:
            print('[jd_service] error reading AI response:', repr(e))
            raise Exception('AI returned unexpected response for job description')

jd_service = JDService()


def generate_jd_from_texts(texts, options: dict | None = None) -> str:
    """Compatibility wrapper used by background tasks.

    Accepts either a dict-like payload (matching JobDescriptionRequest), a JSON
    string, or plain text. Builds a JobDescriptionRequest and calls the
    JDService instance to generate the JD.
    """
    # Prefer dict-like inputs
    if isinstance(texts, dict):
        try:
            req = JobDescriptionRequest(**texts)
        except Exception:
            # Fallback to placing the dict's string repr into responsibilities
            req = JobDescriptionRequest(
                job_title=str(texts.get('job_title', 'Generated Job')),
                job_type=str(texts.get('job_type', 'Full Time')),
                location=str(texts.get('location', 'Remote')),
                responsibilities=str(texts.get('responsibilities', '')),
                requirements=str(texts.get('requirements', '')),
                skills=str(texts.get('skills', '')),
            )
        return jd_service.generate_jd(req)

    # Try to parse JSON strings
    if isinstance(texts, str):
        import json

        try:
            parsed = json.loads(texts)
            if isinstance(parsed, dict):
                return generate_jd_from_texts(parsed, options=options)
        except Exception:
            # not JSON — fallthrough to treat as free text
            pass

        # Freeform text: put into responsibilities and use sensible defaults
        req = JobDescriptionRequest(
            job_title=options.get('job_title', 'Generated Job') if options else 'Generated Job',
            job_type=options.get('job_type', 'Full Time') if options else 'Full Time',
            location=options.get('location', 'Remote') if options else 'Remote',
            responsibilities=texts,
            requirements=options.get('requirements', '') if options else '',
            skills=options.get('skills', '') if options else '',
        )
        return jd_service.generate_jd(req)

    # Unknown type: coerce to string
    return generate_jd_from_texts(str(texts), options=options)