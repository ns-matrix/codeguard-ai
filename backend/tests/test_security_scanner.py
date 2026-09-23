from app.services.security_scanner import security_scanner


def test_sql_injection_detected():
    code = (
        "import sqlite3\n\n"
        "def get_user(user_id):\n"
        '    conn = sqlite3.connect("users.db")\n'
        '    query = "SELECT * FROM users WHERE id = " + user_id\n'
        "    return conn.execute(query).fetchone()\n"
    )
    issues = security_scanner.scan(code, "python")
    sqli = [i for i in issues if "injection" in i.title.lower() or "injection" in i.category]
    assert sqli, f"expected SQL injection, got: {[i.title for i in issues]}"
    assert sqli[0].line_number == 5
    assert sqli[0].severity in ("critical", "high")
    assert sqli[0].recommendation
    assert sqli[0].confidence >= 0.8


def test_hardcoded_api_key():
    code = 'API_KEY = "test-secret-123"\n'
    issues = security_scanner.scan(code, "python")
    assert any(i.category == "secrets" for i in issues)
    secret_issue = next(i for i in issues if i.category == "secrets")
    assert secret_issue.line_number == 1
    assert secret_issue.severity == "critical"
    assert "test-secret-123" not in secret_issue.evidence
    assert "****" in secret_issue.evidence


def test_hardcoded_password():
    code = 'DATABASE_PASSWORD = "SuperSecretPassword"\n'
    issues = security_scanner.scan(code, "python")
    assert any(i.category == "secrets" for i in issues)


def test_command_injection():
    code = 'import os\nos.system("ls " + user_input)\n'
    issues = security_scanner.scan(code, "python")
    assert any("command injection" in i.title.lower() for i in issues)


def test_xss_flagged_in_js():
    code = "element.innerHTML = userInput;\n"
    issues = security_scanner.scan(code, "javascript")
    assert any(i.category == "xss" for i in issues)


def test_eval_flagged_python():
    code = "result = eval(user_input)\n"
    issues = security_scanner.scan(code, "python")
    assert any("injection" in i.category or "eval" in i.title.lower() for i in issues)


def test_clean_code_no_secrets():
    code = "def add(a, b):\n    return a + b\n"
    issues = security_scanner.scan(code, "python")
    assert not any(i.category == "secrets" for i in issues)


def test_sql_tautology():
    code = "SELECT * FROM users WHERE name = 'a' OR '1'='1';"
    issues = security_scanner.scan(code, "sql")
    assert any("tautology" in i.title.lower() for i in issues)


def test_weak_crypto():
    code = "import hashlib\ndigest = hashlib.md5(data)\n"
    issues = security_scanner.scan(code, "python")
    assert any(i.category == "cryptography" for i in issues)


def test_insecure_http():
    code = 'url = "http://example.com/api"\n'
    issues = security_scanner.scan(code, "python")
    assert any("http" in i.title.lower() for i in issues)
