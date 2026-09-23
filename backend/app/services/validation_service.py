import difflib
import hashlib
import time
import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.validation import Validation, ValidationIssue, ValidationLog
from app.services.language_detector import detect_language
from app.services.syntax_validator import syntax_validator
from app.services.security_scanner import security_scanner
from app.services.ollama_service import ollama_service
from app.services.formatter import code_formatter
from app.core.logging import logger

VALID_SEVERITIES = ("critical", "high", "medium", "low", "info")
SCORE_PENALTY = {"critical": 30, "high": 20, "medium": 10, "low": 5, "info": 0}


def compute_code_hash(code: str, language: str) -> str:
    normalized = code.replace("\r\n", "\n").replace("\r", "\n")
    return hashlib.sha256(f"{normalized}\n{language}".encode()).hexdigest()


def unified_diff_lines(original: str, modified: str) -> list[str]:
    return list(difflib.unified_diff(
        original.splitlines(), modified.splitlines(), lineterm=""))


class ValidationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ---------------- VALIDATE ----------------

    async def validate_code(self, code: str, language: Optional[str] = None, model: Optional[str] = None, project_id: Optional[str] = None) -> dict:
        started = time.perf_counter()
        code = code.replace("\r\n", "\n").replace("\r", "\n")
        model = model or ollama_service.default_model

        if not language or language == "auto":
            detection = detect_language(code)
            language = detection.language
            detection_confidence = detection.confidence
            detection_method = detection.method
        else:
            detection_confidence = 1.0
            detection_method = "user"

        code_hash = compute_code_hash(code, language)
        timestamp = int(time.time())
        nlines = max(len(code.split("\n")), 1)

        validation = Validation(
            id=uuid.uuid4(),
            language=language,
            model=model,
            status="running",
            code=code,
            code_hash=code_hash,
            project_id=project_id,
        )
        self.db.add(validation)
        await self.db.flush()

        await self._log(validation.id, "language_detection", "passed")

        # 1. Real language parser (never regex, never the LLM).
        syntax_result = syntax_validator.validate(code, language)
        await self._log(validation.id, "syntax_validation", "passed" if syntax_result.valid else "failed")

        # 2. Deterministic static analysis.
        security_issues = security_scanner.scan(code, language)
        await self._log(validation.id, "security_scan", "completed")

        all_issues: list[dict] = []
        counter = 0

        for err in syntax_result.errors:
            counter += 1
            all_issues.append({
                "id": f"syntax-{language}-{counter:03d}",
                "title": err.message,
                "description": f"Syntax error: {err.message}",
                "severity": "high",
                "category": "syntax",
                "line": err.line,
                "column": max(err.column, 1),
                "endLine": err.end_line or err.line,
                "endColumn": err.end_column,
                "evidence": err.evidence,
                "recommendation": "Fix the syntax error.",
                "confidence": 1.0,
                "source": f"{language}-parser",
            })

        for sec in security_issues:
            counter += 1
            col = self._evidence_column(code, sec.line_number, sec.evidence)
            all_issues.append({
                "id": f"static-{sec.category}-{counter:03d}",
                "title": sec.title,
                "description": sec.description,
                "severity": sec.severity if sec.severity in VALID_SEVERITIES else "medium",
                "category": sec.category,
                "line": sec.line_number,
                "column": col,
                "endLine": sec.line_number,
                "endColumn": col + len(sec.evidence) if sec.evidence else None,
                "evidence": sec.evidence,
                "recommendation": sec.recommendation,
                "confidence": sec.confidence,
                "source": "security-scanner",
            })

        # 3. Ollama reasoning layer, with parser + static findings as context
        # so it analyzes instead of repeating them.
        await self._log(validation.id, "ollama_analysis", "started")
        context_lines = []
        for issue in all_issues:
            context_lines.append(
                f"Line {issue['line']}: [{issue['category']}] {issue['title']} - already reported, do not repeat.")
        llm_result = await ollama_service.analyze_code(
            code, language, model, action="validate",
            extra_context="\n".join(context_lines[:30]))
        await self._log(validation.id, "ollama_analysis", "completed")
        ollama_available = llm_result.get("ollama_available", True)

        if llm_result and isinstance(llm_result.get("issues"), list):
            for item in llm_result["issues"]:
                counter += 1
                line = item.get("line", item.get("line_number", 1))
                try:
                    line = int(line)
                except (TypeError, ValueError):
                    line = 1
                if line < 1 or line > nlines:
                    continue
                col = item.get("column", item.get("col", 1))
                try:
                    col = int(col)
                except (TypeError, ValueError):
                    col = 1
                all_issues.append({
                    "id": f"ollama-{item.get('category', 'quality')}-{counter:03d}",
                    "title": item.get("title", "Unknown issue"),
                    "description": item.get("description", ""),
                    "severity": item.get("severity", "low"),
                    "category": item.get("category", "quality"),
                    "line": line,
                    "column": max(col, 1),
                    "endLine": line,
                    "endColumn": None,
                    "evidence": item.get("evidence"),
                    "recommendation": item.get("recommendation", ""),
                    "confidence": item.get("confidence", 0.5),
                    "source": "ollama",
                })

        improvements = llm_result.get("improvements", []) if llm_result else []
        if not syntax_result.valid and not ollama_available:
            improvements = ["Fix syntax errors before AI analysis can provide additional insights."]

        # 4. Deduplicate, then score.
        all_issues = self._deduplicate(all_issues)
        score = self._calculate_score(all_issues)

        for issue_data in all_issues:
            issue = ValidationIssue(
                id=uuid.uuid4(),
                validation_id=validation.id,
                severity=issue_data["severity"],
                category=issue_data["category"],
                line_number=issue_data.get("line"),
                title=issue_data["title"],
                description=issue_data.get("description"),
                recommendation=issue_data.get("recommendation"),
                confidence=issue_data.get("confidence"),
                evidence=issue_data.get("evidence"),
            )
            self.db.add(issue)

        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        for issue in all_issues:
            sev = issue.get("severity", "low")
            if sev in severity_counts:
                severity_counts[sev] += 1

        if severity_counts["critical"] > 0:
            status = "error"
        elif severity_counts["high"] > 0 or severity_counts["medium"] > 0:
            status = "warning"
        elif syntax_result.warnings:
            status = "warning"
        else:
            status = "passed"

        validation.status = status
        validation.score = score
        validation.syntax_valid = syntax_result.valid
        duration_ms = int((time.perf_counter() - started) * 1000)
        validation.duration_ms = duration_ms
        await self._log(validation.id, "total", "completed", duration_ms=duration_ms)
        await self.db.flush()

        return {
            "validation_id": str(validation.id),
            "status": status,
            "language": language,
            "model": model,
            "score": score,
            "duration_ms": duration_ms,
            "total_issues": len(all_issues),
            "critical": severity_counts["critical"],
            "high": severity_counts["high"],
            "medium": severity_counts["medium"],
            "low": severity_counts["low"],
            "info": severity_counts["info"],
            "issues": all_issues,
            "improvements": improvements,
            "corrected_code": None,
            "syntax_valid": syntax_result.valid,
            "syntax_warnings": syntax_result.warnings,
            "syntax_parser": syntax_result.parser,
            "detection_confidence": detection_confidence,
            "detection_method": detection_method,
            "code_hash": code_hash,
            "timestamp": timestamp,
            "ollama_available": ollama_available,
            "ollama_error": None if ollama_available else "Unable to connect to the configured Ollama server.",
        }

    # ---------------- FIX CODE ----------------

    async def fix_code(self, code: str, issues: list[dict], language: str, model: Optional[str] = None, target: Optional[dict] = None) -> dict:
        code = code.replace("\r\n", "\n").replace("\r", "\n")
        model = model or ollama_service.default_model
        focus = target or (issues[0] if issues else None)

        if focus:
            context = (
                "Fix this ONE specific issue. Leave everything else unchanged.\n"
                f"Issue: {focus.get('title', '')}\n"
                f"Category: {focus.get('category', '')}\n"
                f"Severity: {focus.get('severity', '')}\n"
                f"Location: line {focus.get('line', focus.get('line_number', '?'))}, "
                f"column {focus.get('column', '?')}\n"
                f"Evidence: {focus.get('evidence', '')}\n"
                f"Recommendation: {focus.get('recommendation', '')}\n"
            )
            if len(issues) > 1:
                others = [f"Line {i.get('line', i.get('line_number', '?'))}: {i.get('title', '')}"
                          for i in issues[1:6]]
                context += "Other known issues (do NOT fix these now):\n" + "\n".join(others)
        else:
            context = "No specific issue was selected. Fix any clear bug while preserving behavior."

        def _extract_fixed(result: dict) -> str:
            if not result:
                return ""
            raw = result.get("fixed_code", "")
            if isinstance(raw, str) and raw.strip():
                return ollama_service._unfence(raw).strip()
            # Non-JSON mode: model may return the full file alone or fenced.
            if result.get("ollama_available") and not raw:
                alt = ollama_service.extract_code(str(result.get("_raw", "")))
                if alt:
                    return alt.strip()
            return ""

        def _is_stub(candidate: str, original: str) -> bool:
            """Reject 'fixed_code': \"code\" style stubs from truncated JSON mode."""
            if not candidate or not candidate.strip():
                return True
            cand = candidate.strip()
            orig_lines = [ln for ln in original.splitlines() if ln.strip()]
            if len(cand) < 40 and len(orig_lines) >= 3:
                return True
            # Must retain a meaningful share of the original file.
            if len(orig_lines) >= 3:
                retained = sum(1 for ln in orig_lines if ln.strip() in cand)
                if retained / len(orig_lines) < 0.5:
                    return True
            return False

        result = await ollama_service.analyze_code(code, language, model, action="fix", extra_context=context)
        if not result.get("ollama_available", True) and not result.get("fixed_code"):
            return self._fix_response(code, code, [], "offline",
                                      "Unable to connect to the configured Ollama server.",
                                      focus, syntax_valid=None, resolved=False)
        fixed_code = _extract_fixed(result)
        changes = result.get("changes_made", []) if result else []
        if _is_stub(fixed_code, code):
            retry = await ollama_service.analyze_code(
                code, language, model, action="fix",
                extra_context=context +
                "\nYour previous response was a stub, not the full source file. "
                "Return EVERY line of the corrected file in fixed_code.",
            )
            retried = _extract_fixed(retry)
            if retried and not _is_stub(retried, code):
                fixed_code = retried
                changes = retry.get("changes_made", changes)
            else:
                fixed_code = ""

        # Identical output -> one stronger retry, then give up honestly.
        if fixed_code and self._same_code(fixed_code, code):
            retry = await ollama_service.analyze_code(
                code, language, model, action="fix",
                extra_context=context + "\nYour previous response made NO changes. "
                "You MUST modify the code to resolve the reported issue.")
            retried = _extract_fixed(retry)
            if retried and not _is_stub(retried, code):
                fixed_code = retried
                changes = retry.get("changes_made", changes)
            if not fixed_code or self._same_code(fixed_code, code):
                return self._fix_response(code, code, changes if isinstance(changes, list) else [],
                                          "no_change", "No change was generated. "
                                          "Unable to generate a safe fix automatically.",
                                          focus, syntax_valid=True, resolved=False)

        if not fixed_code:
            return self._fix_response(code, code, [], "failed",
                                      "The model returned no usable fix.", focus,
                                      syntax_valid=None, resolved=False)

        # Generated code must be syntactically valid: one correction pass max.
        check = syntax_validator.validate(fixed_code, language)
        if not check.valid:
            correction = await ollama_service.analyze_code(
                fixed_code, language, model, action="fix",
                extra_context=f"Your corrected code has a syntax error: "
                f"{check.errors[0].message if check.errors else 'unknown'} "
                f"(line {check.errors[0].line if check.errors else '?'}). "
                "Return the full code with the syntax error corrected.")
            corrected = _extract_fixed(correction)
            if corrected:
                fixed_code = corrected
                changes = correction.get("changes_made", changes)
                check = syntax_validator.validate(fixed_code, language)
            if not check.valid:
                return self._fix_response(code, code, changes if isinstance(changes, list) else [],
                                          "rejected", "Generated fix contains a syntax error.",
                                          focus, syntax_valid=False, resolved=False)

        # Revalidate: the original issue must actually be gone.
        resolved = self._issue_resolved(code, fixed_code, language, focus)
        if focus and not resolved:
            return self._fix_response(code, fixed_code, changes if isinstance(changes, list) else [],
                                      "unresolved", "The proposed fix did not resolve the reported issue.",
                                      focus, syntax_valid=True, resolved=False)

        return self._fix_response(code, fixed_code, changes if isinstance(changes, list) else [],
                                  "ready", "Fix generated successfully.", focus,
                                  syntax_valid=True, resolved=True if focus else None)

    def _fix_response(self, original: str, fixed: str, changes: list, status: str,
                      message: str, focus: Optional[dict], syntax_valid: Optional[bool],
                      resolved: Optional[bool]) -> dict:
        return {
            "original_code": original,
            "fixed_code": fixed,
            "explanation": changes,
            "diff": unified_diff_lines(original, fixed),
            "status": status,
            "message": message,
            "syntax_valid": syntax_valid,
            "issue_resolved": resolved,
            "target": {
                "title": (focus or {}).get("title"),
                "line": (focus or {}).get("line", (focus or {}).get("line_number")),
                "column": (focus or {}).get("column"),
            } if focus else None,
        }

    @staticmethod
    def _same_code(a: str, b: str) -> bool:
        return a.strip() == b.strip()

    def _issue_resolved(self, original: str, fixed: str, language: str, focus: Optional[dict]) -> bool:
        if not focus:
            return True
        if self._same_code(original, fixed):
            return False
        category = str(focus.get("category", "")).lower()
        title = str(focus.get("title", "")).lower()
        if category == "syntax":
            return syntax_validator.validate(fixed, language).valid
        if category in ("injection", "secrets", "xss", "path_traversal", "cryptography",
                        "deserialization", "insecure_transport", "configuration", "permissions",
                        "error_handling", "network", "security"):
            before = {(s.title.lower(), s.line_number) for s in security_scanner.scan(original, language)}
            after = {(s.title.lower(), s.line_number) for s in security_scanner.scan(fixed, language)}
            key = next((k for k in before if k[0] in title or title in k[0]), None)
            if key is None:
                # Focus issue was not reproduced by the static scanner; fall back to
                # evidence check: the offending snippet should be gone or changed.
                evidence = str(focus.get("evidence", "")).strip()
                if evidence and evidence not in fixed:
                    return True
                return False
            return key not in after
        # Logic/performance/quality: evidence snippet should be gone or changed.
        evidence = str(focus.get("evidence", "")).strip()
        if evidence and evidence not in fixed:
            return True
        return False

    # ---------------- FORMAT ----------------

    async def format_code(self, code: str, language: Optional[str] = None) -> dict:
        code = code.replace("\r\n", "\n").replace("\r", "\n")
        if not language or language == "auto":
            detection = detect_language(code)
            language = detection.language
            detection_confidence = detection.confidence
        else:
            detection_confidence = 1.0
        if language == "unknown":
            return {
                "original_code": code, "formatted_code": code, "diff": [],
                "formatter": "none", "available": False,
                "message": "Could not detect the language. Select a language to format.",
                "language": language, "syntax_valid": None,
            }
        result = code_formatter.format(code, language)
        syntax_valid: Optional[bool] = None
        syntax_message = ""
        if result.available and result.formatted != code:
            check = syntax_validator.validate(result.formatted, language)
            syntax_valid = check.valid
            if not check.valid:
                return {
                    "original_code": code, "formatted_code": code, "diff": [],
                    "formatter": result.formatter, "available": False,
                    "message": "Formatter output failed syntax validation; original kept.",
                    "language": language, "syntax_valid": False,
                }
        elif result.available:
            syntax_valid = syntax_validator.validate(code, language).valid
        return {
            "original_code": code,
            "formatted_code": result.formatted if result.available else code,
            "diff": unified_diff_lines(code, result.formatted) if result.available else [],
            "formatter": result.formatter,
            "available": result.available,
            "message": result.message,
            "language": language,
            "detection_confidence": detection_confidence,
            "syntax_valid": syntax_valid,
        }

    # ---------------- helpers ----------------

    @staticmethod
    def _evidence_column(code: str, line_number: int, evidence: Optional[str]) -> int:
        try:
            lines = code.split("\n")
            line = lines[line_number - 1] if 1 <= line_number <= len(lines) else ""
            if evidence and evidence.strip() and evidence.strip() in line:
                return line.index(evidence.strip()) + 1
        except (IndexError, ValueError):
            pass
        return 1

    SECURITY_GROUP = {"security", "injection", "secrets", "xss", "path_traversal",
                      "cryptography", "deserialization", "insecure_transport",
                      "configuration", "permissions", "error_handling", "network"}
    BUG_GROUP = {"bug", "logic"}

    @classmethod
    def _category_group(cls, category: str) -> str:
        category = str(category or "").lower()
        if category in cls.SECURITY_GROUP:
            return "security"
        if category in cls.BUG_GROUP:
            return "bug"
        return category

    def _deduplicate(self, issues: list[dict]) -> list[dict]:
        seen: dict[tuple, dict] = {}
        syntax_lines = {i["line"] for i in issues if i.get("source", "").endswith("-parser")}
        for issue in issues:
            # An LLM logic/quality remark on a line with a real syntax error is noise.
            if (issue.get("source") == "ollama"
                    and issue.get("line") in syntax_lines
                    and issue.get("category") in ("logic", "quality")
                    and (issue.get("confidence") or 0) < 0.8):
                continue
            key = (issue.get("line"), self._category_group(issue.get("category", "")),
                   str(issue.get("title", "")).lower().strip()[:60])
            existing = seen.get(key)
            if existing is None:
                seen[key] = issue
            elif (issue.get("confidence") or 0) > (existing.get("confidence") or 0):
                seen[key] = issue
        return list(seen.values())

    def _calculate_score(self, issues: list[dict]) -> int:
        score = 100
        for issue in issues:
            score -= SCORE_PENALTY.get(issue.get("severity", "low"), 5)
        return max(0, min(100, score))

    async def explain_code(self, code: str, language: str, model: Optional[str] = None) -> dict:
        model = model or ollama_service.default_model
        return await ollama_service.analyze_code(code, language, model, action="explain")

    async def find_bugs(self, code: str, language: str, model: Optional[str] = None) -> dict:
        model = model or ollama_service.default_model
        return await ollama_service.analyze_code(code, language, model, action="find_bugs")

    async def security_scan(self, code: str, language: str, model: Optional[str] = None) -> dict:
        model = model or ollama_service.default_model
        static_issues = security_scanner.scan(code, language)
        llm_result = await ollama_service.analyze_code(code, language, model, action="security")

        combined = []
        for sec in static_issues:
            combined.append({
                "severity": sec.severity,
                "category": sec.category,
                "line_number": sec.line_number,
                "title": sec.title,
                "description": sec.description,
                "recommendation": sec.recommendation,
                "confidence": sec.confidence,
                "evidence": sec.evidence,
            })
        if llm_result and "issues" in llm_result:
            for iss in llm_result["issues"]:
                is_duplicate = any(
                    existing["line_number"] == iss.get("line") and existing["category"] == iss.get("category")
                    for existing in combined
                )
                if not is_duplicate:
                    combined.append(iss)

        return {"language": language, "issues": combined}

    async def optimize_code(self, code: str, language: str, model: Optional[str] = None) -> dict:
        model = model or ollama_service.default_model
        return await ollama_service.analyze_code(code, language, model, action="optimize")

    async def generate_tests(self, code: str, language: str, model: Optional[str] = None) -> dict:
        model = model or ollama_service.default_model
        return await ollama_service.analyze_code(code, language, model, action="test")

    async def document_code(self, code: str, language: str, model: Optional[str] = None) -> dict:
        model = model or ollama_service.default_model
        return await ollama_service.analyze_code(code, language, model, action="document")

    async def _log(self, validation_id, stage: str, status: str, duration_ms: int = None):
        log = ValidationLog(
            id=uuid.uuid4(),
            validation_id=validation_id,
            stage=stage,
            status=status,
            duration_ms=duration_ms,
        )
        self.db.add(log)
