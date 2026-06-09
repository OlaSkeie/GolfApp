from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Leses fra .env (se .env.example). Tom streng = kjør i placeholder-modus.
    gemini_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
