from datetime import datetime, timezone


def ensure_utc(dt: datetime) -> datetime:
    """
    SQLite has no native timezone-aware storage - SQLAlchemy's
    DateTime(timezone=True) writes tz-aware values fine, but aiosqlite
    reads them back as naive datetimes (tzinfo stripped). Comparing that
    naive value against a fresh datetime.now(timezone.utc) raises
    TypeError. Since every datetime this app stores IS UTC (see
    app/models.py's _now() helper), it's always safe to reattach UTC to
    a naive value that came back from the DB.

    (Postgres in a real deployment doesn't have this problem - this is
    purely a SQLite quirk. Call this on any DB-loaded datetime before
    comparing it against datetime.now(timezone.utc), regardless of which
    DB is in use, since it's a no-op when tzinfo is already present.)
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt
