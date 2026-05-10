"""SQLAlchemy model for a QoQa sub-universe (offer sub-category)."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from crawler.db import Base


class QoqaSubuniverse(Base):
    """Represents one QoQa.ch sub-universe (second-level offer category).

    Populated from the authenticated ``/v2/alerts`` API endpoint (the
    ``push_topics`` field of each universe). Identifiers are cleaned by
    stripping the ``subuniverse_`` or leading ``q`` prefix and the trailing
    ``qoqach`` suffix (e.g. ``qbeerqoqach`` → ``beer``).
    """

    __tablename__ = "qoqa_subuniverses"
    __table_args__ = (
        UniqueConstraint(
            "identifier",
            name="uq_qoqa_subuniverses_identifier",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    identifier: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    universe_tracking_identifier: Mapped[str] = mapped_column(
        String(64), nullable=False, index=True
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=lambda: datetime.now(tz=timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<QoqaSubuniverse identifier={self.identifier!r} "
            f"universe={self.universe_tracking_identifier!r} "
            f"name={self.name!r}>"
        )
