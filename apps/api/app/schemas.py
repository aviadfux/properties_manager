"""What the API accepts and returns. JSON uses camelCase, like the screens (apps/admin/src/domain/types.ts)."""

import re
import uuid
from decimal import Decimal
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field
from pydantic.alias_generators import to_camel

from app.db.models import Channel, CustomerStatus, Language, PartyKind, PropertyKind, Role


class Api(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True, str_strip_whitespace=True)


def _e164(value: str) -> str:
    if not re.fullmatch(r"\+[1-9]\d{6,14}", value):
        raise ValueError("phone must be in international format, e.g. +972501234567")
    return value


Phone = Annotated[str, AfterValidator(_e164)]

# ---------- auth ----------


class LoginIn(Api):
    email: str = Field(max_length=320)
    password: str = Field(max_length=1024)
    code: str | None = Field(default=None, max_length=10)


class CodeIn(Api):
    code: str = Field(max_length=10)


class Me(Api):
    name: str
    email: str
    role: Role | None = None
    organization_id: uuid.UUID
    mfa_setup_required: bool


class TotpSetup(Api):
    secret: str
    uri: str


# ---------- customers ----------


class CustomerIn(Api):
    kind: PartyKind
    name: str = Field(min_length=1, max_length=200)
    tax_id: str | None = Field(default=None, max_length=20)
    phone: Phone
    email: EmailStr | None = None
    billing_address: str | None = Field(default=None, max_length=300)
    preferred_language: Language = Language.he
    preferred_channel: Channel = Channel.whatsapp
    notes: str | None = Field(default=None, max_length=5000)


class CustomerOut(Api):
    id: uuid.UUID
    number: int
    kind: PartyKind
    name: str
    tax_id_masked: str | None  # the full number only through "reveal", which is logged
    phone: str
    email: str | None
    billing_address: str | None
    preferred_language: Language
    preferred_channel: Channel
    status: CustomerStatus
    notes: str | None


class TaxIdOut(Api):
    tax_id: str | None


# ---------- properties ----------


class PropertyIn(Api):
    kind: PropertyKind
    parent_id: uuid.UUID | None = None
    address: str = Field(min_length=1, max_length=200)
    city: str = Field(min_length=1, max_length=100)
    unit: str | None = Field(default=None, max_length=20)
    floor: int | None = Field(default=None, ge=-10, le=200)
    area_sqm: Decimal | None = Field(default=None, gt=0, max_digits=8, decimal_places=2)
    rooms: Decimal | None = Field(default=None, gt=0, max_digits=4, decimal_places=1)
    block: str | None = Field(default=None, max_length=20)
    parcel: str | None = Field(default=None, max_length=20)
    notes: str | None = Field(default=None, max_length=5000)


class PropertyOut(PropertyIn):
    id: uuid.UUID
    number: int
