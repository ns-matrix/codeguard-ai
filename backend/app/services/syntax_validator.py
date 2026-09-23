import ast
import json
import re
import shutil
import subprocess
import tempfile
import os
from dataclasses import dataclass, field
from html.parser import HTMLParser


@dataclass
class SyntaxIssue:
    line: int
    column: int
    message: str
    evidence: str | None = None
    end_line: int | None = None
    end_column: int | None = None


@dataclass
class ValidationResult:
    valid: bool
    errors: list[SyntaxIssue] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    parser: str = "none"
    unavailable: bool = False


UNAVAILABLE_MSG = "Syntax validation unavailable for this language."


def _line_of(code: str, lineno: int) -> str | None:
    lines = code.split("\n")
    if lineno and 1 <= lineno <= len(lines):
        return lines[lineno - 1].strip()[:200] or None
    return None


_prettier_path: str | None | bool = None


def _clean_tool_message(msg: str, tmp_path: str) -> str:
    """Strip ANSI colors and temp-file paths from external tool errors."""
    msg = re.sub(r"\x1b\[[0-9;]*m", "", msg)
    msg = msg.replace(tmp_path, "input")
    msg = re.sub(r"[^\s:]*input", "input", msg)
    msg = re.sub(r"^\[?(error|warn)\]?\s*", "", msg, flags=re.IGNORECASE)
    lines = [ln.strip() for ln in msg.strip().split("\n") if ln.strip()]
    for ln in lines:
        if "SyntaxError" in ln or "error" in ln.lower():
            return ln[:300]
    return (lines[0] if lines else "Syntax error")[:300]


_bash_works: bool | None = None


def _bash_exe() -> str | None:
    """Return a working bash binary, or None. Probes once (Windows stubs hang)."""
    global _bash_works
    exe = shutil.which("bash")
    if not exe:
        return None
    if _bash_works is None:
        try:
            with tempfile.NamedTemporaryFile("w", suffix=".sh", delete=False, encoding="utf-8") as f:
                f.write("echo probe\n")
                path = f.name
            try:
                r = subprocess.run([exe, "-n", path], capture_output=True, text=True, timeout=8)
                _bash_works = r.returncode == 0
            finally:
                try:
                    os.unlink(path)
                except OSError:
                    pass
        except Exception:
            _bash_works = False
    return exe if _bash_works else None


def _find_prettier() -> str | None:
    global _prettier_path
    if _prettier_path is not None:
        return _prettier_path or None
    found = shutil.which("prettier")
    if not found:
        for candidate in [
            os.path.expandvars(r"%APPDATA%\npm\prettier.cmd"),
            "/usr/local/bin/prettier",
            "/usr/bin/prettier",
        ]:
            if candidate and os.path.isfile(candidate):
                found = candidate
                break
    _prettier_path = found or False
    return found


def _run_prettier_check(code: str, parser: str) -> tuple[bool, str]:
    """Use Prettier's real parser (babel/babel-ts/postcss) as a syntax check.

    Returns (ok, error_message). Raises FileNotFoundError if prettier missing.
    """
    exe = _find_prettier()
    if not exe:
        raise FileNotFoundError("prettier not installed")
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as f:
        f.write(code)
        path = f.name
    try:
        result = subprocess.run(
            [exe, "--parser", parser, "--log-level", "error", path],
            capture_output=True, text=True, timeout=30,
        )
        raw = (result.stderr or result.stdout or "").strip()[:500]
        raw = raw.replace(os.path.basename(path), "input")
        return result.returncode == 0, _clean_tool_message(raw, path)
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def _strip_c_strings(code: str) -> str:
    """Remove string/char literals and comments so brace counting is honest."""
    out = []
    i, n = 0, len(code)
    state = None  # None, '"', "'", '//', '/*'
    while i < n:
        c = code[i]
        nxt = code[i + 1] if i + 1 < n else ""
        if state is None:
            if c == "/" and nxt == "/":
                state = "//"
                i += 2
                continue
            if c == "/" and nxt == "*":
                state = "/*"
                i += 2
                continue
            if c in ("'", '"'):
                state = c
                out.append(" ")
                i += 1
                continue
            out.append(c)
            i += 1
        elif state == "//":
            if c == "\n":
                state = None
                out.append(c)
            i += 1
        elif state == "/*":
            if c == "*" and nxt == "/":
                state = None
                i += 2
            else:
                if c == "\n":
                    out.append(c)
                i += 1
        else:  # inside '...' or "..."
            if c == "\\":
                i += 2
                continue
            if c == state:
                state = None
                out.append(" ")
            elif c == "\n":
                out.append(c)
            i += 1
    return "".join(out)


