from app.services.validation_service import ValidationService, SCORE_PENALTY


def _svc():
    return ValidationService(db=None)


def test_score_no_issues_is_100():
    assert _svc()._calculate_score([]) == 100


def test_score_deterministic_penalties():
    svc = _svc()
    assert svc._calculate_score([{"severity": "critical"}]) == 100 - SCORE_PENALTY["critical"]
    assert svc._calculate_score([{"severity": "high"}]) == 100 - SCORE_PENALTY["high"]
    assert svc._calculate_score([{"severity": "medium"}]) == 100 - SCORE_PENALTY["medium"]
    assert svc._calculate_score([{"severity": "low"}]) == 100 - SCORE_PENALTY["low"]
    assert svc._calculate_score([{"severity": "info"}]) == 100


def test_score_never_negative():
    issues = [{"severity": "critical"} for _ in range(10)]
    assert _svc()._calculate_score(issues) == 0


def test_score_mixed():
    issues = [
        {"severity": "high"},
        {"severity": "medium"},
        {"severity": "low"},
        {"severity": "low"},
    ]
    expected = 100 - 20 - 10 - 5 - 5
    assert _svc()._calculate_score(issues) == expected


def test_deduplicate_keeps_higher_confidence():
    svc = _svc()
    a = {"line": 1, "category": "security", "title": "Same issue", "confidence": 0.5}
    b = {"line": 1, "category": "security", "title": "Same issue", "confidence": 0.9}
    out = svc._deduplicate([a, b])
    assert len(out) == 1
    assert out[0]["confidence"] == 0.9


def test_deduplicate_groups_security_categories():
    svc = _svc()
    a = {"line": 2, "category": "injection", "title": "SQLi", "confidence": 0.8}
    b = {"line": 2, "category": "secrets", "title": "Other", "confidence": 0.8}
    out = svc._deduplicate([a, b])
    assert len(out) == 2


def test_drops_low_confidence_llm_noise_on_syntax_lines():
    svc = _svc()
    issues = [
        {"line": 3, "category": "syntax", "title": "bad", "confidence": 1.0, "source": "python-parser"},
        {"line": 3, "category": "logic", "title": "nit", "confidence": 0.5, "source": "ollama"},
    ]
    out = svc._deduplicate(issues)
    assert len(out) == 1
    assert out[0]["source"] == "python-parser"
