import sys

try:
    from src.database.connection import Base, engine
    from src.database import models  # noqa: F401 - ensures models are registered in Base.metadata
except ImportError:
    from database.connection import Base, engine
    import database.models as models  # noqa: F401


def create_tables():
    tables = list(Base.metadata.tables.keys())
    print(f"Creating database tables: {tables}...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully.")


def drop_tables():
    tables = list(Base.metadata.tables.keys())
    print(f"Dropping database tables: {tables}...")
    Base.metadata.drop_all(bind=engine)
    print("Tables dropped successfully.")


def main():
    command = sys.argv[1] if len(sys.argv) > 1 else "push"
    if command in ("push", "create", "create_all"):
        create_tables()
    elif command in ("drop", "drop_all"):
        drop_tables()
    else:
        print(f"Unknown command: {command}. Supported commands: 'push', 'drop'.")
        sys.exit(1)


if __name__ == "__main__":
    main()