class _TagCollector(HTMLParser):
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
            "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self, code: str = ""):
        super().__init__(convert_charrefs=True)
        self.code = code
        self.stack: list[tuple[str, int, int]] = []
        self.errors: list[SyntaxIssue] = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() not in self.VOID:
            self.stack.append((tag.lower(), self.getpos()[0], self.getpos()[1]))

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in self.VOID:
            return
        if not self.stack:
            self.errors.append(SyntaxIssue(
                line=self.getpos()[0], column=self.getpos()[1],
                message=f"Closing </{tag}> without matching opening tag",
                evidence=_line_of(self.code, self.getpos()[0]),
            ))
            return
        if self.stack[-1][0] == tag:
            self.stack.pop()
            return
        # Mismatched nesting: record it, then pop up to the matching opener.
        expected = self.stack[-1][0]
        self.errors.append(SyntaxIssue(
            line=self.getpos()[0], column=self.getpos()[1],
            message=f"Mismatched tag: expected </{expected}> but found </{tag}>",
            evidence=_line_of(self.code, self.getpos()[0]),
        ))
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                return

    def unclosed(self, code: str) -> list[SyntaxIssue]:
        out = list(self.errors)
        for tag, line, col in self.stack:
            out.append(SyntaxIssue(
                line=line, column=col,
                message=f"Unclosed <{tag}> tag",
                evidence=_line_of(code, line),
            ))
        return out


