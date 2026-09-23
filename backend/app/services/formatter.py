import json
import os
import subprocess
import tempfile
from dataclasses import dataclass

from app.services.syntax_validator import _find_prettier

UNAVAILABLE = "Formatter is not available for this language."


@dataclass
class FormatResult:
    available: bool
    formatted: str
    formatter: str
    message: str


PRETTIER_PARSERS = {
    "javascript": "babel",
    "typescript": "babel-ts",
    "html": "html",
    "css": "css",
    "markdown": "markdown",
}


class CodeFormatter:
    """Deterministic, language-specific formatters. Never an LLM fake."""

    def format(self, code: str, language: str) -> FormatResult:
        if not code.strip():
            return FormatResult(False, code, "none", "No code to format.")
        handler = {
            "python": self._format_python,
            "json": self._format_json,
            "sql": self._format_sql,
            "javascript": self._format_prettier,
            "typescript": self._format_prettier,
            "html": self._format_prettier,
            "css": self._format_prettier,
            "markdown": self._format_prettier,
        }.get(language)
        if not handler:
            return FormatResult(False, code, "none", UNAVAILABLE)
        return handler(code, language)

    def _format_python(self, code: str, language: str) -> FormatResult:
        try:
            import black
        except ImportError:
            return FormatResult(False, code, "none",
                                "Python formatter (black) is not installed.")
        try:
            formatted = black.format_str(code, mode=black.Mode())
            if formatted == code:
                return FormatResult(True, formatted, "black", "Code is already formatted.")
            return FormatResult(True, formatted, "black",
                                "Formatting only - program logic unchanged.")
        except Exception as e:
            return FormatResult(False, code, "black",
                                f"Cannot format: invalid Python ({str(e).splitlines()[0][:200]})")

    def _format_json(self, code: str, language: str) -> FormatResult:
        try:
            parsed = json.loads(code)
        except json.JSONDecodeError as e:
            return FormatResult(False, code, "json",
                                f"Cannot format: invalid JSON ({e.msg} at line {e.lineno})")
        formatted = json.dumps(parsed, indent=2, ensure_ascii=False) + "\n"
        if formatted == code:
            return FormatResult(True, formatted, "json", "Code is already formatted.")
        return FormatResult(True, formatted, "json",
                            "Formatting only - program logic unchanged.")

    def _format_sql(self, code: str, language: str) -> FormatResult:
        try:
            import sqlparse
        except ImportError:
            return FormatResult(False, code, "none",
                                "SQL formatter (sqlparse) is not installed.")
        formatted = sqlparse.format(code, reindent=True, keyword_case="upper")
        if not formatted.strip():
            return FormatResult(False, code, "sqlparse", "Cannot format empty SQL.")
        if formatted == code:
            return FormatResult(True, formatted, "sqlparse", "Code is already formatted.")
        return FormatResult(True, formatted, "sqlparse",
                            "Formatting only - program logic unchanged.")

    def _format_prettier(self, code: str, language: str) -> FormatResult:
        exe = _find_prettier()
        if not exe:
            return FormatResult(False, code, "none",
                                "Prettier is not installed. " + UNAVAILABLE)
        parser = PRETTIER_PARSERS.get(language, "babel")
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as f:
            f.write(code)
            path = f.name
        try:
            result = subprocess.run(
                [exe, "--parser", parser, path],
                capture_output=True, text=True, timeout=30,
            )
            if result.returncode != 0:
                err = (result.stderr or "syntax error").strip().split("\n")[0][:200]
                return FormatResult(False, code, "prettier", f"Cannot format: {err}")
            formatted = result.stdout
            if formatted == code:
                return FormatResult(True, formatted, "prettier", "Code is already formatted.")
            return FormatResult(True, formatted, "prettier",
                                "Formatting only - program logic unchanged.")
        except subprocess.TimeoutExpired:
            return FormatResult(False, code, "prettier", "Formatter timed out.")
        finally:
            try:
                os.unlink(path)
            except OSError:
                pass


code_formatter = CodeFormatter()
