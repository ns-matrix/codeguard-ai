from app.services.language_detector import detect_language, detect_from_syntax


def test_detect_python_function():
    code = 'def hello():\n    print("Hello")\n'
    r = detect_language(code)
    assert r.language == "python"
    assert r.confidence >= 0.6
    assert r.method in ("syntax", "filename", "combined")


def test_detect_javascript_function():
    code = 'function hello() {\n    console.log("Hello");\n}\n'
    r = detect_language(code)
    assert r.language == "javascript"
    assert r.confidence >= 0.6


def test_detect_sql():
    r = detect_language("SELECT * FROM users;")
    assert r.language == "sql"
    assert r.confidence >= 0.6


def test_detect_typescript():
    code = "interface User {\n  id: number;\n  name: string;\n}\n"
    r = detect_language(code)
    assert r.language == "typescript"


def test_detect_filename_wins():
    r = detect_language("SELECT 1;", filename="query.sql")
    assert r.language == "sql"
    assert r.method == "filename"
    assert r.confidence == 1.0


def test_detect_empty_is_unknown():
    r = detect_language("   \n  ")
    assert r.language == "unknown"
    assert r.confidence == 0.0


def test_detect_ambiguous_low_confidence():
    r = detect_from_syntax("x = 1\n")
    assert r.language in ("unknown", "python")
    if r.language == "unknown":
        assert r.confidence < 0.6


def test_detect_python_class_and_imports():
    code = "import os\n\nclass Config:\n    def load(self):\n        return os.environ\n"
    assert detect_language(code).language == "python"


def test_detect_json():
    code = '{"name": "test", "count": 3}'
    assert detect_language(code).language == "json"


def test_detect_go():
    code = 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("hi")\n}\n'
    assert detect_language(code).language == "go"


def test_detect_bash():
    code = "#!/bin/bash\necho hello\nif [ -f x ]; then\n  echo yes\nfi\n"
    assert detect_language(code).language == "bash"


def test_detect_c():
    code = '#include <stdio.h>\n\nint main() {\n    printf("hi");\n    return 0;\n}\n'
    assert detect_language(code).language in ("c", "cpp")
