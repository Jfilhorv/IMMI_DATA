"""
Copy dashboard build outputs from data/dashboard/ to dashboard/data/
so the live site (GitHub Pages) has indicators.csv, per-table CSVs, category_tables.json, etc.
Run after build_dashboard_data.py and list_kpi_candidates.py.
"""
import re
import shutil
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SOURCE = PROJECT_ROOT / "data" / "dashboard"
DEST = PROJECT_ROOT / "dashboard" / "data"

# Files we copy (tables.json is not generated; keep existing in dashboard/data)
COPY_FILES = [
    "indicators.csv",
    "category_tables.json",
    "indicator_metadata.csv",
]
# Plus all table CSVs: 1_0.csv, 1_1.csv, ... 7_8.csv
TABLE_CSV_PATTERN = re.compile(r"^\d+_\d+\.csv$")


def main():
    if not SOURCE.exists():
        print("Source not found:", SOURCE)
        return
    DEST.mkdir(parents=True, exist_ok=True)
    for name in COPY_FILES:
        src = SOURCE / name
        if src.exists():
            shutil.copy2(src, DEST / name)
            print("Copied", name)
    for path in SOURCE.iterdir():
        if path.is_file() and TABLE_CSV_PATTERN.match(path.name):
            shutil.copy2(path, DEST / path.name)
            print("Copied", path.name)
    print("Sync done:", DEST)


if __name__ == "__main__":
    main()
