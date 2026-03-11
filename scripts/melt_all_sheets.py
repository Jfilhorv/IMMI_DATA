"""
1. Export each sheet from the XLSX as a single CSV (data/by_sheet/).
2. Melt each data table to long format for dashboard (data/melted/).

Long format: year (or period), variable (metric/category/country), value.
Documentation sheets (Overview, Data Items and Terminology) are exported as CSV
but not melted. Data tables (1.0–1.7 and others with a Year column) are melted.
"""
import re
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_XLSX = PROJECT_ROOT / "data" / "raw" / "migration_trends_statistical_package_2024_25.xlsx"
BY_SHEET_DIR = PROJECT_ROOT / "data" / "by_sheet"
MELTED_DIR = PROJECT_ROOT / "data" / "melted"

# Year pattern: 1984–85, 2015–16, 2024–25 (en-dash)
YEAR_PATTERN = re.compile(r"^\d{4}[–\-]\d{2}$")


def safe_sheet_name(name: str) -> str:
    return "".join(c if c.isalnum() or c in " -_" else "_" for c in name).strip() or "sheet"


def find_header_row(df: pd.DataFrame) -> int | None:
    """Find the 0-based row index where 'Year' (or 'Year2' etc.) appears (header row)."""
    for r in range(min(6, len(df))):
        for c in range(min(5, len(df.columns))):
            val = df.iloc[r, c]
            if pd.notna(val):
                s = str(val).strip()
                if s == "Year" or (s.startswith("Year") and s[4:5].isdigit()):
                    return r
    return None


def is_year_like(val) -> bool:
    if pd.isna(val):
        return False
    s = str(val).strip()
    return bool(YEAR_PATTERN.match(s))


def melt_sheet(df: pd.DataFrame, sheet_name: str) -> pd.DataFrame | None:
    """
    Detect header row, take data rows (year-like first column), melt to long.
    Returns melted DataFrame or None if not meltable (e.g. no Year column).
    """
    hr = find_header_row(df)
    if hr is None:
        return None
    # Use row hr as column names
    headers = df.iloc[hr].astype(str).str.strip()
    # Make unique column names (pandas needs unique)
    seen = {}
    new_headers = []
    for i, h in enumerate(headers):
        if h == "nan" or h == "":
            h = f"col_{i}"
        if h in seen:
            seen[h] += 1
            new_headers.append(f"{h}_{seen[h]}")
        else:
            seen[h] = 0
            new_headers.append(h)
    data_df = df.iloc[hr + 1 :].copy()
    data_df.columns = new_headers
    # Find the Year column (first column that has year-like values in header row was "Year")
    year_col = None
    for c in data_df.columns:
        cstr = str(c).strip() if pd.notna(c) else ""
        if cstr == "Year" or (cstr.startswith("Year") and (len(cstr) == 4 or cstr[4:5].isdigit())) or (data_df[c].astype(str).str.match(YEAR_PATTERN, na=False).any()):
            year_col = c
            break
    if year_col is None:
        # Use first column as id if it looks like year
        first_col = data_df.columns[0]
        if data_df[first_col].apply(is_year_like).any():
            year_col = first_col
        else:
            return None
    # Keep only data rows (year column matches YYYY–YY)
    data_df = data_df[data_df[year_col].apply(is_year_like)].copy()
    if data_df.empty:
        return None
    # Value columns: all except the year column; skip empty/unnamed first column
    id_vars = [year_col]
    value_vars = [
        c for c in data_df.columns
        if c not in id_vars
        and str(c).strip() not in ("", "nan")
        and str(c) != "col_0"  # unnamed first column often empty
    ]
    # Drop columns that are all NaN
    value_vars = [c for c in value_vars if data_df[c].notna().any()]
    if not value_vars:
        return None
    melted = pd.melt(
        data_df,
        id_vars=id_vars,
        value_vars=value_vars,
        var_name="variable",
        value_name="value",
    )
    melted["sheet"] = sheet_name
    # Coerce value to numeric where possible
    melted["value"] = pd.to_numeric(melted["value"], errors="coerce")
    return melted


def main() -> None:
    if not RAW_XLSX.exists():
        print("Missing XLSX. Run fetch_first_dataset.py first.")
        return
    BY_SHEET_DIR.mkdir(parents=True, exist_ok=True)
    MELTED_DIR.mkdir(parents=True, exist_ok=True)

    xl = pd.ExcelFile(RAW_XLSX)
    melted_count = 0
    for sheet_name in xl.sheet_names:
        df = pd.read_excel(xl, sheet_name=sheet_name, header=None)
        fname = safe_sheet_name(sheet_name)
        csv_path = BY_SHEET_DIR / f"{fname}.csv"
        df.to_csv(csv_path, index=False, encoding="utf-8")
        print(f"  CSV: {sheet_name} -> by_sheet/{fname}.csv")

        long_df = melt_sheet(df, sheet_name)
        if long_df is not None and not long_df.empty:
            out_path = MELTED_DIR / f"{fname}.csv"
            long_df.to_csv(out_path, index=False, encoding="utf-8")
            melted_count += 1
            print(f"    Melted -> melted/{fname}.csv  ({len(long_df)} rows)")
        else:
            print(f"    (no melt: no Year column or no data rows)")

    print(f"\nDone. {len(xl.sheet_names)} CSVs in by_sheet/, {melted_count} melted in melted/.")


if __name__ == "__main__":
    main()
