"""Settings, read from the environment (or a local .env file in development)."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"  # development | test | staging | production

    # The API's own connection: role pm_app, which row-level security applies to.
    database_url: str
    # The table owner, for migrations and the command line only. Never used to serve a request.
    migration_database_url: str | None = None

    # Fernet keys for identifiers (tax IDs) and 2FA secrets; the first one encrypts.
    field_encryption_keys: str
    # Key for the searchable fingerprint of an identifier (duplicate detection without decrypting).
    blind_index_key: str

    session_cookie: str = "pm_session"
    session_idle_minutes: int = 60 * 24  # signed out after a day without use
    session_max_days: int = 14  # and after two weeks in any case

    login_max_failures: int = 5
    login_window_minutes: int = 15

    password_min_length: int = Field(default=12, ge=8)
    totp_issuer: str = "Property Manager"

    @property
    def is_local(self) -> bool:
        return self.environment in ("development", "test")

    @property
    def cookie_secure(self) -> bool:
        # Browsers send Secure cookies only over HTTPS; local development runs on http://localhost.
        return not self.is_local


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
