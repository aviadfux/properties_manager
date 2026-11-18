"""Encryption of identifiers at rest (docs/SECURITY.md §1).

Tax IDs and 2FA secrets are stored encrypted; the database never holds them as readable text. To find
a customer by tax ID without decrypting every row, a keyed fingerprint (HMAC) is stored next to it.
"""

import hashlib
import hmac
import secrets

from cryptography.fernet import Fernet, MultiFernet
from sqlalchemy import String
from sqlalchemy.types import TypeDecorator

from app.config import get_settings


def _fernet() -> MultiFernet:
    keys = [k.strip() for k in get_settings().field_encryption_keys.split(",") if k.strip()]
    return MultiFernet([Fernet(k) for k in keys])


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()


def blind_index(value: str) -> str:
    """The same input always gives the same fingerprint; without the key it cannot be reversed or guessed."""
    key = get_settings().blind_index_key.encode()
    return hmac.new(key, value.encode(), hashlib.sha256).hexdigest()


def digits_only(value: str) -> str:
    return "".join(ch for ch in value if ch.isdigit())


def mask(value: str, visible: int = 4) -> str:
    """Same rule as the screens (apps/admin/src/security/sensitive.ts): only the last digits show."""
    if len(value) <= visible:
        return "•" * len(value)
    return "•" * (len(value) - visible) + value[-visible:]


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    """Session tokens are random and long, so a plain hash is enough: the database never holds a usable token."""
    return hashlib.sha256(token.encode()).hexdigest()


class EncryptedString(TypeDecorator[str]):
    """A text column that is encrypted on the way into the database and decrypted on the way out."""

    impl = String
    cache_ok = True

    def process_bind_param(self, value: str | None, dialect: object) -> str | None:
        return None if value is None else encrypt(value)

    def process_result_value(self, value: str | None, dialect: object) -> str | None:
        return None if value is None else decrypt(value)
