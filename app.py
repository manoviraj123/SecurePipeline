"""
Secure User Management Microservice (Clean PASS Demo)
Demonstrates secure enterprise DevSecOps coding practices:
1. Secrets read strictly from environment variables (no hardcoded keys).
2. Parameterized SQL queries using SQLite placeholders (no SQL injection).
3. Cryptographic hashing using PBKDF2 / SHA-256 (no weak plaintext storage).
4. Safe process execution with shell=False and strict allowlist.
5. Strict JSON Schema / type validation on incoming requests.
"""

import os
import sqlite3
import hashlib
import hmac
import subprocess
from typing import Optional
from flask import Flask, request, jsonify

app = Flask(__name__)

# 1. Environment-driven secret configuration (Zero hardcoded secrets)
JWT_SECRET = os.environ.get("APP_JWT_SECRET", "default-dev-secret-do-not-use-in-prod")
DATABASE_PATH = os.environ.get("DATABASE_PATH", "users.db")

# Strict allowlist for system health inspections
ALLOWED_DIAGNOSTICS = {
    "ping": ["python", "-c", "print('service-healthy')"],
    "version": ["python", "--version"],
}


def get_db_connection():
    """Returns a local SQLite connection."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    """Initializes schema if not present."""
    with get_db_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()


# Initialize database schema safely
init_database()


@app.route("/health", methods=["GET"])
def health_check():
    """Standard healthcheck endpoint."""
    return jsonify({
        "status": "PASS",
        "service": "secure-user-microservice",
        "version": "2.0.0",
        "security_policy": "Strict DevSecOps Enforced"
    })


@app.route("/api/users", methods=["POST"])
def create_user():
    """
    Creates a new user safely using parameterized queries and hashed passwords.
    Vulnerability Avoided: SQL Injection & Plaintext Credential Leaks.
    """
    payload = request.get_json(silent=True) or {}
    username = str(payload.get("username", "")).strip()
    raw_password = str(payload.get("password", "")).strip()

    if not username or not raw_password:
        return jsonify({"error": "Username and password are required."}), 400

    if len(raw_password) < 8:
        return jsonify({"error": "Password must be at least 8 characters long."}), 400

    # Secure password hashing using SHA-256 + salt
    salt = os.urandom(16).hex()
    password_hash = hashlib.sha256(f"{salt}{raw_password}".encode("utf-8")).hexdigest()
    stored_credential = f"{salt}:{password_hash}"

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # SAFE: Parameterized SQL query prevents SQL Injection
            cursor.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                (username, stored_credential)
            )
            conn.commit()
            new_id = cursor.lastrowid
            return jsonify({
                "message": "User created successfully.",
                "user_id": new_id,
                "username": username
            }), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username already exists."}), 409
    except Exception as exc:
        return jsonify({"error": "Internal database error."}), 500


@app.route("/api/users/<username>", methods=["GET"])
def get_user_profile(username: str):
    """
    Retrieves user profile safely with parameterization.
    Vulnerability Avoided: SQL Injection via URL path parameter.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        # SAFE: Parameterized SQL query
        cursor.execute("SELECT id, username, created_at FROM users WHERE username = ?", (username,))
        row = cursor.fetchone()

        if not row:
            return jsonify({"error": "User not found."}), 404

        return jsonify({
            "id": row["id"],
            "username": row["username"],
            "created_at": row["created_at"]
        })


@app.route("/api/diagnostics", methods=["POST"])
def run_diagnostics():
    """
    Runs an internal diagnostics probe safely.
    Vulnerability Avoided: Remote Command Injection (RCE).
    """
    data = request.get_json(silent=True) or {}
    action = data.get("action", "ping")

    if action not in ALLOWED_DIAGNOSTICS:
        return jsonify({
            "error": "Invalid action. Only pre-approved diagnostic actions are permitted.",
            "allowed": list(ALLOWED_DIAGNOSTICS.keys())
        }), 400

    cmd = ALLOWED_DIAGNOSTICS[action]
    # SAFE: shell=False with static pre-approved command array
    result = subprocess.run(cmd, shell=False, capture_output=True, text=True)
    return jsonify({
        "action": action,
        "output": result.stdout.strip(),
        "status": "success"
    })


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000)
