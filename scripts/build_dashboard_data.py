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
    """Convert '1984–85' or '2015-16' to 1984, 2015. Returns None if not matched."""
    if pd.isna(s):
        return None
    m = FY_PATTERN.match(str(s).strip())
    return int(m.group(1)) if m else None


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

    for csv_path in sorted(MELTED_DIR.glob("*.csv")):
        table = csv_path.stem  # e.g. 1_0, 1_1
        df = pd.read_csv(csv_path, encoding="utf-8")
        if df.empty or "Year" not in df.columns or "variable" not in df.columns:
            continue
        df = df.rename(columns={"variable": "indicator", "value": "value"})
        df["year"] = df["Year"].apply(financial_year_to_int)
        df = df.drop(columns=["Year", "sheet"], errors="ignore")
        df = df[["indicator", "year", "value"]].dropna(subset=["year", "indicator"])
        df["value"] = pd.to_numeric(df["value"], errors="coerce")
        df = df.dropna(subset=["value"])
        if df.empty:
            continue
        # Per-table CSV: indicator, year, value
        out_path = DASHBOARD_DIR / f"{table}.csv"
        df.to_csv(out_path, index=False, encoding="utf-8")
        print(f"  {table}.csv: {len(df)} rows, {df['indicator'].nunique()} indicators")
        # Append to combined with table column
        df_combined = df.copy()
        df_combined["table"] = table
        combined_rows.append(df_combined)
        for ind in df["indicator"].unique():
            all_indicators.append((table, str(ind).strip()))

    if not combined_rows:
        print("No melted CSVs found.")
        return

    combined = pd.concat(combined_rows, ignore_index=True)
    combined = combined[["indicator", "year", "value", "table"]]
    combined_path = DASHBOARD_DIR / "indicators.csv"
    combined.to_csv(combined_path, index=False, encoding="utf-8")
    print(f"\nCombined: {combined_path}  ({len(combined)} rows)")

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