class SyntaxValidator:
    def validate(self, code: str, language: str) -> ValidationResult:
        validators = {
            "python": self._validate_python,
            "javascript": self._validate_javascript,
            "typescript": self._validate_typescript,
            "json": self._validate_json,
            "sql": self._validate_sql,
            "html": self._validate_html,
            "css": self._validate_css,
            "yaml": self._validate_yaml,
            "bash": self._validate_bash,
            "java": self._validate_compiled,
            "c": self._validate_compiled,
            "cpp": self._validate_compiled,
            "csharp": self._validate_compiled,
            "go": self._validate_compiled,
            "rust": self._validate_compiled,
            "php": self._validate_compiled,
        }
        validator = validators.get(language, self._validate_noop)
        if getattr(validator, "__func__", None) is SyntaxValidator._validate_compiled:
            return validator(code, language)
        return validator(code)

    def _validate_noop(self, code: str) -> ValidationResult:
        return ValidationResult(valid=True, warnings=[UNAVAILABLE_MSG],
                                parser="none", unavailable=True)

    def _validate_python(self, code: str) -> ValidationResult:
        errors: list[SyntaxIssue] = []
        warnings: list[str] = []
        try:
            ast.parse(code)
        except SyntaxError as e:
            errors.append(SyntaxIssue(
                line=e.lineno or 0,
                column=(e.offset or 1) - 1,
                end_line=e.end_lineno,
                end_column=(e.end_offset - 1) if e.end_offset else None,
                message=str(e.msg),
                evidence=_line_of(code, e.lineno or 0),
            ))
        except Exception as e:
            errors.append(SyntaxIssue(line=0, column=0, message=f"Parse error: {e}"))

        if code.strip() and not code.endswith("\n"):
            warnings.append("File does not end with newline")
        return ValidationResult(valid=len(errors) == 0, errors=errors,
                                warnings=warnings, parser="python-ast")

    def _validate_javascript(self, code: str) -> ValidationResult:
        errors: list[SyntaxIssue] = []
        warnings: list[str] = []
        node = shutil.which("node")
        if node:
            with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
                f.write(code)
                path = f.name
            try:
                result = subprocess.run(
                    [node, "--check", path],
                    capture_output=True, text=True, timeout=15,
                )
                if result.returncode != 0:
                    raw = result.stderr or result.stdout or "Syntax error"
                    msg = _clean_tool_message(raw, path)
                    line, col = 0, 0
                    m = re.search(r":(\d+)(?::(\d+))?", raw)
                    if m:
                        line = int(m.group(1))
                        col = int(m.group(2)) - 1 if m.group(2) else 0
                    errors.append(SyntaxIssue(line=line, column=max(col, 0),
                                              message=msg, evidence=_line_of(code, line)))
            except subprocess.TimeoutExpired:
                warnings.append("JavaScript syntax check timed out")
            finally:
                try:
                    os.unlink(path)
                except OSError:
                    pass
            return ValidationResult(valid=len(errors) == 0, errors=errors,
                                    warnings=warnings, parser="node")
        # Fallback when node is missing: token-stripped brace/paren check.
        stripped = _strip_c_strings(code)
        for opener, closer, name in [("{", "}", "braces"), ("(", ")", "parentheses"), ("[", "]", "brackets")]:
            if stripped.count(opener) != stripped.count(closer):
                errors.append(SyntaxIssue(line=0, column=0,
                    message=f"Unmatched {name}: {abs(stripped.count(opener) - stripped.count(closer))} extra '{closer if stripped.count(opener) < stripped.count(closer) else opener}'"))
        if not errors:
            warnings.append("Node.js not found; only bracket balance was checked.")
        return ValidationResult(valid=len(errors) == 0, errors=errors,
                                warnings=warnings, parser="heuristic")

    def _validate_typescript(self, code: str) -> ValidationResult:
        try:
            ok, msg = _run_prettier_check(code, "babel-ts")
            result = ValidationResult(
                valid=ok,
                errors=[],
                warnings=[],
                parser="prettier/babel-ts",
            )
            if not ok:
                line, col = 0, 0
                m = re.search(r"\((\d+):(\d+)\)", msg)
                if m:
                    line, col = int(m.group(1)), int(m.group(2)) - 1
                first = msg.split("\n")[0][:300] if msg else "TypeScript syntax error"
                result.errors.append(SyntaxIssue(line=line, column=max(col, 0),
                                                 message=first,
                                                 evidence=_line_of(code, line)))
        except FileNotFoundError:
            result = self._validate_javascript(code)
            result.parser = "heuristic"
            result.warnings.append("TypeScript parser unavailable; JavaScript-level check only.")
        if ": any" in code:
            result.warnings.append("Avoid using 'any' type - consider a more specific type")
        return result

    def _validate_json(self, code: str) -> ValidationResult:
        errors: list[SyntaxIssue] = []
        try:
            json.loads(code)
        except json.JSONDecodeError as e:
            errors.append(SyntaxIssue(
                line=e.lineno or 0, column=(e.colno or 1) - 1,
                message=f"Invalid JSON: {e.msg}",
                evidence=_line_of(code, e.lineno or 0),
            ))
        return ValidationResult(valid=len(errors) == 0, errors=errors, parser="json")

    def _validate_sql(self, code: str) -> ValidationResult:
        warnings: list[str] = []
        upper = code.upper().strip()
        if not any(upper.startswith(kw) for kw in ["SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP", "WITH", "EXPLAIN"]):
            warnings.append("SQL statement does not start with a recognized keyword")
        stripped = re.sub(r"'[^']*'", "''", code)
        if stripped.count("(") != stripped.count(")"):
            return ValidationResult(valid=False, errors=[SyntaxIssue(
                line=0, column=0, message="Unbalanced parentheses in SQL statement")],
                warnings=warnings, parser="sqlparse")
        warnings.append("SQL is validated heuristically; use your database's EXPLAIN for full validation.")
        return ValidationResult(valid=True, errors=[], warnings=warnings, parser="sqlparse")

    def _validate_html(self, code: str) -> ValidationResult:
        warnings: list[str] = []
        if "<!DOCTYPE" not in code.upper() and "<html" not in code.lower():
            warnings.append("Missing DOCTYPE declaration or <html> tag")
        collector = _TagCollector(code)
        try:
            collector.feed(code)
        except Exception as e:
            return ValidationResult(valid=False, errors=[SyntaxIssue(
                line=0, column=0, message=f"HTML parse error: {e}")],
                warnings=warnings, parser="html.parser")
        errors = collector.unclosed(code)
        return ValidationResult(valid=len(errors) == 0, errors=errors,
                                warnings=warnings, parser="html.parser")

    def _validate_css(self, code: str) -> ValidationResult:
        errors: list[SyntaxIssue] = []
        warnings: list[str] = []
        try:
            ok, msg = _run_prettier_check(code, "css")
            if not ok:
                line, col = 0, 0
                m = re.search(r"\((\d+):(\d+)\)", msg)
                if m:
                    line, col = int(m.group(1)), int(m.group(2)) - 1
                errors.append(SyntaxIssue(line=line, column=max(col, 0),
                    message=(msg.split("\n")[0][:300] if msg else "CSS syntax error"),
                    evidence=_line_of(code, line)))
            return ValidationResult(valid=len(errors) == 0, errors=errors,
                                    warnings=warnings, parser="prettier/postcss")
        except FileNotFoundError:
            stripped = re.sub(r"/\*.*?\*/", "", code, flags=re.DOTALL)
            stripped = re.sub(r'"[^"]*"', '""', stripped)
            if stripped.count("{") != stripped.count("}"):
                errors.append(SyntaxIssue(line=0, column=0,
                    message=f"Unmatched braces in CSS: {abs(stripped.count('{') - stripped.count('}'))} extra"))
            else:
                warnings.append("CSS parser unavailable; only brace balance was checked.")
            return ValidationResult(valid=len(errors) == 0, errors=errors,
                                    warnings=warnings, parser="heuristic")

    def _validate_yaml(self, code: str) -> ValidationResult:
        warnings: list[str] = []
        try:
            import yaml
            try:
                yaml.safe_load(code)
            except yaml.YAMLError as e:
                problem = getattr(e, "problem", None) or str(e).split("\n")[0]
                mark = getattr(e, "problem_mark", None)
                line = (mark.line + 1) if mark else 0
                col = mark.column if mark else 0
                return ValidationResult(valid=False, errors=[SyntaxIssue(
                    line=line, column=col, message=f"Invalid YAML: {problem}",
                    evidence=_line_of(code, line))], parser="pyyaml")
            return ValidationResult(valid=True, parser="pyyaml")
        except ImportError:
            for i, line in enumerate(code.split("\n"), 1):
                if "\t" in line:
                    warnings.append(f"Line {i}: Tab character found; YAML requires spaces")
            return ValidationResult(valid=True, errors=[], warnings=warnings, parser="heuristic")

    def _validate_bash(self, code: str) -> ValidationResult:
        warnings: list[str] = []
        if not code.strip().startswith("#!"):
            warnings.append("Missing shebang line")
        bash = _bash_exe()
        if bash:
            with tempfile.NamedTemporaryFile("w", suffix=".sh", delete=False, encoding="utf-8") as f:
                f.write(code)
                path = f.name
            try:
                result = subprocess.run([bash, "-n", path], capture_output=True, text=True, timeout=15)
                if result.returncode != 0:
                    msg = (result.stderr or "Syntax error").strip().split("\n")[0][:300]
                    m = re.search(r"line\s+(\d+)", result.stderr or "")
                    line = int(m.group(1)) if m else 0
                    return ValidationResult(valid=False, errors=[SyntaxIssue(
                        line=line, column=0, message=msg, evidence=_line_of(code, line))],
                        warnings=warnings, parser="bash -n")
                return ValidationResult(valid=True, warnings=warnings, parser="bash -n")
            except subprocess.TimeoutExpired:
                warnings.append("Bash syntax check timed out")
                return ValidationResult(valid=True, warnings=warnings, parser="bash -n")
            finally:
                try:
                    os.unlink(path)
                except OSError:
                    pass
        for keyword, closer in [("if", "fi"), ("for", "done"), ("while", "done"), ("case", "esac")]:
            opens = len(re.findall(rf"(?m)^\s*{keyword}\b", code))
            closes = len(re.findall(rf"(?m)^\s*{closer}\b", code))
            if opens > closes:
                return ValidationResult(valid=False, errors=[SyntaxIssue(
                    line=0, column=0, message=f"Unclosed '{keyword}' block: missing '{closer}'")],
                    warnings=warnings, parser="heuristic")
        warnings.append(UNAVAILABLE_MSG + " Only block balance was checked.")
        return ValidationResult(valid=True, errors=[], warnings=warnings,
                                parser="heuristic", unavailable=True)

    def _validate_compiled(self, code: str, language: str) -> ValidationResult:
        """Compiled languages: try a real toolchain when present, else honest fallback."""
        toolchain = {
            "java": (["javac"], None),
            "c": (["gcc"], None),
            "cpp": (["g++", "gcc"], None),
            "csharp": (["dotnet", "csc", "mcs"], None),
            "go": (["go"], None),
            "rust": (["rustc"], None),
            "php": (["php"], ["-l"]),
        }.get(language, ([], None))
        binaries, extra = toolchain
        available = next((b for b in binaries if shutil.which(b)), None)
        if available and extra:
            suffix = ".php" if language == "php" else ".txt"
            with tempfile.NamedTemporaryFile("w", suffix=suffix, delete=False, encoding="utf-8") as f:
                f.write(code)
                path = f.name
            try:
                result = subprocess.run([available] + extra + [path],
                                        capture_output=True, text=True, timeout=30)
                if result.returncode != 0:
                    msg = ((result.stderr or result.stdout) or "Syntax error").strip().split("\n")[0][:300]
                    m = re.search(r"[Ll]ine\s+(\d+)|:(\d+):", result.stderr or result.stdout or "")
                    line = int(m.group(1) or m.group(2)) if m else 0
                    return ValidationResult(valid=False, errors=[SyntaxIssue(
                        line=line, column=0, message=msg, evidence=_line_of(code, line))],
                        parser=available)
                return ValidationResult(valid=True, parser=available)
            except subprocess.TimeoutExpired:
                return ValidationResult(valid=True, warnings=["Compiler check timed out"], parser=available)
            finally:
                try:
                    os.unlink(path)
                except OSError:
                    pass
        # No toolchain: strings/comments-stripped balance check (evidence-based only).
        stripped = _strip_c_strings(code)
        for opener, closer, name in [("{", "}", "braces"), ("(", ")", "parentheses")]:
            diff = stripped.count(opener) - stripped.count(closer)
            if diff != 0:
                return ValidationResult(valid=False, errors=[SyntaxIssue(
                    line=0, column=0,
                    message=f"Unmatched {name}: {abs(diff)} extra '{closer if diff < 0 else opener}'")],
                    warnings=[UNAVAILABLE_MSG + " A real compiler is not installed."],
                    parser="heuristic")
        return ValidationResult(valid=True, warnings=[UNAVAILABLE_MSG + " A real compiler is not installed."],
                                parser="none", unavailable=True)


syntax_validator = SyntaxValidator()
