
import os
import re
import smtplib
import secrets
import hashlib
import jwt

from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from functools import wraps

from dotenv import load_dotenv
from flask import Flask, jsonify, request, g
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

from database import initialize_database, get_db_connection


# LOAD ENVIRONMENT VARIABLES
load_dotenv()

app = Flask(__name__)

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                "https://student-xpense-tracker.netlify.app"
            ]
        }
    },
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    supports_credentials=False
)

JWT_SECRET = os.getenv("JWT_SECRET_KEY")

if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET_KEY is missing in .env")

initialize_database()


# -----------------------------------
# EMAIL CONFIGURATION
# -----------------------------------

def send_email(to_email, subject, body):

    required_settings = [
        "SMTP_USERNAME",
        "SMTP_PASSWORD",
        "MAIL_FROM"
    ]

    for setting in required_settings:
        if not os.getenv(setting):
            raise RuntimeError(f"{setting} is missing in .env")

    message = EmailMessage()

    message["Subject"] = subject
    message["From"] = (
        f'{os.getenv("MAIL_FROM_NAME", "Student Expense Tracker")} '
        f'<{os.getenv("MAIL_FROM")}>'
    )
    message["To"] = to_email

    message.set_content(body)

    with smtplib.SMTP(
        os.getenv("SMTP_HOST", "smtp-relay.brevo.com"),
        int(os.getenv("SMTP_PORT", "587"))
    ) as server:

        server.starttls()

        server.login(
            os.getenv("SMTP_USERNAME"),
            os.getenv("SMTP_PASSWORD")
        )

        server.send_message(message)


def send_otp_email(email, otp):

    body = f"""
Hello!

Your Student Expense Tracker verification code is:

{otp}

This OTP expires in 10 minutes.

If you did not request this code, ignore this email.

Regards,
Student Expense Tracker Team
"""

    send_email(
        email,
        "Verify your email - Student Expense Tracker",
        body
    )


def send_welcome_email(name, email):

    body = f"""
Hello {name},

Welcome to Student Expense Tracker!

Your account is now ready to use.

You can now:
- Record your income
- Manage your expenses
- Monitor your budget
- Track your spending

Thank you for joining us!

Regards,
Student Expense Tracker Team
"""

    send_email(
        email,
        "Welcome to Student Expense Tracker!",
        body
    )


# -----------------------------------
# HELPER FUNCTIONS
# -----------------------------------

def hash_otp(otp):
    return hashlib.sha256(otp.encode()).hexdigest()


def create_token(user_id):

    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24)
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm="HS256"
    )


def token_required(function):

    @wraps(function)
    def wrapper(*args, **kwargs):

        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return jsonify({
                "error": "Authentication token is required"
            }), 401

        token = auth_header.split(" ", 1)[1]

        try:

            payload = jwt.decode(
                token,
                JWT_SECRET,
                algorithms=["HS256"]
            )

            g.user_id = payload["user_id"]

        except jwt.ExpiredSignatureError:

            return jsonify({
                "error": "Session expired. Please login again."
            }), 401

        except jwt.InvalidTokenError:

            return jsonify({
                "error": "Invalid authentication token"
            }), 401

        return function(*args, **kwargs)

    return wrapper


# -----------------------------------
# HOME API
# -----------------------------------

@app.route("/")
def home():

    return jsonify({
        "message": "Student Expense Tracker Backend Running!",
        "status": "Success"
    })


# -----------------------------------
# SIGNUP API
# -----------------------------------

@app.route("/api/auth/signup", methods=["POST"])
def signup():

    data = request.get_json(silent=True) or {}

    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not name or not email or not password:
        return jsonify({
            "error": "All fields are required"
        }), 400

    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return jsonify({
            "error": "Enter a valid email address"
        }), 400

    if len(password) < 8:
        return jsonify({
            "error": "Password must contain at least 8 characters"
        }), 400

    conn = get_db_connection()

    try:

        user = conn.execute(
            "SELECT * FROM users WHERE email = ?",
            (email,)
        ).fetchone()

        if user and user["email_verified"]:

            return jsonify({
                "error": "This email is already registered. Please login."
            }), 409

        otp = f"{secrets.randbelow(1000000):06d}"

        expiry = (
            datetime.now(timezone.utc) + timedelta(minutes=10)
        ).isoformat()

        if user:

            conn.execute("""
                UPDATE users
                SET name = ?,
                    password = ?,
                    otp_hash = ?,
                    otp_expires = ?,
                    otp_attempts = 0
                WHERE id = ?
            """, (
                name,
                generate_password_hash(password),
                hash_otp(otp),
                expiry,
                user["id"]
            ))

        else:

            conn.execute("""
                INSERT INTO users
                (
                    name,
                    email,
                    password,
                    email_verified,
                    otp_hash,
                    otp_expires,
                    otp_attempts
                )
                VALUES (?, ?, ?, 0, ?, ?, 0)
            """, (
                name,
                email,
                generate_password_hash(password),
                hash_otp(otp),
                expiry
            ))

        conn.commit()

        send_otp_email(email, otp)

        return jsonify({
            "message": "OTP sent successfully. Check your email.",
            "email": email
        }), 201

    except Exception:

        conn.rollback()
        app.logger.exception("Signup error")

        return jsonify({
            "error": "Could not send verification email. Check email settings and try again."
        }), 500

    finally:
        conn.close()


