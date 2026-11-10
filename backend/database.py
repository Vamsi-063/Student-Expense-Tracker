import sqlite3

DATABASE = "expenses.db"


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def initialize_database():
    conn = get_db_connection()

    # USERS TABLE
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # EXPENSES TABLE
    conn.execute("""
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            description TEXT,
            date TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'expense'
        )
    """)

    # ADD USER_ID TO EXISTING EXPENSES TABLE
    expense_columns = [
        row["name"]
        for row in conn.execute("PRAGMA table_info(expenses)").fetchall()
    ]

    if "user_id" not in expense_columns:
        conn.execute("""
            ALTER TABLE expenses
            ADD COLUMN user_id INTEGER REFERENCES users(id)
        """)

    # EMAIL VERIFICATION COLUMNS
    user_columns = [
        row["name"]
        for row in conn.execute("PRAGMA table_info(users)").fetchall()
    ]

    migrations = {
        "email_verified": "INTEGER NOT NULL DEFAULT 0",
        "otp_hash": "TEXT",
        "otp_expires": "TEXT",
        "otp_attempts": "INTEGER NOT NULL DEFAULT 0",
        "welcome_email_sent": "INTEGER NOT NULL DEFAULT 0"
    }

    for column, definition in migrations.items():
        if column not in user_columns:
            conn.execute(
                f"ALTER TABLE users ADD COLUMN {column} {definition}"
            )

    conn.commit()
    conn.close()

    print("Database Initialized Successfully!")


if __name__ == "__main__":
    initialize_database()