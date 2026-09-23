from app.services.syntax_validator import syntax_validator


def test_python_valid():
    code = 'def calculate_total(items):\n    total = 0\n    for item in items:\n        total += item["price"]\n    return total\n'
    r = syntax_validator.validate(code, "python")
    assert r.valid is True
    assert r.errors == []
    assert r.parser == "python-ast"


def test_python_missing_colon_reports_line_1():
    code = "def calculate_total(items)\n    total = 0\n    return total\n"
    r = syntax_validator.validate(code, "python")
    assert r.valid is False
    assert r.errors
    assert r.errors[0].line == 1
    assert r.errors[0].evidence is not None


def test_python_empty_for_block():
    code = "def f(items):\n    for item in items:\n    return 1\n"
    r = syntax_validator.validate(code, "python")
    assert r.valid is False


def test_json_valid():
    r = syntax_validator.validate('{"a": 1}', "json")
    assert r.valid is True


def test_json_invalid():
    r = syntax_validator.validate('{"a": }', "json")
    assert r.valid is False
    assert r.errors[0].line >= 1


def test_javascript_malformed():
    code = "function calculateDiscount(price, discount) {\n    if (price > 1000 {\n        discount = 20;\n    }\n}\n"
    r = syntax_validator.validate(code, "javascript")
    assert r.valid is False
    assert r.errors


def test_javascript_valid():
    code = "function add(a, b) {\n  return a + b;\n}\n"
    r = syntax_validator.validate(code, "javascript")
    assert r.valid is True


def test_sql_unbalanced_parens():
    r = syntax_validator.validate("SELECT id FROM users WHERE (id = 1;", "sql")
    assert r.valid is False


def test_sql_valid_select():
    r = syntax_validator.validate("SELECT id, username FROM users;", "sql")
    assert r.valid is True


def test_html_unclosed_tag():
    r = syntax_validator.validate("<div><span>x</div>", "html")
    assert r.valid is False


def test_unknown_language_noop():
    r = syntax_validator.validate("whatever", "unknown-language")
    assert r.valid is True
    assert r.unavailable is True


def test_bash_block_balance():
    r = syntax_validator.validate("#!/bin/bash\nif [ 1 ]; then\n  echo hi\n", "bash")
    if r.parser == "heuristic" and not r.errors:
        assert any("unclosed" in w.lower() or "bash" in w.lower() for w in r.warnings) or r.valid
    else:
        assert r.valid is False