# -----------------------------------
# VERIFY OTP API
# -----------------------------------

@app.route("/api/auth/verify-otp", methods=["POST"])
def verify_otp():

    data = request.get_json(silent=True) or {}

    email = data.get("email", "").strip().lower()
    otp = data.get("otp", "").strip()

    if not email or not re.fullmatch(r"\d{6}", otp):
        return jsonify({
            "error": "Enter your email and 6-digit OTP"
        }), 400

    conn = get_db_connection()

    try:

        user = conn.execute(
            "SELECT * FROM users WHERE email = ?",
            (email,)
        ).fetchone()

        if not user:
            return jsonify({
                "error": "Account not found"
            }), 404

        if user["email_verified"]:
            return jsonify({
                "message": "Email is already verified"
            }), 200

        if user["otp_attempts"] >= 5:
            return jsonify({
                "error": "Too many attempts. Request a new OTP."
            }), 429

        if not user["otp_expires"]:
            return jsonify({
                "error": "OTP expired. Request a new OTP."
            }), 400

        expiry = datetime.fromisoformat(user["otp_expires"])

        if datetime.now(timezone.utc) > expiry:
            return jsonify({
                "error": "OTP expired. Request a new OTP."
            }), 400

        if not user["otp_hash"] or hash_otp(otp) != user["otp_hash"]:

            conn.execute("""
                UPDATE users
                SET otp_attempts = otp_attempts + 1
                WHERE id = ?
            """, (user["id"],))

            conn.commit()

            return jsonify({
                "error": "Incorrect OTP"
            }), 400

        conn.execute("""
            UPDATE users
            SET email_verified = 1,
                otp_hash = NULL,
                otp_expires = NULL,
                otp_attempts = 0
            WHERE id = ?
        """, (user["id"],))

        conn.commit()

        return jsonify({
            "message": "Email verified successfully! You can now login."
        }), 200

    finally:
        conn.close()


# -----------------------------------
# RESEND OTP API
# -----------------------------------

@app.route("/api/auth/resend-otp", methods=["POST"])
def resend_otp():

    data = request.get_json(silent=True) or {}

    email = data.get("email", "").strip().lower()

    if not email:
        return jsonify({
            "error": "Email is required"
        }), 400

    conn = get_db_connection()

    try:

        user = conn.execute(
            "SELECT * FROM users WHERE email = ?",
            (email,)
        ).fetchone()

        if not user or user["email_verified"]:

            return jsonify({
                "error": "Unable to resend OTP for this account"
            }), 400

        otp = f"{secrets.randbelow(1000000):06d}"

        expiry = (
            datetime.now(timezone.utc) + timedelta(minutes=10)
        ).isoformat()

        conn.execute("""
            UPDATE users
            SET otp_hash = ?,
                otp_expires = ?,
                otp_attempts = 0
            WHERE id = ?
        """, (
            hash_otp(otp),
            expiry,
            user["id"]
        ))

        conn.commit()

        send_otp_email(email, otp)

        return jsonify({
            "message": "A new OTP has been sent"
        }), 200

    except Exception:

        app.logger.exception("Resend OTP error")

        return jsonify({
            "error": "Could not send OTP. Try again later."
        }), 500

    finally:
        conn.close()


# -----------------------------------
# LOGIN API
# -----------------------------------

