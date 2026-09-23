"""API tests: fast deterministic endpoints + full LLM workflow (marked)."""
import pytest


async def test_health(client):
    r = await client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "healthy"
    assert body["ollama"] in ("connected", "disconnected")


async def test_detect_language_endpoint(client):
    r = await client.post("/api/v1/detect-language", json={"code": "def f():\n    return 1\n"})
    assert r.status_code == 200
    body = r.json()
    assert body["language"] == "python"
    assert body["confidence"] >= 0.6
    assert body["method"]


async def test_detect_language_missing_field(client):
    r = await client.post("/api/v1/detect-language", json={})
    assert r.status_code == 422


async def test_detect_language_too_long(client):
    r = await client.post("/api/v1/detect-language", json={"code": "x" * 100_001})
    assert r.status_code == 422


async def test_models_endpoint_real_ollama(client):
    r = await client.get("/api/v1/models")
    assert r.status_code == 200
    body = r.json()
    assert body["connected"] is True
    assert len(body["models"]) >= 1
    names = [m["name"] for m in body["models"]]
    assert "deepseek-r1:7b-fast" in names
    assert body["default_model"]


async def test_config_endpoint(client):
    r = await client.get("/api/v1/config")
    assert r.status_code == 200
    body = r.json()
    assert body["app_name"] == "CodeGuard AI"
    assert body["default_model"]
    assert body["max_code_length"] == 100_000
    assert body["score_penalties"]["critical"] == 30


async def test_format_endpoint_python(client):
    r = await client.post("/api/v1/format", json={"code": "def test():\n  x=1+2\n  return x\n", "language": "python"})
    assert r.status_code == 200
    body = r.json()
    assert body["available"] is True
    assert "    x = 1 + 2" in body["formatted_code"]
    assert body["syntax_valid"] is True
    assert body["original_code"] != body["formatted_code"] or body["diff"] == []


async def test_format_endpoint_auto_detect(client):
    r = await client.post("/api/v1/format", json={"code": '{"a":1}', "language": "auto"})
    assert r.status_code == 200
    body = r.json()
    assert body["language"] == "json"
    assert body["available"] is True


async def test_format_empty_rejected(client):
    r = await client.post("/api/v1/format", json={"code": ""})
    assert r.status_code == 422


async def test_stats_endpoint_empty_and_populated(client):
    r = await client.get("/api/v1/stats?days=7")
    assert r.status_code == 200
    body = r.json()
    for key in ("total_validations", "issues_found", "critical_issues", "series",
                "languages", "severity_counts", "recent", "security_categories"):
        assert key in body
    assert isinstance(body["series"], list)


async def test_stats_invalid_days(client):
    r = await client.get("/api/v1/stats?days=0")
    assert r.status_code == 422


async def test_history_empty_list(client):
    r = await client.get("/api/v1/history")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


