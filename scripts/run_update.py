"""
Run the full data update pipeline in order.
From project root: python scripts/run_update.py

Steps: fetch -> melt -> build_dashboard_data -> extract_table_footnotes -> list_kpi_candidates -> sync_dashboard_data -> (optional) build_drawio_tree.
"""
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = [
    "fetch_first_dataset.py",
    "melt_all_sheets.py",
    "build_dashboard_data.py",
    "extract_table_footnotes.py",
    "list_kpi_candidates.py",
    "sync_dashboard_data.py",
    "build_drawio_tree.py",
]


def main():
    for name in SCRIPTS:
        path = PROJECT_ROOT / "scripts" / name
        if not path.exists():
            print("Skip (not found):", name)
            continue
        print("\n---", name, "---")
        r = subprocess.run([sys.executable, str(path)], cwd=str(PROJECT_ROOT))
        if r.returncode != 0:
            print("Failed:", name, "exit code", r.returncode)
            sys.exit(r.returncode)
    print("\nDone. Commit and push to publish.")


if __name__ == "__main__":
    main()
