"""What each role may do (spec §8). Checked on the server for every call — hiding a button is not enough.

First cut for the tables that exist so far. "Assigned clients and properties" for property managers
and operations staff arrives with assignments in Phase 1; until then they see the organization's records.
"""

import enum

from app.db.models import Role


class Permission(enum.StrEnum):
    customers_read = "customers.read"
    customers_write = "customers.write"
    properties_read = "properties.read"
    properties_write = "properties.write"
    identifiers_reveal = "identifiers.reveal"  # see a full ID number; written to the audit log


P = Permission

ROLE_PERMISSIONS: dict[Role, frozenset[Permission]] = {
    Role.managing_director: frozenset(Permission),
    Role.property_manager: frozenset({P.customers_read, P.customers_write, P.properties_read, P.properties_write, P.identifiers_reveal}),
    Role.operations: frozenset({P.customers_read, P.properties_read}),
    Role.finance: frozenset({P.customers_read, P.properties_read, P.identifiers_reveal}),
    Role.accountant: frozenset({P.customers_read, P.properties_read}),
}


def allowed(role: Role, permission: Permission) -> bool:
    return permission in ROLE_PERMISSIONS[role]
