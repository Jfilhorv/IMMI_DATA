"""
Convert melted data to dashboard-ready structure:

  indicator, year, value
  [table]   (optional column for combined file)

- Year: financial year "1984–85" → integer 1984 (start year).
- One combined CSV: indicator, year, value, table (for filter by table + indicator).
- Per-table CSVs: indicator, year, value (one table = one chart dataset).
- Optional: indicator_metadata.csv (indicator_id, indicator_name, category).

Dashboard logic: User selects indicator → filter where indicator = selected → chart.
"""
import re
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MELTED_DIR = PROJECT_ROOT / "data" / "melted"
DASHBOARD_DIR = PROJECT_ROOT / "data" / "dashboard"

# Financial year: 1984–85, 2015–16, 1999–00 → start year
FY_PATTERN = re.compile(r"^(\d{4})[–\-]\d{2}$")


def financial_year_to_int(s) -> int | None:
    """Convert '1984–85' or '2015-16' to 1984, 2015; also plain '2015' (calendar year)."""
    if pd.isna(s):
        return None
    t = str(s).strip()
    m = FY_PATTERN.match(t)
    if m:
        return int(m.group(1))
    if len(t) == 4 and t.isdigit():
        return int(t)
    return None


def slug(s: str) -> str:
    """Simple slug for indicator_id: lowercase, spaces to underscores, drop special."""
    s = str(s).strip().lower()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[-\s]+", "_", s)
    return s[:80] or "unknown"


def main() -> None:
    DASHBOARD_DIR.mkdir(parents=True, exist_ok=True)

    combined_rows = []
    all_indicators = []  # (table, indicator_name) for metadata
    category_tables = []  # table IDs that use category on X-axis

    for csv_path in sorted(MELTED_DIR.glob("*.csv")):
        table = csv_path.stem  # e.g. 1_0, 7_1
        df = pd.read_csv(csv_path, encoding="utf-8")
        if df.empty or "variable" not in df.columns:
            continue

        if "Category" in df.columns:
            # Category-based table (e.g. 7.1, 7.2): Category on X-axis, no year
            df = df.rename(columns={"variable": "indicator", "value": "value"})
            df["year"] = 0  # sentinel for category tables
            df = df.drop(columns=["sheet"], errors="ignore")
            df = df[["indicator", "year", "value", "Category"]].copy()
            df = df.rename(columns={"Category": "category"})
            df = df.dropna(subset=["indicator"])
            df["value"] = pd.to_numeric(df["value"], errors="coerce")
            df = df.dropna(subset=["value"])
            if df.empty:
                continue
            category_tables.append(table)
        elif "Year" in df.columns:
            # Year-based table
            df = df.rename(columns={"variable": "indicator", "value": "value"})
            df["year"] = df["Year"].apply(financial_year_to_int)
            df = df.drop(columns=["Year", "sheet"], errors="ignore")
            df = df[["indicator", "year", "value"]].dropna(subset=["year", "indicator"])
            df["value"] = pd.to_numeric(df["value"], errors="coerce")
            df = df.dropna(subset=["value"])
            if df.empty:
                continue
            df["category"] = ""
        else:
            continue

        # Per-table CSV
        out_cols = ["indicator", "year", "value"] + (["category"] if "category" in df.columns and df["category"].astype(str).str.strip().any() else [])
        out_df = df[[c for c in out_cols if c in df.columns]].copy()
        out_path = DASHBOARD_DIR / f"{table}.csv"
        out_df.to_csv(out_path, index=False, encoding="utf-8")
        print(f"  {table}.csv: {len(out_df)} rows, {out_df['indicator'].nunique()} indicators" + (" [category]" if table in category_tables else ""))

        # Append to combined with table column
        df_combined = df.copy()
        df_combined["table"] = table
        if "category" not in df_combined.columns:
            df_combined["category"] = ""
        combined_rows.append(df_combined)
        for ind in df["indicator"].unique():
            all_indicators.append((table, str(ind).strip()))

    if not combined_rows:
        print("No melted CSVs found.")
        return

    combined = pd.concat(combined_rows, ignore_index=True)
    combined = combined[["indicator", "year", "value", "table", "category"]]
    combined_path = DASHBOARD_DIR / "indicators.csv"
    combined.to_csv(combined_path, index=False, encoding="utf-8")
    print(f"\nCombined: {combined_path}  ({len(combined)} rows)")

    # List of tables that use category dimension (4th menu / category on X-axis)
    import json
    cat_path = DASHBOARD_DIR / "category_tables.json"
    with open(cat_path, "w", encoding="utf-8") as f:
        json.dump(category_tables, f, indent=2)
    print(f"Category tables: {cat_path}  ({len(category_tables)} tables)")

    # Indicator metadata: indicator_id, indicator_name, category (table)
    seen = set()
    meta_rows = []
    for table, name in all_indicators:
        key = (table, name)
        if key in seen:
            continue
        seen.add(key)
        meta_rows.append({
            "indicator_id": slug(f"{table}_{name}"),
            "indicator_name": name,
            "category": table,
        })
    meta = pd.DataFrame(meta_rows)
    meta_path = DASHBOARD_DIR / "indicator_metadata.csv"
    meta.to_csv(meta_path, index=False, encoding="utf-8")
    print(f"Metadata: {meta_path}  ({len(meta)} indicators)")

    print("\nDashboard structure:")
    print("  indicator,year,value[,table]")
    print("  Dropdown -> filter indicator -> chart (auto rescale by selected data)")


if __name__ == "__main__":
    main()
