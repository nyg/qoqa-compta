"""SQLAlchemy model for a QoQa universe (offer category)."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from crawler.db import Base


class QoqaUniverse(Base):
    """Represents one QoQa.ch universe (top-level offer category).

    Populated from the public ``/v2/universes`` API endpoint.
    Localized names are stored for the two supported QoQa locales (fr, de).
    Temporary or legacy universes that appear in orders but not in the API
    response will not have a row here; consumers should fall back to the raw
    ``universe_tracking_identifier`` value.
    """

    __tablename__ = "qoqa_universes"
    __table_args__ = (
        UniqueConstraint(
            "universe_tracking_identifier",
            name="uq_qoqa_universes_tracking_identifier",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    universe_tracking_identifier: Mapped[str] = mapped_column(
        String(64), nullable=False, index=True
    )
    name_fr: Mapped[str | None] = mapped_column(String(255), nullable=True)
    name_de: Mapped[str | None] = mapped_column(String(255), nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=lambda: datetime.now(tz=timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<QoqaUniverse identifier={self.universe_tracking_identifier!r} "
            f"name_fr={self.name_fr!r}>"
        )
