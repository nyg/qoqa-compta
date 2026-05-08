"""SQLAlchemy model for a QoQa order / invoice."""

from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import Date, DateTime, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from crawler.db import Base


class QoqaOrder(Base):
    """Represents one QoQa.ch order from the QoQa API."""

    __tablename__ = "qoqa_orders"
    __table_args__ = (
        UniqueConstraint("order_number", name="uq_qoqa_orders_order_number"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Core order fields
    order_number: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount_chf: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[str | None] = mapped_column(String(32), nullable=True)

    # Amounts
    subtotal_chf: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    discount_chf: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    vat_chf: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)

    # Delivery
    delivery_on: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Offer details
    offer_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    offer_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    offer_subtitle: Mapped[str | None] = mapped_column(String(255), nullable=True)
    offer_category: Mapped[str | None] = mapped_column(String(64), nullable=True)
    offer_subcategory: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Item
    item_description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Invoice / source
    invoice_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    pdf_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    raw_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=lambda: datetime.now(tz=timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<QoqaOrder order_number={self.order_number!r} "
            f"date={self.order_date} amount={self.amount_chf} CHF>"
        )
