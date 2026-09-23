import re
from dataclasses import dataclass, field


@dataclass
class SecurityIssue:
    severity: str
    category: str
    line_number: int
    title: str
    description: str
    recommendation: str
    confidence: float
    evidence: str


class SecurityScanner:
    def scan(self, code: str, language: str) -> list[SecurityIssue]:
        issues = []
        issues.extend(self._scan_secrets(code))
        issues.extend(self._scan_injection(code, language))
        issues.extend(self._scan_insecure_patterns(code, language))
        issues.extend(self._scan_crypto(code))
        issues.extend(self._scan_network(code))
        if language == "sql":
            issues.extend(self._scan_sql_specific(code))
        return issues

    @staticmethod
    def _mask_secret(line: str) -> str:
        """Mask quoted secret values so raw credentials never reach logs/history."""
        return re.sub(r'(["\'])([^"\']{2,})\1', r'\1****\1', line)

    def _scan_secrets(self, code: str) -> list[SecurityIssue]:
        issues = []
        patterns = [
            (r'(?i)(password|passwd|pwd)\s*[=:]\s*["\'][^"\']+["\']', "Hardcoded password", "Remove hardcoded credentials and use environment variables or a secrets manager."),
            (r'(?i)(api_key|apikey|api_secret|secret_key)\s*[=:]\s*["\'][^"\']+["\']', "Hardcoded API key", "Store API keys in environment variables, not in source code."),
            (r'(?i)(access_token|auth_token|bearer)\s*[=:]\s*["\'][^"\']+["\']', "Hardcoded token", "Use environment variables or a secure vault for tokens."),
            (r'(?i)(private_key)\s*[=:]\s*["\'][^"\']+["\']', "Hardcoded private key", "Never commit private keys. Use a secrets manager."),
            (r'-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----', "Embedded private key", "Remove the private key from source code immediately."),
        ]

        for i, line in enumerate(code.split("\n"), 1):
            for pattern, title, rec in patterns:
                if re.search(pattern, line):
                    issues.append(SecurityIssue(
                        severity="critical",
                        category="secrets",
                        line_number=i,
                        title=title,
                        description=f"Sensitive credential found in source code on line {i}.",
                        recommendation=rec,
                        confidence=0.95,
                        evidence=self._mask_secret(line.strip())[:100],
                    ))
        return issues

    def _scan_injection(self, code: str, language: str) -> list[SecurityIssue]:
        issues = []
        lines = code.split("\n")

        for i, line in enumerate(lines, 1):
            stripped = line.strip()

            if re.search(r'(?i)(execute|query|cursor)\s*\(\s*["\'].*(%s|%d|\{|\+\s*\w+)', stripped):
                issues.append(SecurityIssue(
                    severity="critical",
                    category="injection",
                    line_number=i,
                    title="SQL injection risk",
                    description="Dynamic SQL query construction using string interpolation or concatenation.",
                    recommendation="Use parameterized queries or prepared statements.",
                    confidence=0.90,
                    evidence=stripped[:100],
                ))

            if re.search(r'(?i)(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE).*["\']?\s*\+\s*\w+', stripped):
                if not re.search(r'(?i)(parameterized|placeholder|bind|\?\s*;|%s)', stripped):
                    issues.append(SecurityIssue(
                        severity="high",
                        category="injection",
                        line_number=i,
                        title="SQL injection risk",
                        description="SQL query constructed with string concatenation. User input may be injected.",
                        recommendation="Use parameterized queries instead of string concatenation.",
                        confidence=0.85,
                        evidence=stripped[:100],
                    ))

            if language in ("python", "bash"):
                if re.search(r'(?i)(os\.system|os\.popen|subprocess\.call|subprocess\.run|subprocess\.Popen|exec\(|eval\()', stripped):
                    has_concat = re.search(r'(os\.system|os\.popen|subprocess\.\w+\(.*\+|subprocess\.\w+\(.*%|exec\(.+|eval\(.+)', stripped)
                    has_var = re.search(r'(os\.system|os\.popen|subprocess\.\w+\(.*\b(os|input|argv|environ|request|params|args|cmd|command)\b|exec\(\s*\b(input|argv|cmd|command)\b|eval\(\s*\b(input|argv|cmd|command)\b)', stripped)
                    if has_concat or has_var:
                        issues.append(SecurityIssue(
                            severity="critical",
                            category="injection",
                            line_number=i,
                            title="Command injection risk",
                            description="System command executed with potentially user-controlled input.",
                            recommendation="Use subprocess with shell=False and a list of arguments. Validate and sanitize all inputs.",
                            confidence=0.85,
                            evidence=stripped[:100],
                        ))

            if language in ("javascript", "typescript"):
                if re.search(r'(?i)(innerHTML|dangerouslySetInnerHTML|document\.write)', stripped):
                    issues.append(SecurityIssue(
                        severity="high",
                        category="xss",
                        line_number=i,
                        title="Potential XSS vulnerability",
                        description="Direct HTML injection point detected.",
                        recommendation="Sanitize user input and use textContent instead of innerHTML where possible.",
                        confidence=0.80,
                        evidence=stripped[:100],
                    ))

            if re.search(r'(?i)(path\s*\+|os\.path\.join\(.*input|open\(.*\+)', stripped):
                issues.append(SecurityIssue(
                    severity="high",
                    category="path_traversal",
                    line_number=i,
                    title="Path traversal risk",
                    description="File path constructed with potentially user-controlled input.",
                    recommendation="Validate and sanitize file paths. Use allowlists for permitted directories.",
                    confidence=0.75,
                    evidence=stripped[:100],
                ))

        return issues

    def _scan_insecure_patterns(self, code: str, language: str) -> list[SecurityIssue]:
        issues = []
        lines = code.split("\n")

        for i, line in enumerate(lines, 1):
            stripped = line.strip()

            if re.search(r'(?i)(verify\s*=\s*False|SSL_VERIFY.*False|NODE_TLS_REJECT_UNAUTHORIZED.*0)', stripped):
                issues.append(SecurityIssue(
                    severity="high",
                    category="insecure_transport",
                    line_number=i,
                    title="SSL/TLS verification disabled",
                    description="SSL certificate verification is disabled, enabling man-in-the-middle attacks.",
                    recommendation="Enable SSL certificate verification in production.",
                    confidence=0.92,
                    evidence=stripped[:100],
                ))

            if re.search(r'(?i)(pickle\.loads|yaml\.load\(.*Loader)', stripped):
                issues.append(SecurityIssue(
                    severity="high",
                    category="deserialization",
                    line_number=i,
                    title="Insecure deserialization",
                    description="Untrusted data may be deserialized, leading to arbitrary code execution.",
                    recommendation="Use yaml.safe_load() or json instead of pickle for untrusted data.",
                    confidence=0.88,
                    evidence=stripped[:100],
                ))

            if re.search(r'(?i)(debug\s*=\s*True|DEBUG\s*=\s*True)', stripped):
                issues.append(SecurityIssue(
                    severity="medium",
                    category="configuration",
                    line_number=i,
                    title="Debug mode enabled",
                    description="Debug mode should not be enabled in production.",
                    recommendation="Disable debug mode in production deployments.",
                    confidence=0.70,
                    evidence=stripped[:100],
                ))

            if re.search(r'(?i)(chmod\s+777|0o777)', stripped):
                issues.append(SecurityIssue(
                    severity="medium",
                    category="permissions",
                    line_number=i,
                    title="Overly permissive file permissions",
                    description="World-writable permissions grant unrestricted access.",
                    recommendation="Use more restrictive permissions (e.g., 0o755 or 0o644).",
                    confidence=0.85,
                    evidence=stripped[:100],
                ))

            if re.search(r'(?i)(except\s*:|except\s+Exception)', stripped):
                if not re.search(r'(?i)(log|raise|print)', stripped):
                    issues.append(SecurityIssue(
                        severity="low",
                        category="error_handling",
                        line_number=i,
                        title="Broad exception catching",
                        description="Catching all exceptions may hide security issues.",
                        recommendation="Catch specific exceptions and handle them appropriately.",
                        confidence=0.60,
                        evidence=stripped[:100],
                    ))

        return issues

    def _scan_crypto(self, code: str) -> list[SecurityIssue]:
        issues = []
        lines = code.split("\n")

        for i, line in enumerate(lines, 1):
            stripped = line.strip()

            if re.search(r'(?i)(md5|sha1)\s*\(', stripped):
                if not re.search(r'(?i)(hmac|hashlib\.file)', stripped):
                    issues.append(SecurityIssue(
                        severity="medium",
                        category="cryptography",
                        line_number=i,
                        title="Weak hash algorithm",
                        description="MD5 and SHA1 are cryptographically broken for security purposes.",
                        recommendation="Use SHA-256 or stronger for security-sensitive hashing.",
                        confidence=0.80,
                        evidence=stripped[:100],
                    ))

            if re.search(r'(?i)(random\(\)|Math\.random)', stripped):
                if re.search(r'(?i)(token|password|secret|key|nonce|salt)', code, re.IGNORECASE):
                    issues.append(SecurityIssue(
                        severity="medium",
                        category="cryptography",
                        line_number=i,
                        title="Insecure random number generator",
                        description="Standard PRNG is not cryptographically secure.",
                        recommendation="Use secrets module (Python) or crypto.randomBytes (Node.js) for security-sensitive randomness.",
                        confidence=0.75,
                        evidence=stripped[:100],
                    ))

        return issues

    def _scan_network(self, code: str) -> list[SecurityIssue]:
        issues = []
        lines = code.split("\n")

        for i, line in enumerate(lines, 1):
            stripped = line.strip()

            if re.search(r'(?i)(http://(?!localhost|127\.0\.0\.1|0\.0\.0\.0))', stripped):
                issues.append(SecurityIssue(
                    severity="medium",
                    category="insecure_transport",
                    line_number=i,
                    title="HTTP (not HTTPS) URL",
                    description="Plain HTTP URLs transmit data unencrypted.",
                    recommendation="Use HTTPS for all external communications.",
                    confidence=0.65,
                    evidence=stripped[:100],
                ))

            if re.search(r'(?i)(0\.0\.0\.0)', stripped):
                issues.append(SecurityIssue(
                    severity="medium",
                    category="network",
                    line_number=i,
                    title="Binding to all interfaces",
                    description="Binding to 0.0.0.0 exposes the service to all network interfaces.",
                    recommendation="Bind to specific interfaces in production.",
                    confidence=0.70,
                    evidence=stripped[:100],
                ))

        return issues

    def _scan_sql_specific(self, code: str) -> list[SecurityIssue]:
        issues = []
        lines = code.split("\n")
        code_upper = code.upper()

        tautology_patterns = [
            (r"""(?i)(['"])\s*\w+\s*\1\s*=\s*\1\s*\w+\s*\1""", "SQL tautology (e.g. '1'='1')"),
            (r"""(?i)(['"])\s*\w+\s*\1\s*=\s*\1\s*\w+\s*\1""", "SQL tautology (e.g. 'a'='a')"),
            (r"(?i)\bOR\s+['\"]?\w+['\"]?\s*=\s*['\"]?\w+['\"]?\b.*\bOR\b", "Multiple OR tautologies"),
            (r"(?i)\bWHERE\b.*['\"]?\s*=\s*['\"]?['\"]?\s*(?:OR|AND)\b", "WHERE clause with tautology"),
        ]

        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            for pattern, title in tautology_patterns:
                if re.search(pattern, stripped):
                    issues.append(SecurityIssue(
                        severity="critical",
                        category="injection",
                        line_number=i,
                        title=title,
                        description="SQL tautology detected. This is commonly used in authentication bypass attacks (e.g., ' OR '1'='1').",
                        recommendation="Use parameterized queries. Validate and sanitize all user input.",
                        confidence=0.90,
                        evidence=stripped[:100],
                    ))
                    break

        if re.search(r"(?i)(?:SELECT|INSERT|UPDATE|DELETE).*['\"]?\s*\+\s*\w+", code):
            issues.append(SecurityIssue(
                severity="critical",
                category="injection",
                line_number=1,
                title="SQL injection via concatenation",
                description="SQL query is built using string concatenation with a variable. User input can alter the query structure.",
                recommendation="Use parameterized queries or prepared statements with placeholders.",
                confidence=0.92,
                evidence=code[:200],
            ))

        if re.search(r"(?i)EXEC\s*\(\s*['\"]", code) or re.search(r"(?i)EXECUTE\s+IMMEDIATE\s+['\"]", code):
            issues.append(SecurityIssue(
                severity="critical",
                category="injection",
                line_number=1,
                title="Dynamic SQL execution",
                description="Dynamic SQL is being executed from a string literal. This is a major injection vector.",
                recommendation="Use parameterized queries instead of dynamic SQL execution.",
                confidence=0.88,
                evidence=code[:200],
            ))

        return issues


security_scanner = SecurityScanner()
