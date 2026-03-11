"""
Build data/INDEX.csv from the existing XLSX (sheet name, table title, filename, type).
Documentation = Overview, Data Items and Terminology. Data = 1.0 to 1.7. No download.
"""
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_XLSX = PROJECT_ROOT / "data" / "raw" / "migration_trends_statistical_package_2024_25.xlsx"
OUTPUT_DIR = PROJECT_ROOT / "data"


def safe_sheet_name(name: str) -> str:
    return "".join(c if c.isalnum() or c in " -_" else "_" for c in name).strip() or "sheet"


def find_table_title(df: pd.DataFrame, sheet_name: str) -> str:
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
    if sheet_name in ("Overview", "Data Items and Terminology"):
        return "Documentation"
    if sheet_name in ("1.0", "1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7"):
        return "Data"
    return "Other"


def main() -> None:
    if not RAW_XLSX.exists():
        print("Run fetch_first_dataset.py first. Missing:", RAW_XLSX)
        return
    xl = pd.ExcelFile(RAW_XLSX)
    index_rows = []
    for name in xl.sheet_names:
        df = pd.read_excel(xl, sheet_name=name, header=None)
        title = find_table_title(df, name)
        stype = sheet_type(name)
        index_rows.append({
            "sheet": name,
            "table_title": title,
            "filename": f"{safe_sheet_name(name)}.csv",
            "type": stype,
        })
    index_df = pd.DataFrame(index_rows)
    index_path = OUTPUT_DIR / "INDEX.csv"
    index_df.to_csv(index_path, index=False, encoding="utf-8")
    print("INDEX.csv written to:", index_path)


if __name__ == "__main__":
    main()