@app.route("/api/auth/login", methods=["POST"])
def login():

    data = request.get_json(silent=True) or {}

    email = data.get("email", "")
    password = data.get("password", "")

    if not isinstance(email, str) or not isinstance(password, str):
        return jsonify({
            "error": "Invalid login details"
        }), 400

    email = email.strip().lower()

    if not email or not password:
        return jsonify({
            "error": "Email and password are required"
        }), 400

    conn = get_db_connection()

    try:

        user = conn.execute(
            "SELECT * FROM users WHERE email = ?",
            (email,)
        ).fetchone()

        if not user:
            return jsonify({
                "error": "No account found with this email."
            }), 401

        password_match = check_password_hash(
            user["password"],
            password
        )

        if not password_match:
            return jsonify({
                "error": "Incorrect password. Please check your login details."
            }), 401

        if not user["email_verified"]:
            return jsonify({
                "error": "Please verify your email before logging in.",
                "needs_verification": True,
                "email": email
            }), 403

        token = create_token(user["id"])

        welcome_sent = bool(user["welcome_email_sent"])

        # Send welcome email only on first successful login
        if not welcome_sent:

            try:

                send_welcome_email(
                    user["name"],
                    email
                )

                conn.execute("""
                    UPDATE users
                    SET welcome_email_sent = 1
                    WHERE id = ?
                """, (user["id"],))

                conn.commit()

                welcome_sent = True

            except Exception:

                app.logger.exception(
                    "Welcome email sending failed"
                )

        return jsonify({
            "message": "Login successful",
            "token": token,
            "welcome_email_sent": welcome_sent,
            "user": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"]
            }
        }), 200

    except Exception:

        app.logger.exception("Login API error")

        return jsonify({
            "error": "Something went wrong during login."
        }), 500

    finally:
        conn.close()


# -----------------------------------
# GET ALL EXPENSES
# -----------------------------------

@app.route("/api/expenses", methods=["GET"])
@token_required
def get_expenses():

    conn = get_db_connection()

    try:

        expenses = conn.execute("""
            SELECT *
            FROM expenses
            WHERE user_id = ?
            ORDER BY date DESC, id DESC
        """, (g.user_id,)).fetchall()

        return jsonify([
            dict(item) for item in expenses
        ]), 200

    finally:
        conn.close()


# -----------------------------------
# ADD EXPENSE
# -----------------------------------

@app.route("/api/expenses", methods=["POST"])
@token_required
def add_expense():

    data = request.get_json(silent=True) or {}

    required = [
        "title",
        "amount",
        "category",
        "date",
        "type"
    ]

    if any(data.get(field) in (None, "") for field in required):

        return jsonify({
            "error": "Please fill all required fields"
        }), 400

    try:

        amount = float(data["amount"])

        if amount <= 0:
            return jsonify({
                "error": "Amount must be greater than zero"
            }), 400

    except (ValueError, TypeError):

        return jsonify({
            "error": "Invalid amount"
        }), 400

    conn = get_db_connection()

    try:

        cursor = conn.execute("""
            INSERT INTO expenses
            (
                title,
                amount,
                category,
                description,
                date,
                type,
                user_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            data["title"],
            amount,
            data["category"],
            data.get("description", ""),
            data["date"],
            data["type"],
            g.user_id
        ))

        conn.commit()

        return jsonify({
            "message": "Transaction added successfully",
            "id": cursor.lastrowid
        }), 201

    finally:
        conn.close()


# -----------------------------------
# UPDATE EXPENSE
# -----------------------------------

@app.route("/api/expenses/<int:expense_id>", methods=["PUT"])
@token_required
def update_expense(expense_id):

    data = request.get_json(silent=True) or {}

    required = [
        "title",
        "amount",
        "category",
        "date",
        "type"
    ]

    if any(data.get(field) in (None, "") for field in required):

        return jsonify({
            "error": "Please fill all required fields"
        }), 400

    try:

        amount = float(data["amount"])

        if amount <= 0:
            return jsonify({
                "error": "Amount must be greater than zero"
            }), 400

    except (ValueError, TypeError):

        return jsonify({
            "error": "Invalid amount"
        }), 400

    conn = get_db_connection()

    try:

        cursor = conn.execute("""
            UPDATE expenses
            SET title = ?,
                amount = ?,
                category = ?,
                description = ?,
                date = ?,
                type = ?
            WHERE id = ? AND user_id = ?
        """, (
            data["title"],
            amount,
            data["category"],
            data.get("description", ""),
            data["date"],
            data["type"],
            expense_id,
            g.user_id
        ))

        conn.commit()

        if cursor.rowcount == 0:

            return jsonify({
                "error": "Transaction not found"
            }), 404

        return jsonify({
            "message": "Transaction updated successfully"
        }), 200

    finally:
        conn.close()


# -----------------------------------
# DELETE EXPENSE
# -----------------------------------

@app.route("/api/expenses/<int:expense_id>", methods=["DELETE"])
@token_required
def delete_expense(expense_id):

    conn = get_db_connection()

    try:

        cursor = conn.execute("""
            DELETE FROM expenses
            WHERE id = ? AND user_id = ?
        """, (
            expense_id,
            g.user_id
        ))

        conn.commit()

        if cursor.rowcount == 0:

            return jsonify({
                "error": "Transaction not found"
            }), 404

        return jsonify({
            "message": "Transaction deleted successfully"
        }), 200

    finally:
        conn.close()


# -----------------------------------
# RUN APPLICATION
# -----------------------------------

if __name__ == "__main__":
    app.run(debug=True)
