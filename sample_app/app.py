"""
Sample Hardened Application for SecurePipeline Clean PASS Demonstration.
All intentional vulnerabilities resolved:
- No hardcoded secrets (environment variable with fallback)
- Safe subprocess execution (shell=False with command allowlist)
- No eval() (safe literal parsing)
"""

import os
import subprocess
import ast
from flask import Flask, request, jsonify

app = Flask(__name__)

# Secure secret handling via environment variables
API_KEY = os.environ.get("SECURE_API_KEY", "")

ALLOWED_COMMANDS = {
    "status": ["uptime"],
    "version": ["python", "--version"],
    "date": ["date"],
}


@app.route("/")
def home():
    return jsonify({"status": "running", "service": "hardened-secure-app"})


@app.route("/execute")
def execute_command():
    """Safe execution pattern: shell=False with strict allowlist."""
    cmd_key = request.args.get("cmd", "version")
    if cmd_key not in ALLOWED_COMMANDS:
        return jsonify({"error": "Unauthorized command"}), 400

    cmd_args = ALLOWED_COMMANDS[cmd_key]
    result = subprocess.run(cmd_args, shell=False, capture_output=True, text=True)
    return jsonify({"output": result.stdout.strip()})


@app.route("/eval")
def evaluate_expression():
    """Safe evaluation pattern: ast.literal_eval instead of eval()."""
    expr = request.args.get("expr", "123")
    try:
        val = ast.literal_eval(expr)
        return jsonify({"result": val})
    except Exception:
        return jsonify({"error": "Invalid expression"}), 400


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
