"""
Extract footnote/source/notes lines from each by_sheet CSV (lines after the data table).
Outputs data/dashboard/table_footnotes.json for the dashboard to show per-table notes.
"""
import csv
import json
import re
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
BY_SHEET_DIR = PROJECT_ROOT / "data" / "by_sheet"
DASHBOARD_DATA_SOURCE = PROJECT_ROOT / "data" / "dashboard"
DASHBOARD_DATA_LIVE = PROJECT_ROOT / "dashboard" / "data"
OUTPUT_JSON = DASHBOARD_DATA_SOURCE / "table_footnotes.json"

# Table CSV files: 1_0, 1_1, ..., 7_8 (skip Overview, Data Items, etc.)
TABLE_FILE_PATTERN = re.compile(r"^(\d+_\d+)\.csv$")
YEAR_PATTERN = re.compile(r"^\d{4}[–\-]?\d{0,2}$|^\d{4}$")


def looks_like_data_row(cells: list[str]) -> bool:
    """True if the row looks like a data row (has a year in one of the first columns)."""
    for i in range(min(3, len(cells))):
        val = (cells[i] or "").strip()
        if not val:
            continue
        if YEAR_PATTERN.match(val):
            return True
        # Partial year like "1984" at start
        if len(val) >= 4 and val[:4].isdigit():
            return True
    return False


def clean_footer_line(cells: list[str]) -> str:
    """Join non-empty cells and strip."""
    parts = [str(c).strip() for c in cells if c and str(c).strip()]
    return " ".join(parts).strip()


def extract_footnotes_from_csv(path: Path) -> list[str]:
    """Read CSV and return list of footer lines (notes, source, etc.) after the data block."""
    lines: list[str] = []
    with open(path, newline="", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        rows = list(reader)
    if not rows:
        return []
    # Find last row that looks like data (has year)
    last_data_idx = -1
    for i in range(len(rows)):
        if looks_like_data_row(rows[i]):
            last_data_idx = i
    # From last_data_idx + 1 to end, collect non-empty cleaned lines
    for i in range(last_data_idx + 1, len(rows)):
        line = clean_footer_line(rows[i])
        if line:
            lines.append(line)
    return lines


def main() -> None:
    DASHBOARD_DATA_SOURCE.mkdir(parents=True, exist_ok=True)
    footnotes_by_table: dict[str, list[str]] = {}
    for path in sorted(BY_SHEET_DIR.iterdir()):
        if not path.is_file() or path.suffix.lower() != ".csv":
            continue
        m = TABLE_FILE_PATTERN.match(path.name)
        if not m:
            continue
        table_id = m.group(1)
        lines = extract_footnotes_from_csv(path)
        if lines:
            footnotes_by_table[table_id] = lines
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(footnotes_by_table, f, indent=2, ensure_ascii=False)
    print("Wrote", OUTPUT_JSON, "with", len(footnotes_by_table), "tables.")
    # Copy to dashboard/data/ so the live dashboard can load it
    DASHBOARD_DATA_LIVE.mkdir(parents=True, exist_ok=True)
    live_path = DASHBOARD_DATA_LIVE / "table_footnotes.json"
    with open(live_path, "w", encoding="utf-8") as f:
        json.dump(footnotes_by_table, f, indent=2, ensure_ascii=False)
    print("Wrote", live_path)


if __name__ == "__main__":
    main()
