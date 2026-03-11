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

# Year patterns: 1984–85, 2015–16 (financial); 2015, 2024 (calendar)
YEAR_PATTERN = re.compile(r"^\d{4}[–\-]\d{2}$")
CALENDAR_YEAR_PATTERN = re.compile(r"^\d{4}$")


def safe_sheet_name(name: str) -> str:
    return "".join(c if c.isalnum() or c in " -_" else "_" for c in name).strip() or "sheet"


# First-column labels that indicate a category (row) dimension instead of Year
CATEGORY_ROW_LABELS = (
    "Years in Australia",
    "Birth group",
    "Gender",
    "Years in Australia,",
)
# Header names that are row-dimension columns (category), not value columns
CATEGORY_HEADER_NAMES = ("Years in Australia", "Birth group", "Gender")


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


def find_category_header_row(df: pd.DataFrame) -> int | None:
    """Find a header row where the first non-empty column is a category label (e.g. 'Years in Australia')."""
    for r in range(min(10, len(df))):
        if r + 2 > len(df):
            break
        first_val = None
        for c in range(min(3, len(df.columns))):
            v = df.iloc[r, c]
            if pd.notna(v) and str(v).strip() and str(v).strip() != "nan":
                first_val = v
                break
        if first_val is None:
            continue
        s = str(first_val).strip()
        if any(s.startswith(label.rstrip(",")) or label.rstrip(",") in s for label in CATEGORY_ROW_LABELS):
            row_vals = df.iloc[r]
            non_empty = sum(1 for v in row_vals if pd.notna(v) and str(v).strip() and str(v).strip() != "nan")
            if non_empty >= 2:
                return r
    return None


def get_group_row_categories(df: pd.DataFrame, header_row: int) -> list[str]:
    """
    If the row above the header row contains group labels (merged cells), return a list of
    category strings per column (forward-filled). Otherwise return empty list per column.
    """
    if header_row <= 0:
        return [""] * len(df.columns)
    group_row = df.iloc[header_row - 1]
    categories = []
    last = ""
    for c in range(len(group_row)):
        val = group_row.iloc[c]
        if pd.notna(val):
            s = str(val).strip()
            if s and s != "nan":
                last = s
        categories.append(last)
    # Only use if we actually have meaningful groups (more than one distinct, non-empty)
    distinct = [c for c in categories if c]
    if len(set(distinct)) < 2:
        return [""] * len(df.columns)
    return categories


def is_year_like(val) -> bool:
    if pd.isna(val):
        return False
    s = str(val).strip()
    return bool(YEAR_PATTERN.match(s)) or bool(CALENDAR_YEAR_PATTERN.match(s))


def melt_sheet(df: pd.DataFrame, sheet_name: str) -> pd.DataFrame | None:
    """
    Detect header row, take data rows (year-like first column), melt to long.
    Returns melted DataFrame or None if not meltable (e.g. no Year column).
    """
    hr = find_header_row(df)
    if hr is None:
        return None
    # Use row hr as column names; optional group row above for submenu/category
    headers = df.iloc[hr].astype(str).str.strip()
    categories = get_group_row_categories(df, hr)
    # Build unique column names: "Category | Header" when we have a category (hierarchical table)
    seen = {}
    new_headers = []
    for i, h in enumerate(headers):
        if h == "nan" or h == "":
            h = f"col_{i}"
        cat = categories[i].strip() if i < len(categories) else ""
        if cat and h not in ("Year", "nan"):
            label = f"{cat} | {h}"
        else:
            label = h
        if label in seen:
            seen[label] += 1
            new_headers.append(f"{label}_{seen[label]}")
        else:
            seen[label] = 0
            new_headers.append(label)
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


def _is_value_column_header(s: str) -> bool:
    """True if header looks like a value column (age range, number), not a row dimension."""
    if not s or s == "nan":
        return False
    s = str(s).strip()
    # Age range e.g. 15–19, 65+
    if re.match(r"^\d+[–\-]\d+$", s) or re.match(r"^\d+\+?$", s):
        return True
    if s in ("All age groups", "Total change"):
        return True
    return False


def melt_sheet_category(df: pd.DataFrame, sheet_name: str) -> pd.DataFrame | None:
    """
    Melt sheets that have a category (row) dimension instead of Year.
    Output: Category, variable, value, sheet. Category may be composite (e.g. "Australian-born | Male").
    """
    hr = find_category_header_row(df)
    if hr is None:
        return None
    headers = df.iloc[hr].astype(str).str.strip()
    group_cats = get_group_row_categories(df, hr)
    # Build column names with optional "Group | Header"
    seen = {}
    new_headers = []
    for i, h in enumerate(headers):
        if h == "nan" or h == "":
            h = f"col_{i}"
        cat = group_cats[i].strip() if i < len(group_cats) else ""
        if cat and h not in ("nan",):
            label = f"{cat} | {h}"
        else:
            label = h
        if label in seen:
            seen[label] += 1
            new_headers.append(f"{label}_{seen[label]}")
        else:
            seen[label] = 0
            new_headers.append(label)
    data_df = df.iloc[hr + 1 :].copy()
    data_df.columns = new_headers
    # Category columns = only those with known row-dimension header names
    category_cols = []
    for c in data_df.columns:
        h = str(c).strip()
        if h in ("", "nan") or h == "col_0":
            continue
        if h in CATEGORY_HEADER_NAMES:
            category_cols.append(c)
        elif category_cols:
            break
        else:
            break
    if not category_cols:
        category_cols = [data_df.columns[0]]
    value_vars = [c for c in data_df.columns if c not in category_cols and str(c).strip() not in ("", "nan")]
    value_vars = [c for c in value_vars if data_df[c].notna().any()]
    if not value_vars:
        return None
    # Build composite category from category columns
    def make_category(row):
        parts = [str(row[c]).strip() for c in category_cols if pd.notna(row[c]) and str(row[c]).strip() and str(row[c]).strip() != "nan"]
        return " | ".join(parts) if parts else ""

    data_df = data_df.dropna(how="all", subset=value_vars)
    if data_df.empty:
        return None
    data_df["_category_"] = data_df.apply(make_category, axis=1)
    id_vars = ["_category_"]
    melted = pd.melt(
        data_df,
        id_vars=id_vars,
        value_vars=value_vars,
        var_name="variable",
        value_name="value",
    )
    melted = melted.rename(columns={"_category_": "Category"})
    melted["sheet"] = sheet_name
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
        if long_df is None or long_df.empty:
            long_df = melt_sheet_category(df, sheet_name)
            if long_df is not None and not long_df.empty:
                out_path = MELTED_DIR / f"{fname}.csv"
                long_df.to_csv(out_path, index=False, encoding="utf-8")
                melted_count += 1
                print(f"    Melted (category) -> melted/{fname}.csv  ({len(long_df)} rows)")
            else:
                print(f"    (no melt: no Year/category column or no data rows)")
        else:
            out_path = MELTED_DIR / f"{fname}.csv"
            long_df.to_csv(out_path, index=False, encoding="utf-8")
            melted_count += 1
            print(f"    Melted -> melted/{fname}.csv  ({len(long_df)} rows)")

    print(f"\nDone. {len(xl.sheet_names)} CSVs in by_sheet/, {melted_count} melted in melted/.")


if __name__ == "__main__":
    main()
