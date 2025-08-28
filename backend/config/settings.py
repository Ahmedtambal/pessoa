from pydantic_settings import BaseSettings
import os # <-- Import the 'os' module

# Get the directory of the current file (settings.py)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class Settings(BaseSettings):
    OPENAI_API_KEY: str
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str

    class Config:
        # THE FIX: Provide an explicit, absolute path to the correct .env file
        env_file = os.path.join(BASE_DIR, '.env')
        extra = 'ignore'

settings = Settings()