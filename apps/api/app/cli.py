"""Command line for setting up and administering the system.

    uv run python -m app.cli init-env                 create a local .env with fresh keys
    uv run python -m app.cli setup                    create / update the tables and the API's database role
    uv run python -m app.cli create-org "Name"        add an organization
    uv run python -m app.cli create-user ...          add a user to an organization
    uv run python -m app.cli set-password EMAIL       new password; signs the user out everywhere
    uv run python -m app.cli reset-2fa EMAIL          lost phone: 2FA is set up again at the next sign-in
    uv run python -m app.cli deactivate-user EMAIL    lock a user out immediately

These commands connect as the database owner, so they are run by an administrator, never by the API.
"""

import argparse
import getpass
import secrets
import sys
import uuid
from pathlib import Path

from cryptography.fernet import Fernet
from sqlalchemy import select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

API_DIR = Path(__file__).resolve().parent.parent


def generate_keys() -> dict[str, str]:
    return {"FIELD_ENCRYPTION_KEYS": Fernet.generate_key().decode(), "BLIND_INDEX_KEY": secrets.token_urlsafe(32)}


def cmd_generate_keys(args: argparse.Namespace) -> None:
    for name, value in generate_keys().items():
        print(f"{name}={value}")


def cmd_init_env(args: argparse.Namespace) -> None:
    env = API_DIR / ".env"
    if env.exists():
        sys.exit(".env already exists; it was not changed.")
    lines = []
    keys = generate_keys()
    for line in (API_DIR / ".env.example").read_text().splitlines():
        name = line.split("=", 1)[0]
        lines.append(f"{name}={keys[name]}" if name in keys else line)
    env.write_text("\n".join(lines) + "\n")
    env.chmod(0o600)
    print("Created .env with new keys. Keep it private; it is not committed.")


def cmd_setup(args: argparse.Namespace) -> None:
    from alembic import command
    from alembic.config import Config

    from app.config import get_settings
    from app.db.rls import APP_ROLE
    from app.db.session import owner_engine

    command.upgrade(Config(str(API_DIR / "alembic.ini")), "head")

    # The API signs in to the database as pm_app, with the password from DATABASE_URL.
    url = make_url(get_settings().database_url)
    if url.username != APP_ROLE:
        sys.exit(f"DATABASE_URL must connect as {APP_ROLE}, not as {url.username}.")
    with owner_engine().begin() as conn:
        # ALTER ROLE takes no bound parameters; the server quotes the value for us.
        quoted = conn.execute(text("SELECT quote_literal(:p)"), {"p": url.password or ""}).scalar_one()
        conn.execute(text(f"ALTER ROLE {APP_ROLE} LOGIN PASSWORD {quoted}"))  # noqa: S608
    print("Database is up to date.")


def _owner_session() -> Session:
    from app.db.session import owner_engine

    return Session(owner_engine())


def _user(db: Session, email: str):
    from app.db.models import User

    user = db.scalar(select(User).where(User.email == email.strip().lower()))
    if not user:
        sys.exit("No such user.")
    return user


def _ask_password() -> str:
    from app.config import get_settings

    password = getpass.getpass("Password: ")
    if len(password) < get_settings().password_min_length:
        sys.exit(f"The password must have at least {get_settings().password_min_length} characters.")
    if password != getpass.getpass("Again: "):
        sys.exit("The passwords are different.")
    return password


def cmd_create_org(args: argparse.Namespace) -> None:
    from app.db.models import Organization

    with _owner_session() as db, db.begin():
        org = Organization(name=args.name)
        db.add(org)
        db.flush()
        print(f"Organization created: {org.id}")


def cmd_create_user(args: argparse.Namespace) -> None:
    from app.db.models import Membership, Organization, Role, User
    from app.security.passwords import hash_password

    with _owner_session() as db, db.begin():
        org = db.get(Organization, uuid.UUID(args.org))
        if not org:
            sys.exit("No such organization.")
        user = User(email=args.email.strip().lower(), name=args.name, password_hash=hash_password(_ask_password()))
        db.add(user)
        db.flush()
        db.add(Membership(organization_id=org.id, user_id=user.id, role=Role(args.role)))
    print("User created. They set up 2FA at their first sign-in.")


def cmd_set_password(args: argparse.Namespace) -> None:
    from app.auth.service import revoke_all_sessions
    from app.security.passwords import hash_password

    with _owner_session() as db, db.begin():
        user = _user(db, args.email)
        user.password_hash = hash_password(_ask_password())
        revoke_all_sessions(db, user.id)
    print("Password changed; the user is signed out everywhere.")


def cmd_reset_2fa(args: argparse.Namespace) -> None:
    from app.auth.service import revoke_all_sessions

    with _owner_session() as db, db.begin():
        user = _user(db, args.email)
        user.totp_enabled, user.totp_secret, user.totp_last_step = False, None, None
        revoke_all_sessions(db, user.id)
    print("2FA reset; the user sets it up again at the next sign-in.")


def cmd_deactivate_user(args: argparse.Namespace) -> None:
    from app.auth.service import revoke_all_sessions

    with _owner_session() as db, db.begin():
        user = _user(db, args.email)
        user.active = False
        revoke_all_sessions(db, user.id)
    print("User deactivated and signed out.")


def main() -> None:
    parser = argparse.ArgumentParser(prog="app.cli", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(required=True)
    sub.add_parser("generate-keys").set_defaults(run=cmd_generate_keys)
    sub.add_parser("init-env").set_defaults(run=cmd_init_env)
    sub.add_parser("setup").set_defaults(run=cmd_setup)
    p = sub.add_parser("create-org")
    p.add_argument("name")
    p.set_defaults(run=cmd_create_org)
    p = sub.add_parser("create-user")
    p.add_argument("--org", required=True, help="organization id")
    p.add_argument("--email", required=True)
    p.add_argument("--name", required=True)
    p.add_argument("--role", default="managing_director")
    p.set_defaults(run=cmd_create_user)
    for name, run in (("set-password", cmd_set_password), ("reset-2fa", cmd_reset_2fa), ("deactivate-user", cmd_deactivate_user)):
        p = sub.add_parser(name)
        p.add_argument("email")
        p.set_defaults(run=run)
    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()
