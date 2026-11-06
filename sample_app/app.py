"""
Sample Vulnerable Test Application for SecurePipeline Validation.
Includes intentional patterns for testing SAST, secret detection, and dependencies.
"""

import os
import subprocess
from flask import Flask, request, jsonify

app = Flask(__name__)

# Intentional secret test pattern for Gitleaks detection
DEMO_API_KEY = "AKIAIOSFODNN7EXAMPLE"


@app.route("/")
def home():
    return jsonify({"status": "running", "service": "sample-vulnerable-app"})


@app.route("/execute")
def execute_command():
    """Intentional SAST test pattern for Semgrep (Command Injection / shell=True)."""
    user_cmd = request.args.get("cmd", "echo hello")
    result = subprocess.check_output(user_cmd, shell=True, text=True)
    return jsonify({"output": result})


@app.route("/eval")
def evaluate_expression():
    """Intentional SAST test pattern for Semgrep (eval)."""
    expr = request.args.get("expr", "1 + 1")
    val = eval(expr)
    return jsonify({"result": val})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
