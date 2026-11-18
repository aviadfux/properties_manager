import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app import audit
from app.auth.deps import Ctx, require
from app.db.models import Property
from app.numbering import next_number
from app.permissions import Permission
from app.schemas import PropertyIn, PropertyOut

router = APIRouter(prefix="/api/properties", tags=["properties"])


@router.get("")
def list_properties(ctx: Ctx = Depends(require(Permission.properties_read))) -> list[PropertyOut]:
    return [PropertyOut.model_validate(p) for p in ctx.db.scalars(select(Property).order_by(Property.number))]


@router.post("", status_code=201)
def create_property(body: PropertyIn, ctx: Ctx = Depends(require(Permission.properties_write))) -> PropertyOut:
    # A parent in another organization is invisible here, so it is reported as missing.
    if body.parent_id and not ctx.db.get(Property, body.parent_id):
        raise HTTPException(422, "unknown_parent")
    prop = Property(**body.model_dump(), organization_id=ctx.organization_id, number=next_number(ctx.db, ctx.organization_id, "property"))
    ctx.db.add(prop)
    ctx.db.flush()
    audit.record(
        ctx.db, organization_id=ctx.organization_id, actor_user_id=ctx.user.id, action="property.create", entity_type="property", entity_id=prop.id
    )
    return PropertyOut.model_validate(prop)


@router.get("/{property_id}")
def get_property(property_id: uuid.UUID, ctx: Ctx = Depends(require(Permission.properties_read))) -> PropertyOut:
    prop = ctx.db.get(Property, property_id)
    if not prop:
        raise HTTPException(404, "not_found")
    return PropertyOut.model_validate(prop)
