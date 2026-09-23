import re
from dataclasses import dataclass


@dataclass
class DetectionResult:
    language: str
    confidence: float
    method: str


EXTENSION_MAP = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".java": "java",
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".cxx": "cpp",
    ".cc": "cpp",
    ".hpp": "cpp",
    ".cs": "csharp",
    ".go": "go",
    ".rs": "rust",
    ".php": "php",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".sql": "sql",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".sh": "bash",
    ".bash": "bash",
    ".zsh": "bash",
    ".rb": "ruby",
    ".swift": "swift",
    ".kt": "kotlin",
    ".scala": "scala",
    ".r": "r",
    ".R": "r",
    ".lua": "lua",
    ".dart": "dart",
    ".ex": "elixir",
    ".exs": "elixir",
}


def detect_from_filename(filename: str) -> DetectionResult | None:
    for ext, lang in EXTENSION_MAP.items():
        if filename.endswith(ext):
            return DetectionResult(language=lang, confidence=1.0, method="filename")
    return None


SYNTAX_RULES = [
    {
        "language": "python",
        "required": [r"\bdef\b", r"\bimport\b", r"\bfrom\b.*\bimport\b", r"print\s*\(", r"^\s*return\b", r"^\s*class\b", r"^\s*if\b.*:\s*$", r"^\s*for\b.*:\s*$"],
        "strong": [r":\s*$", r"\bself\b", r"\bNone\b", r"\bTrue\b", r"\bFalse\b", r"\belif\b", r"\bexcept\b", r"\blambda\b", r"f['\"]"],
        "anti": [r"\bfunction\b", r"\bvar\b", r"\blet\b", r"\bconst\b", r"=>", r"#include", r"package\s+\w+"],
        "indent": True,
    },
    {
        "language": "javascript",
        "required": [r"\bfunction\b", r"\bconst\b|\blet\b|\bvar\b", r"console\.log", r"=>", r"\bimport\b.*\bfrom\b", r"\bexport\b", r"\bnew\s+Promise\b"],
        "strong": [r"=>", r"===", r"!==", r"\?\.", r"console\.log", r"require\(", r"module\.exports", r"\bimport\b.*\bfrom\b", r"\bexport\b", r"\bnew\s+Promise\b"],
        "anti": [r"\bdef\b.*:", r"\bself\b", r"\bNone\b", r"#include", r"\bpackage\s+main\b", r":\s*(string|number|boolean)\b", r"\binterface\b", r"^\s*def\s+\w+\s*\(.*\)\s*:\s*$"],
        "indent": False,
    },
    {
        "language": "typescript",
        "required": [r":\s*(string|number|boolean|any|void|never|unknown)\b", r"\binterface\b", r"\btype\b.*=", r"\benum\b"],
        "strong": [r"<\w+>", r"\bas\s+\w+", r"\?\s*:", r"readonly\s+", r"\bimplements\b.*\{", r"\bprivate\b|\bpublic\b.*:"],
        "anti": [r"^\s*def\s+\w+\s*\(.*\)\s*:\s*$", r"\bself\b", r"#include"],
        "indent": False,
    },
    {
        "language": "csharp",
        "required": [r"\busing\s+System\b", r"\bnamespace\b", r"Console\.WriteLine", r"string\[\]\s*args", r"public\s+static\s+void\s+Main"],
        "strong": [r"\bget;\s*set;", r"\bvar\s+\w+\s*=", r"async\s+Task", r"public\s+class\b", r"\bprivate\s+readonly\b", r"\bforeach\s*\(.*\bin\b"],
        "anti": [r"^\s*def\s+\w+\s*\(.*\)\s*:\s*$", r"\bself\b", r"#include", r"\bpackage\s+main\b", r"\bfn\s+main\s*\("],
        "indent": False,
    },
    {
        "language": "java",
        "required": [r"\bpublic\b.*\bclass\b", r"\bpublic\b.*\bstatic\b.*\bvoid\b.*main", r"System\.out\.print"],
        "strong": [r"@Override", r"\bextends\b", r"\bimplements\b", r"\bthis\.", r"\bsuper\("],
        "anti": [r"\bdef\b.*:", r"\bself\b", r"\bNone\b", r"#include", r"\bpackage\s+main\b"],
        "indent": False,
    },
    {
        "language": "go",
        "required": [r"\bpackage\s+main\b", r"\bfunc\s+main\s*\(", r"fmt\.\w+", r":="],
        "strong": [r"\bgo\s+\w+", r"\bchan\b", r"\bdefer\b", r"\bgoroutine\b", r"\b<-"],
        "anti": [r"\bdef\b.*:", r"\bself\b", r"#include", r"\bclass\b"],
        "indent": False,
    },
    {
        "language": "rust",
        "required": [r"\bfn\s+main\s*\(", r"\blet\s+mut\b", r"\bprintln!\s*\(", r"\bimpl\b", r"\bpub\s+fn\b"],
        "strong": [r"->\s*\w+", r"\bmatch\b.*\{", r"\bOption\b", r"\bResult\b", r"!\s*\("],
        "anti": [r"\bdef\b.*:", r"#include", r"\bpackage\s+main\b"],
        "indent": False,
    },
    {
        "language": "c",
        "required": [r"#include\s*[<\"]", r"\bint\s+main\s*\(", r"\bprintf\s*\(", r"\bmalloc\s*\(", r"\bfree\s*\("],
        "strong": [r"\bstruct\b", r"\btypedef\b", r"\bNULL\b", r"->", r"\bvoid\s*\*"],
        "anti": [r"\bdef\b.*:", r"\bself\b", r"\bpackage\s+main\b", r"\bfn\b"],
        "indent": False,
    },
    {
        "language": "cpp",
        "required": [r"#include\s*[<\"]", r"\bstd::", r"\bcout\b", r"\bcin\b", r"\bnamespace\b"],
        "strong": [r"template\s*<", r"\bclass\b.*{", r"::", r"\bnullptr\b", r"\bvector\b", r"\bmap\b"],
        "anti": [r"\bdef\b.*:", r"\bself\b", r"\bpackage\s+main\b"],
        "indent": False,
    },
    {
        "language": "php",
        "required": [r"<\?php", r"\$\w+\s*=", r"echo\s+", r"public\s+function"],
        "strong": [r"\->\s*\w+", r"\bnew\s+\w+", r"\$this\b", r"\barray\b"],
        "anti": [r"\bdef\b.*:", r"#include", r"\bpackage\s+main\b"],
        "indent": False,
    },
    {
        "language": "html",
        "required": [r"<!DOCTYPE", r"<html", r"<head", r"<body", r"<div[\s>]", r"<span[\s>]", r"<p[\s>]", r"<a[\s>]", r"<script[\s>]", r"<style[\s>]"],
        "strong": [r"<div", r"<span", r"<script", r"<style", r"<link", r"<meta"],
        "anti": [r"\bdef\b.*:", r"\bfunction\b.*\(", r"#include"],
        "indent": False,
    },
    {
        "language": "css",
        "required": [r"\.[\w-]+\s*\{", r"#[\w-]+\s*\{", r"@media", r"@keyframes"],
        "strong": [r"\bcolor\s*:", r"\bmargin\s*:", r"\bpadding\s*:", r"\bdisplay\s*:", r"\bfont-size\s*:", r";\s*\}", r"\bbackground\s*:"],
        "anti": [r"^\s*def\s+\w+\s*\(.*\)\s*:\s*$", r"#include", r"\bpackage\s+main\b", r"\bfunction\b", r"\bSELECT\b"],
        "indent": False,
    },
    {
        "language": "sql",
        "required": [r"\bSELECT\b.*\bFROM\b", r"\bSELECT\b", r"\bINSERT\s+INTO\b", r"\bUPDATE\b.*\bSET\b", r"\bDELETE\s+FROM\b", r"\bCREATE\s+TABLE\b", r"\bWHERE\b"],
        "strong": [r"\bWHERE\b", r"\bJOIN\b", r"\bGROUP\s+BY\b", r"\bORDER\s+BY\b"],
        "anti": [r"\bdef\b.*:", r"\bfunction\b", r"#include", r"\bpackage\s+main\b"],
        "indent": False,
    },
    {
        "language": "json",
        "required": [r"^\s*\{", r"^\s*\[", r"\"[^\"]+\"\s*:"],
        "strong": [r":\s*\"", r":\s*\d+", r":\s*(true|false|null)", r"\[.*\{"],
        "anti": [r"\bdef\b.*:", r"\bfunction\b", r"#include"],
        "indent": False,
    },
    {
        "language": "yaml",
        "required": [r"^\w+:\s", r"^-\s+\w+"],
        "strong": [r"---", r"  \w+:\s", r"\w+:\s*$"],
        "anti": [r"\bdef\b.*:", r"\bfunction\b", r"#include"],
        "indent": True,
    },
    {
        "language": "bash",
        "required": [r"#!/bin/(ba)?sh", r"#!/usr/bin/env\s+(ba)?sh", r"^\s*echo\b", r"\becho\b.*\|"],
        "strong": [r"\becho\b", r"^\s*\bif\b.*\bthen\b", r"^\s*\bfi\b", r"\bdone\b", r"^\s*\bfor\b.*\bdo\b", r"\bcase\b.*\besac\b", r"\$\{?\w+\}?", r"\bchmod\b", r"\bgrep\b", r"\bawk\b"],
        "anti": [r"^\s*def\s+\w+\s*\(.*\)\s*:\s*$", r"#include", r"\bpackage\s+main\b", r"\bconsole\.log\b"],
        "indent": False,
    },
]


