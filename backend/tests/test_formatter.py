import json

from app.services.formatter import code_formatter
from app.services.syntax_validator import syntax_validator


def test_format_python_black():
    code = 'def test():\nprint("hello")\nx=1+2\nreturn x\n'
    # Unformatted but valid? print at wrong indent is a syntax error in a def;
    # use a valid-but-ugly snippet instead.
    code = 'def test():\n  x=1+2\n  return x\n'
    result = code_formatter.format(code, "python")
    assert result.available is True
    assert result.formatter == "black"
    assert result.formatted != code
    assert "    x = 1 + 2" in result.formatted
    assert syntax_validator.validate(result.formatted, "python").valid


def test_format_python_preserves_syntax():
    code = 'def test():\n  x=1+2\n  return x\n'
    result = code_formatter.format(code, "python")
    assert syntax_validator.validate(result.formatted, "python").valid


def test_format_python_already_formatted():
    code = 'def test():\n    return 1\n'
    result = code_formatter.format(code, "python")
    assert result.available is True
    assert result.formatted == code


def test_format_python_invalid_rolls_back():
    code = "def test(:\n"
    result = code_formatter.format(code, "python")
    assert result.available is False
    assert result.formatted == code


def test_format_json():
    code = '{"a":1,"b":[2,3]}'
    result = code_formatter.format(code, "json")
    assert result.available is True
    parsed = json.loads(result.formatted)
    assert parsed == {"a": 1, "b": [2, 3]}
    assert "\n" in result.formatted


def test_format_json_invalid():
    result = code_formatter.format("{bad}", "json")
    assert result.available is False
    assert result.formatted == "{bad}"


def test_format_sql():
    code = "select id from users where id=1"
    result = code_formatter.format(code, "sql")
    assert result.available is True
    assert result.formatted != code


def test_format_unsupported_language_honest():
    result = code_formatter.format("fn main() {}", "rust")
    assert result.available is False
    assert "not available" in result.message.lower() or "unavailable" in result.message.lower() or "formatter" in result.message.lower()


def test_format_empty():
    result = code_formatter.format("   ", "python")
    assert result.available is False


def test_format_javascript_uses_real_prettier_or_honest_fallback():
    code = "function test(){const x=1+2;return x;}"
    result = code_formatter.format(code, "javascript")
    if result.available:
        assert result.formatter == "prettier"
        assert result.formatted != code
        assert syntax_validator.validate(result.formatted, "javascript").valid
    else:
        assert result.formatted == code
        assert "prettier" in result.message.lower() or "not available" in result.message.lower()
