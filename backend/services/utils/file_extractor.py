import io
from fastapi import UploadFile
import docx
from pypdf import PdfReader

def extract_text_from_file(file: UploadFile) -> str:
    """
    Extracts raw text from an uploaded file (PDF or DOCX).
    """
    file_extension = file.filename.split('.')[-1].lower() if file.filename else ''
    content = ""
    file_bytes = file.file.read()
    file.file.seek(0)  # Reset file pointer after reading

    if file_extension == 'pdf':
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            for page in reader.pages:
                content += page.extract_text() or ''
        except Exception:
            # Handle potential pypdf errors with corrupted files
            return ""
    elif file_extension == 'docx':
        try:
            doc = docx.Document(io.BytesIO(file_bytes))
            for para in doc.paragraphs:
                content += para.text + '\n'
        except Exception:
            # Handle potential python-docx errors
            return ""
    else:
        # Fallback for .txt or other readable formats if needed
        try:
            content = file_bytes.decode('utf-8', errors='ignore')
        except Exception:
            return ""
            
    return content