def detect_from_syntax(code: str) -> DetectionResult:
    if not code or not code.strip():
        return DetectionResult(language="unknown", confidence=0.0, method="none")

    scores: dict[str, float] = {}

    for rule in SYNTAX_RULES:
        lang = rule["language"]
        score = 0.0

        required_hits = 0
        for pat in rule["required"]:
            if re.search(pat, code, re.MULTILINE):
                required_hits += 1
                score += 3.0

        if required_hits == 0:
            scores[lang] = 0.0
            continue

        for pat in rule["strong"]:
            matches = len(re.findall(pat, code, re.MULTILINE))
            score += matches * 1.5

        anti_hits = 0
        for pat in rule["anti"]:
            if re.search(pat, code, re.MULTILINE):
                anti_hits += 1
                score -= 2.0

        if anti_hits >= 2:
            score -= 5.0

        if rule["indent"]:
            indent_lines = len(re.findall(r"^\s{2,}\S", code, re.MULTILINE))
            if indent_lines > 2:
                score += indent_lines * 0.5

        scores[lang] = max(0, score)

    if not scores or max(scores.values()) == 0:
        return DetectionResult(language="unknown", confidence=0.0, method="none")

    best_lang = max(scores, key=scores.get)
    max_score = scores[best_lang]
    total = sum(v for v in scores.values() if v > 0)
    confidence = round(min(max_score / max(total, 1), 1.0), 2)

    # Low confidence (e.g. 0.54) means the evidence is ambiguous, so report
    # Unknown while preserving the measured confidence for display.
    if confidence < 0.6:
        return DetectionResult(language="unknown", confidence=confidence, method="syntax")

    return DetectionResult(language=best_lang, confidence=confidence, method="syntax")


def detect_language(code: str, filename: str | None = None) -> DetectionResult:
    if filename:
        result = detect_from_filename(filename)
        if result:
            return result

    return detect_from_syntax(code)
