#!/usr/bin/env python3
"""Regression tests for the data pipeline: it must fail on unknown flags.

Usage:  python scripts/test_build_data.py
"""
import os
import shutil
import subprocess
import sys
import tempfile
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")
import openpyxl  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
FILES = ["ai_security_controls_catalogue.xlsx", "JNIC 26 - Tech-legal alignment in AI security-2.xlsx"]


def run(src: Path) -> subprocess.CompletedProcess:
    env = dict(os.environ, BUILD_DATA_SOURCE=str(src))
    return subprocess.run([sys.executable, str(ROOT / "scripts" / "build_data.py"), "--check"],
                          env=env, capture_output=True, text=True)


def with_cell(sheet: str, header: str, value: str) -> subprocess.CompletedProcess:
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        for f in FILES:
            shutil.copy(ROOT / "data" / "source" / f, tmp / f)
        wb = openpyxl.load_workbook(tmp / FILES[0])
        ws = wb[sheet]
        col = [c.value for c in ws[1]].index(header) + 1
        ws.cell(row=2, column=col, value=value)
        wb.save(tmp / FILES[0])
        return run(tmp)


def main() -> int:
    failures = []
    ok = run(ROOT / "data" / "source")
    if ok.returncode != 0:
        failures.append(f"clean sources should pass:\n{ok.stderr}")
    cases = [
        ("Controls", "Condition (flags)", "always && not_a_flag", "unknown token 'not_a_flag'"),
        ("Matrix techniques", "Applies when (flags, proposed)", "rag || eval(1)", "unexpected character"),
        ("Legal basis", "Rule (flags)", "high_risk && !provider", "unexpected character"),
        ("Controls", "Condition (flags)", "(rag || tools", "syntax"),
    ]
    for sheet, header, value, expected in cases:
        r = with_cell(sheet, header, value)
        if r.returncode == 0 or expected not in r.stderr:
            failures.append(f"{sheet}/{header}={value!r} should fail with {expected!r}; got {r.returncode}: {r.stderr[-300:]}")
    for f in failures:
        print("FAIL:", f)
    print(f"{len(cases) + 1 - len(failures)}/{len(cases) + 1} pipeline tests passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
