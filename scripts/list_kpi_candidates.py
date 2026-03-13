"""
Generate list of (table, indicator) pairs that have 3+ years of data for KPI sparklines.
Output: data/dashboard/kpi_candidates_list.md and a JSON summary.
"""
import csv
from pathlib import Path
from collections import defaultdict

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = PROJECT_ROOT / "data" / "dashboard" / "indicators.csv"
OUT_MD = PROJECT_ROOT / "data" / "dashboard" / "kpi_candidates_list.md"
OUT_JSON = PROJECT_ROOT / "data" / "dashboard" / "kpi_candidates.json"
OUT_JSON_DASH = PROJECT_ROOT / "dashboard" / "data" / "kpi_candidates.json"

def main():
    # (table, indicator) -> set of years (only year > 0 for time series)
    by_table_indicator = defaultdict(lambda: set())
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                y = int(float(row.get("year", 0)))
            except (ValueError, TypeError):
                continue
            if y <= 0:
                continue
            table = (row.get("table") or "").strip()
            ind = (row.get("indicator") or "").strip()
            if not table or not ind:
                continue
            by_table_indicator[(table, ind)].add(y)

    # Filter: at least 3 distinct years for sparkline
    candidates = [(t, i, len(ys)) for (t, i), ys in by_table_indicator.items() if len(ys) >= 3]
    candidates.sort(key=lambda x: (x[0], x[1]))

    # By table
    by_table = defaultdict(list)
    for t, ind, n_years in candidates:
        by_table[t].append((ind, n_years))

    # Build markdown list
    lines = [
        "# KPI candidates (tables and indicators with 3+ years for sparkline)",
        "",
        "Generated for dynamic KPIs: each table can show up to 5 indicators with YoY% and 3-point sparkline.",
        "",
        "## By table",
        ""
    ]
    for table in sorted(by_table.keys(), key=lambda t: (int(t.split("_")[0]) if "_" in t else 0, int(t.split("_")[1]) if "_" in t and t.split("_")[1].isdigit() else 0)):
        indicators = by_table[table]
        lines.append(f"### Table {table}")
        lines.append(f"- **{len(indicators)} indicators** with 3+ years")
        for ind, n in sorted(indicators, key=lambda x: (-x[1], x[0])):
            lines.append(f"  - {ind} ({n} years)")
        lines.append("")

    # Summary stats
    total_pairs = len(candidates)
    total_tables = len(by_table)
    lines.insert(6, f"**Total: {total_tables} tables, {total_pairs} (table, indicator) pairs with 3+ years.**")
    lines.insert(7, "")

    OUT_MD.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_MD, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    # JSON: { "tableId": [ "indicator1", "indicator2", ... ], ... } (order: prefer Total, then by years desc)
    def sort_indicators(items):
        def key(x):
            ind, n = x
            total_first = 1 if (ind == "Total" or ind.startswith("Total") or " total" in ind.lower()) else 0
            return (-total_first, -n, ind)
        return [ind for ind, _ in sorted(items, key=key)]

    import json
    json_by_table = {t: sort_indicators(inds) for t, inds in sorted(by_table.items())}
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(json_by_table, f, indent=2)
    OUT_JSON_DASH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_JSON_DASH, "w", encoding="utf-8") as f:
        json.dump(json_by_table, f, indent=2)

    print(f"Wrote {OUT_MD} ({total_tables} tables, {total_pairs} pairs)")
    print(f"Wrote {OUT_JSON} and {OUT_JSON_DASH}")

if __name__ == "__main__":
    main()
