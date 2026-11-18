"""Row-level security: the database itself keeps organizations apart (spec §1, §8; acceptance #15).

Every request runs in one transaction that first says who is asking:

    SELECT set_config('app.organization_id', '<uuid>', true)

and every protected table has a policy that only lets rows of that organization through — for reading
and for writing. Code that forgets a WHERE clause still cannot see another organization's rows, and a
transaction that never set the organization sees nothing at all.

The API connects as `pm_app`, which does not own the tables. The owner — used only by migrations and
the command line (creating an organization or a user) — is not subject to the policies.
The SQL here is used by the first migration and checked by the tests.
"""

APP_ROLE = "pm_app"

# No customer data, read at sign-in before the organization is known.
IDENTITY_TABLES = {"users", "sessions", "login_attempts"}
# The API may add and read, never change or delete.
APPEND_ONLY_TABLES = {"audit_events"}

CURRENT_ORG = "NULLIF(current_setting('app.organization_id', true), '')::uuid"
CURRENT_USER = "NULLIF(current_setting('app.user_id', true), '')::uuid"


def policy_condition(table: str) -> str:
    if table == "organizations":
        return f"id = {CURRENT_ORG}"
    if table == "memberships":
        # At sign-in the user is known before the organization: they may see their own memberships.
        return f"organization_id = {CURRENT_ORG} OR user_id = {CURRENT_USER}"
    return f"organization_id = {CURRENT_ORG}"


def enable_rls_sql(table: str) -> list[str]:
    condition = policy_condition(table)
    # Writing always requires the current organization, also for memberships.
    check = f"id = {CURRENT_ORG}" if table == "organizations" else f"organization_id = {CURRENT_ORG}"
    return [
        f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY",
        f"CREATE POLICY organization_isolation ON {table} USING ({condition}) WITH CHECK ({check})",
    ]


def grants_sql(table: str) -> list[str]:
    if table in APPEND_ONLY_TABLES:
        rights = "SELECT, INSERT"
    elif table == "organizations":
        rights = "SELECT, UPDATE"  # organizations are created from the command line, not by the API
    else:
        rights = "SELECT, INSERT, UPDATE, DELETE"
    return [f"GRANT {rights} ON {table} TO {APP_ROLE}"]
