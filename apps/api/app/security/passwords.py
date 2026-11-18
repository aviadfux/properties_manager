"""Password hashing (Argon2id) and one-time codes (TOTP) for two-factor sign-in."""

import pyotp
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()
# Verified when the email is unknown, so a wrong email takes as long as a wrong password.
_DUMMY_HASH = _hasher.hash("not a real password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def new_totp_secret() -> str:
    return pyotp.random_base32()


def totp_uri(secret: str, email: str, issuer: str) -> str:
    """What the authenticator app reads from the QR code."""
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer)


def matching_totp_step(secret: str, code: str, at: float) -> int | None:
    """The 30-second step this code belongs to (now, or one step either side for clock drift), or None."""
    code = code.strip().replace(" ", "")
    if not (code.isdigit() and len(code) == 6):
        return None
    totp = pyotp.TOTP(secret)
    step = int(at // totp.interval)
    for candidate in (step, step - 1, step + 1):
        if totp.verify(code, for_time=candidate * totp.interval, valid_window=0):
            return candidate
    return None
