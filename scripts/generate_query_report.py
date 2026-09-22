# scripts/generate_query_report.py
# Simple Python script to scan the codebase for Supabase `from` queries and output a markdown report.
import os
import re
from pathlib import Path

SRC_DIR = Path(__file__).resolve().parents[1] / "src"
REPORT_PATH = Path(__file__).resolve().parents[1] / "audit" / "queries_report.md"

PATTERN = re.compile(r"\b(?:supabase|db)\.from\s*\(\s*['\"]([^'\"]+)['\"]\s*\)")

def get_files():
    return list(SRC_DIR.rglob("*.ts")) + list(SRC_DIR.rglob("*.tsx"))

def extract_queries(file_path):
    results = []
    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    for i, line in enumerate(lines, start=1):
        for match in PATTERN.finditer(line):
            results.append((i, match.group(1)))
    return results

def generate_report():
    files = get_files()
    report_lines = ["# Queries Report", "", f"Generated on {" + "\"" + "" + "\"" + "}" , ""]
    for file_path in files:
        rel = file_path.relative_to(SRC_DIR)
        queries = extract_queries(file_path)
        if queries:
            report_lines.append(f"## {rel}")
            for line_no, query in queries:
                report_lines.append(f"- Line {line_no}: `from('{query}')`")
            report_lines.append("")
    os.makedirs(REPORT_PATH.parent, exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))
    print(f"Query report written to {REPORT_PATH}")

if __name__ == "__main__":
    generate_report()
