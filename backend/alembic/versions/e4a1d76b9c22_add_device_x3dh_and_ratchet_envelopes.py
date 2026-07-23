"""add device-scoped X3DH bundles and ratchet relay metadata

Revision ID: e4a1d76b9c22
Revises: b66f910ab069
Create Date: 2026-07-23 00:00:00.000000

This is additive for existing traffic. Legacy protocol-v0 messages retain
their existing ciphertext bytes and receive protocol_version=0.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e4a1d76b9c22"
down_revision: Union[str, Sequence[str], None] = "b66f910ab069"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "device_key_bundles",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("device_id", sa.String(length=36), nullable=False),
        sa.Column("identity_signing_key_public", sa.LargeBinary(), nullable=False),
        sa.Column("identity_dh_key_public", sa.LargeBinary(), nullable=False),
        sa.Column("signed_prekey_id", sa.String(length=64), nullable=False),
        sa.Column("signed_prekey_public", sa.LargeBinary(), nullable=False),
        sa.Column("signed_prekey_signature", sa.LargeBinary(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"], name="fk_device_key_bundles_device"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("device_id", name="uq_device_key_bundles_device"),
    )
    op.create_table(
        "one_time_prekeys",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("device_id", sa.String(length=36), nullable=False),
        sa.Column("key_id", sa.String(length=64), nullable=False),
        sa.Column("public_key", sa.LargeBinary(), nullable=False),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("claimed_by_device_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["claimed_by_device_id"], ["devices.id"], name="fk_one_time_prekeys_claimed_by_device"),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"], name="fk_one_time_prekeys_device"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("device_id", "key_id", name="uq_one_time_prekey_device_key"),
    )
    op.create_index("ix_one_time_prekeys_available", "one_time_prekeys", ["device_id", "claimed_at"], unique=False)

    with op.batch_alter_table("messages") as batch_op:
        batch_op.add_column(sa.Column("protocol_version", sa.Integer(), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("sender_device_id", sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column("recipient_device_id", sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column("session_id", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("ratchet_public_key", sa.LargeBinary(), nullable=True))
        batch_op.add_column(sa.Column("message_number", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("previous_chain_length", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("nonce", sa.LargeBinary(), nullable=True))
        batch_op.add_column(sa.Column("prekey_header", sa.JSON(), nullable=True))
        batch_op.create_foreign_key("fk_messages_sender_device", "devices", ["sender_device_id"], ["id"])
        batch_op.create_foreign_key("fk_messages_recipient_device", "devices", ["recipient_device_id"], ["id"])
        batch_op.drop_constraint("uq_sender_client_id", type_="unique")
        batch_op.create_unique_constraint(
            "uq_message_device_envelope",
            ["sender_device_id", "recipient_device_id", "client_id"],
        )
        batch_op.create_index(
            "ix_messages_recipient_device_created",
            ["recipient_device_id", "created_at"],
            unique=False,
        )
    op.create_index(
        "uq_messages_legacy_sender_client",
        "messages",
        ["sender_id", "client_id"],
        unique=True,
        postgresql_where=sa.text("protocol_version = 0"),
        sqlite_where=sa.text("protocol_version = 0"),
    )


def downgrade() -> None:
    legacy_v1_count = op.get_bind().execute(
        sa.text("SELECT COUNT(*) FROM messages WHERE protocol_version > 0")
    ).scalar_one()
    if legacy_v1_count:
        raise RuntimeError(
            "Refusing to downgrade after v1 encrypted envelopes have been stored; "
            "downgrade would discard ratchet metadata."
        )

    op.drop_index("uq_messages_legacy_sender_client", table_name="messages")
    with op.batch_alter_table("messages") as batch_op:
        batch_op.drop_index("ix_messages_recipient_device_created")
        batch_op.drop_constraint("uq_message_device_envelope", type_="unique")
        batch_op.create_unique_constraint("uq_sender_client_id", ["sender_id", "client_id"])
        batch_op.drop_constraint("fk_messages_recipient_device", type_="foreignkey")
        batch_op.drop_constraint("fk_messages_sender_device", type_="foreignkey")
        batch_op.drop_column("prekey_header")
        batch_op.drop_column("nonce")
        batch_op.drop_column("previous_chain_length")
        batch_op.drop_column("message_number")
        batch_op.drop_column("ratchet_public_key")
        batch_op.drop_column("session_id")
        batch_op.drop_column("recipient_device_id")
        batch_op.drop_column("sender_device_id")
        batch_op.drop_column("protocol_version")

    op.drop_index("ix_one_time_prekeys_available", table_name="one_time_prekeys")
    op.drop_table("one_time_prekeys")
    op.drop_table("device_key_bundles")
