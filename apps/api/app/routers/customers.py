import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app import audit
from app.auth.deps import Ctx, require
from app.db.models import Customer
from app.numbering import next_number
from app.permissions import Permission
from app.schemas import CustomerIn, CustomerOut, TaxIdOut
from app.security import crypto

router = APIRouter(prefix="/api/customers", tags=["customers"])


def _out(c: Customer) -> CustomerOut:
    return CustomerOut.model_validate({**c.__dict__, "tax_id_masked": crypto.mask(c.tax_id) if c.tax_id else None})


def _get(ctx: Ctx, customer_id: uuid.UUID) -> Customer:
    # No organization filter needed here: row-level security hides other organizations' rows.
    customer = ctx.db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(404, "not_found")
    return customer


@router.get("")
def list_customers(ctx: Ctx = Depends(require(Permission.customers_read))) -> list[CustomerOut]:
    return [_out(c) for c in ctx.db.scalars(select(Customer).order_by(Customer.number))]


@router.post("", status_code=201)
def create_customer(body: CustomerIn, ctx: Ctx = Depends(require(Permission.customers_write))) -> CustomerOut:
    tax_id = body.tax_id.replace(" ", "").replace("-", "") if body.tax_id else None
    customer = Customer(
        **body.model_dump(exclude={"tax_id", "email"}),
        organization_id=ctx.organization_id,
        number=next_number(ctx.db, ctx.organization_id, "customer"),
        tax_id=tax_id or None,
        tax_id_index=crypto.blind_index(crypto.digits_only(tax_id) or tax_id.lower()) if tax_id else None,
        email=body.email.lower() if body.email else None,
    )
    ctx.db.add(customer)
    ctx.db.flush()
    audit.record(
        ctx.db,
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user.id,
        action="customer.create",
        entity_type="customer",
        entity_id=customer.id,
    )
    return _out(customer)


@router.get("/{customer_id}")
def get_customer(customer_id: uuid.UUID, ctx: Ctx = Depends(require(Permission.customers_read))) -> CustomerOut:
    return _out(_get(ctx, customer_id))


@router.post("/{customer_id}/reveal-tax-id")
def reveal_tax_id(customer_id: uuid.UUID, ctx: Ctx = Depends(require(Permission.identifiers_reveal))) -> TaxIdOut:
    """The full ID number. Every reveal is written to the audit log (docs/SECURITY.md §1)."""
    customer = _get(ctx, customer_id)
    audit.record(
        ctx.db,
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user.id,
        action="customer.reveal_tax_id",
        entity_type="customer",
        entity_id=customer.id,
    )
    return TaxIdOut(tax_id=customer.tax_id)