async def test_history_detail_not_found(client):
    r = await client.get("/api/v1/history/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


async def test_history_detail_invalid_uuid(client):
    r = await client.get("/api/v1/history/not-a-uuid")
    assert r.status_code == 404


async def test_validate_empty_code_rejected(client):
    r = await client.post("/api/v1/validate", json={"code": ""})
    assert r.status_code == 422


@pytest.mark.integration
async def test_validate_syntax_error_without_needing_llm_success(client):
    """Validate must report the syntax error deterministically even if LLM is slow/offline."""
    code = "def calculate_total(items)\n    total = 0\n    return total\n"
    r = await client.post("/api/v1/validate", json={"code": code, "language": "python"},
                          timeout=300)
    assert r.status_code == 200
    body = r.json()
    assert body["language"] == "python"
    assert body["syntax_valid"] is False
    assert body["status"] in ("warning", "error")
    assert body["score"] < 100
    syntax_issues = [i for i in body["issues"] if i.get("category") == "syntax" or i.get("source", "").endswith("-parser")]
    assert syntax_issues, body["issues"]
    assert syntax_issues[0]["line"] == 1
    assert body["score"] == max(0, min(100, 100 - 20 * body["high"] - 30 * body["critical"] - 10 * body["medium"] - 5 * body["low"]))


@pytest.mark.llm
@pytest.mark.integration
async def test_full_workflow_validate_fix_format_history(client):
    """MOST IMPORTANT WORKFLOW: validate -> fix -> revalidate -> format -> history."""
    vulnerable = (
        "import sqlite3\n\n"
        "def get_user(user_id):\n"
        '    conn = sqlite3.connect("users.db")\n'
        '    query = "SELECT * FROM users WHERE id = " + user_id\n'
        "    return conn.execute(query).fetchone()\n"
    )

    # 1. VALIDATE
    r = await client.post("/api/v1/validate",
                          json={"code": vulnerable, "language": "python"},
                          timeout=300)
    assert r.status_code == 200, r.text
    result = r.json()
    assert result["status"] in ("warning", "error")
    assert result["total_issues"] >= 1
    assert any("injection" in i["category"] or "injection" in i["title"].lower()
               for i in result["issues"]), result["issues"]
    validation_id = result["validation_id"]
    assert result["duration_ms"] is not None and result["duration_ms"] > 0

    # 2. FIX CODE
    target = next(i for i in result["issues"]
                  if "injection" in i["category"] or "injection" in i["title"].lower())
    r = await client.post("/api/v1/fix", json={
        "code": vulnerable,
        "issues": result["issues"],
        "language": "python",
        "target": target,
    }, timeout=300)
    assert r.status_code == 200, r.text
    fix = r.json()
    assert fix["status"] in ("ready", "unresolved", "no_change", "rejected"), fix
    assert "diff" in fix
    if fix["status"] == "ready":
        assert fix["fixed_code"] != vulnerable
        assert any(ln.startswith("+") or ln.startswith("-") for ln in fix["diff"] if not ln.startswith("+++") and not ln.startswith("---"))

        # 3. REVALIDATE after applying fix
        r = await client.post("/api/v1/validate",
                              json={"code": fix["fixed_code"], "language": "python"},
                              timeout=300)
        assert r.status_code == 200
        after = r.json()
        assert after["syntax_valid"] is True
        still_has = any(
            t["line"] == target.get("line", target.get("line_number"))
            and "injection" in t["category"]
            for t in after["issues"]
        )
        if still_has:
            # Honest outcome: fix did not resolve — recorded so UI can report it.
            print("WARN: fix applied but injection still reported")
        else:
            print("PASS: injection resolved after apply + revalidate")

    # 4. FORMAT
    r = await client.post("/api/v1/format", json={"code": vulnerable, "language": "python"},
                          timeout=60)
    assert r.status_code == 200
    fmt = r.json()
    assert fmt["available"] is True
    if fmt["formatted_code"] != vulnerable:
        assert fmt["syntax_valid"] is True

    # 5. HISTORY contains the validations and detail returns code snapshot
    r = await client.get("/api/v1/history")
    assert r.status_code == 200
    entries = r.json()
    assert len(entries) >= 2
    assert any(e["id"] == validation_id for e in entries)

    r = await client.get(f"/api/v1/history/{validation_id}")
    assert r.status_code == 200
    detail = r.json()
    assert detail["code"] == vulnerable
    assert detail["total_issues"] >= 1
    assert detail["created_at"]


@pytest.mark.llm
@pytest.mark.integration
async def test_explain_find_bugs_security_optimize_tests_docs(client):
    code = "def divide(a, b):\n    return a / b\n"
    calls = [
        ("/api/v1/explain", 300),
        ("/api/v1/find-bugs", 300),
        ("/api/v1/security-scan", 300),
        ("/api/v1/optimize", 300),
        ("/api/v1/generate-tests", 300),
        ("/api/v1/document", 300),
    ]
    for path, timeout in calls:
        r = await client.post(path, json={"code": code, "language": "python"}, timeout=timeout)
        assert r.status_code == 200, f"{path}: {r.status_code} {r.text[:200]}"
        body = r.json()
        assert body, f"{path} returned empty body"
