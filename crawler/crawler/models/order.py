"""SQLAlchemy model for a Qoqa order / invoice."""

from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import Date, DateTime, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from crawler.db import Base


class QoqaOrder(Base):
    """Represents one Qoqa.ch order parsed from a PDF invoice."""

    __tablename__ = "qoqa_orders"
    __table_args__ = (
        UniqueConstraint("order_number", name="uq_qoqa_orders_order_number"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Core invoice fields
    order_number: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount_chf: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    partner_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Source information
    pdf_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)

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
