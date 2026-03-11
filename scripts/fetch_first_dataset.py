"""
Fetch the first dataset (Australian Migration Statistics, latest year) and read all sheets.
Saves raw XLSX to data/raw/ and exports each sheet to CSV + a summary JSON.
"""
import json
import sys
from pathlib import Path

import pandas as pd
import requests

# URLs from DATA_AVAILABLE.md — first dataset
DATASET_1_URL = (
    "https://data.gov.au/data/dataset/dba45e7c-81f4-44aa-9d82-1b9a0a121017/"
    "resource/242e6794-9b6a-4d34-a67f-d940e96e6a37/download/"
    "migration_trends_statistical_package_2024_25.xlsx"
)
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data"
RAW_DIR = OUTPUT_DIR / "raw"
CSV_DIR = OUTPUT_DIR / "by_sheet"


def download_xlsx(url: str, save_path: Path) -> Path:
    """Download XLSX with a browser-like User-Agent."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    r = requests.get(url, headers=headers, timeout=60)
    r.raise_for_status()
    save_path.parent.mkdir(parents=True, exist_ok=True)
    save_path.write_bytes(r.content)
    return save_path


def safe_sheet_name(name: str) -> str:
    """Make a sheet name safe for use as filename."""
    return "".join(c if c.isalnum() or c in " -_" else "_" for c in name).strip() or "sheet"


def find_table_title(df: pd.DataFrame, sheet_name: str) -> str:
    """Get the table title from the first rows (e.g. 'Table 1.0: ...' or 'Overview')."""
    for r in range(min(5, len(df))):
        for c in range(len(df.columns)):
            val = df.iloc[r, c]
            if pd.isna(val):
                continue
            s = str(val).strip().replace('"', "").replace("\n", " ")
            if s.startswith("Table ") and ":" in s:
                return s
            if sheet_name == "Overview" and "Australian Migration Statistics" in s and "Overview" not in s:
                return s.strip() or "Australian Migration Statistics, 2024–25"
            if sheet_name == "Data Items and Terminology" and "Data Items and Terminology" in s:
                return "Data Items and Terminology"
    if sheet_name == "Overview":
        return "Australian Migration Statistics, 2024–25 — Overview"
    if sheet_name == "Data Items and Terminology":
        return "Data Items and Terminology"
    return sheet_name


def sheet_type(sheet_name: str) -> str:
    """Documentation = Overview, Data Items and Terminology. Data = 1.0 to 1.7."""
    if sheet_name in ("Overview", "Data Items and Terminology"):
        return "Documentation"
    if sheet_name in ("1.0", "1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7"):
        return "Data"
    return "Other"


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    CSV_DIR.mkdir(parents=True, exist_ok=True)

    xlsx_name = "migration_trends_statistical_package_2024_25.xlsx"
    xlsx_path = RAW_DIR / xlsx_name

    print("Downloading:", DATASET_1_URL)
    try:
        download_xlsx(DATASET_1_URL, xlsx_path)
        print("Saved to:", xlsx_path)
    except requests.RequestException as e:
        print("Download failed:", e, file=sys.stderr)
        sys.exit(1)

    print("\nReading all sheets from", xlsx_path)
    xl = pd.ExcelFile(xlsx_path)
    sheet_names = xl.sheet_names
    summary = {
        "source": "Australian Migration Statistics 2024-25",
        "url": DATASET_1_URL,
        "file": str(xlsx_path),
        "sheets": [],
    }

    index_rows = []
    for name in sheet_names:
        df = pd.read_excel(xl, sheet_name=name, header=None)
        rows, cols = df.shape
        csv_fname = f"{safe_sheet_name(name)}.csv"
        summary["sheets"].append({
            "name": name,
            "rows": int(rows),
            "columns": int(cols),
            "csv_file": f"by_sheet/{csv_fname}",
        })
        csv_path = CSV_DIR / csv_fname
        df.to_csv(csv_path, index=False, encoding="utf-8")
        title = find_table_title(df, name)
        stype = sheet_type(name)
        index_rows.append({"sheet": name, "table_title": title, "filename": csv_fname, "type": stype})
        print(f"  Sheet '{name}': {rows} rows x {cols} cols -> {csv_path.name}  [{stype}]")

    summary_path = OUTPUT_DIR / "first_dataset_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print("\nSummary written to:", summary_path)

    # INDEX.csv: Documentation (Overview, Data Items) and Data (1.0–1.7)
    index_df = pd.DataFrame(index_rows)
    index_path = OUTPUT_DIR / "INDEX.csv"
    index_df.to_csv(index_path, index=False, encoding="utf-8")
    print("INDEX.csv written to:", index_path)
    print("Done. All sheets exported to CSV in", CSV_DIR)


if __name__ == "__main__":
    main()
