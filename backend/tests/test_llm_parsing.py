from app.services.ollama_service import ollama_service


def test_extract_json_plain():
    assert ollama_service._extract_json('{"a": 1}') == {"a": 1}


def test_extract_json_fenced():
    text = '```json\n{"issues": []}\n```'
    assert ollama_service._extract_json(text) == {"issues": []}


def test_extract_json_with_preamble():
    text = 'Here is my analysis:\n{"summary": "ok"}\nThanks'
    assert ollama_service._extract_json(text) == {"summary": "ok"}


def test_strip_thinking_tags():
    text = "<think>first I think\nthen think more</think>\n{\"a\": 1}"
    cleaned = ollama_service._strip_thinking(text)
    assert "think" not in cleaned
    assert '{"a": 1}' in cleaned


def test_balanced_json_respects_strings():
    text = 'prefix {"a": "}", "b": 2} suffix'
    assert ollama_service._balanced_json(text) == '{"a": "}", "b": 2}'


def test_sanitize_issues_bounds_and_evidence():
    code = "line one\nline two\nline three\n"
    raw = [
        {"title": "Good", "description": "desc", "severity": "high",
         "category": "bug", "line": 2, "confidence": 0.9, "evidence": "line two",
         "recommendation": "fix"},
        {"title": "Out of range", "description": "d", "line": 99},
        {"title": "", "description": "missing title"},
        {"title": "Bad severity", "description": "d", "severity": "apocalyptic",
         "category": "weird", "line": 1, "evidence": "line one", "confidence": 0.9},
    ]
    out = ollama_service.sanitize_issues(raw, code)
    titles = [i["title"] for i in out]
    assert "Good" in titles
    assert "Out of range" not in titles
    bad = next(i for i in out if i["title"] == "Bad severity")
    assert bad["severity"] == "low"
    assert bad["category"] == "quality"
    assert 1 <= bad["line"] <= 3


def test_sanitize_drops_unverifiable_low_confidence():
    code = "alpha\nbeta\n"
    raw = [{"title": "T", "description": "Needs to be long enough",
            "line": 1, "confidence": 0.3, "evidence": "this text is nowhere in the code at all"}]
    out = ollama_service.sanitize_issues(raw, code)
    assert out == []


def test_sanitize_critical_requires_high_confidence():
    code = "alpha\n"
    raw = [{"title": "T", "description": "desc present", "severity": "critical",
            "line": 1, "confidence": 0.7, "evidence": "alpha"}]
    out = ollama_service.sanitize_issues(raw, code)
    assert out
    assert out[0]["severity"] == "high"


def test_extract_code_from_json_field():
    resp = '{"fixed_code": "print(1)", "changes_made": ["x"]}'
    assert ollama_service.extract_code(resp) == "print(1)"


def test_extract_code_from_fence():
    resp = "```python\nprint(1)\n```"
    assert ollama_service.extract_code(resp) == "print(1)"
