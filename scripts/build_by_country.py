"""
Build by-country dataset from dashboard indicators + tables.json.

Reads:
  - dashboard/data/indicators.csv (indicator, year, value, table, category)
  - dashboard/data/tables.json (id, section, title, shortTitle)

Output:
  - dashboard/data/by_country/countries.json  — list of all country names (normalized)
  - dashboard/data/by_country/{country_slug}.json — per country: context + Section, Table, Indicator, columns, data
  - dashboard/data/by_country/{country_slug}.md  — human-readable summary per country

Tables that are "by country" (indicator = country name): same as MAP_TABLES in app.js.
"""
from pathlib import Path
import json
import re

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DASHBOARD_DATA = PROJECT_ROOT / "dashboard" / "data"
OUT_DIR = DASHBOARD_DATA / "by_country"

# Tables where "indicator" column holds country names (top N citizenship/country tables)
COUNTRY_TABLES = [
    "1_3", "1_6", "1_8", "1_10", "1_12", "1_14", "1_15", "1_16", "1_17",
    "2_4", "3_1", "3_3", "4_1", "4_4", "6_0",
]

# Exclude from country list (aggregates / not real countries)
SKIP_INDICATORS = re.compile(r"^(Total|Other)\d*$", re.I)


def normalize_country_name(name: str) -> str:
    """Strip trailing digits (e.g. People's Republic of China1 -> People's Republic of China)."""
    if not name or pd.isna(name):
        return ""
    s = str(name).strip()
    return re.sub(r"\d+$", "", s).strip() or s


def slug(s: str) -> str:
    """File-safe slug for country (e.g. Brazil, People's Republic of China)."""
    s = str(s).strip().lower()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[-\s]+", "_", s)
    return s[:80] or "unknown"


def write_summary_md(path: Path, country_name: str, by_table: list) -> None:
    """Write a short Markdown summary for the country."""
    lines = [
        f"# {country_name}",
        "",
        "Summary of Australian migration data where this country appears (citizenship / country of origin).",
        "",
        "---",
        "",
    ]
    for t in by_table:
        lines.append(f"## {t['short_title']}")
        lines.append("")
        lines.append(f"- **Section:** {t['section']}  ")
        lines.append(f"- **Table:** {t['table_id']}  ")
        lines.append(f"- **Indicator:** {t['indicator']}  ")
        lines.append("")
        data = t["data"]
        if not data:
            lines.append("*No data.*")
        elif len(data) <= 12 and not any(d.get("category") for d in data):
            # Small series: show as table
            lines.append("| Year | Value |")
            lines.append("|------|-------|")
            for row in data:
                y = row.get("year", "")
                v = row.get("value", "")
                if isinstance(v, float) and v == int(v):
                    v = int(v)
                lines.append(f"| {y} | {v} |")
        elif any(d.get("category") for d in data):
            lines.append("| Category | Value |")
            lines.append("|----------|-------|")
            for row in data:
                cat = row.get("category", "")
                v = row.get("value", "")
                if isinstance(v, float) and v == int(v):
                    v = int(v)
                lines.append(f"| {cat} | {v} |")
        else:
            # Long series: last 3 years + total count
            years = sorted([r["year"] for r in data if isinstance(r.get("year"), int)], reverse=True)
            last_3 = years[:3]
            subset = [r for r in data if r.get("year") in last_3]
            lines.append("| Year | Value |")
            lines.append("|------|-------|")
            for row in sorted(subset, key=lambda x: x.get("year", 0), reverse=True):
                y = row.get("year", "")
                v = row.get("value", "")
                if isinstance(v, float) and v == int(v):
                    v = int(v)
                lines.append(f"| {y} | {v} |")
            lines.append("")
            lines.append(f"*Total data points in series: {len(data)} (years {min(years)}–{max(years)}).*")
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    indicators_path = DASHBOARD_DATA / "indicators.csv"
    tables_path = DASHBOARD_DATA / "tables.json"
    if not indicators_path.exists() or not tables_path.exists():
        raise FileNotFoundError("Run build_dashboard_data first: need indicators.csv and tables.json")

    df = pd.read_csv(indicators_path, encoding="utf-8")
    with open(tables_path, encoding="utf-8") as f:
        tables = {t["id"]: t for t in json.load(f)}

    # Section labels (from table titles; section number only in JSON)
    section_names = {
        1: "Permanent migration",
        2: "Temporary migration",
        3: "Humanitarian",
        4: "Visa cancellations and departures",
        5: "Net Overseas Migration",
        6: "Citizenship",
        7: "Labour market",
    }

    country_rows = df[df["table"].isin(COUNTRY_TABLES)].copy()
    country_rows = country_rows[~country_rows["indicator"].astype(str).str.match(SKIP_INDICATORS, na=False)]

    # Unique country names (normalized for listing)
    raw_names = country_rows["indicator"].astype(str).str.strip().unique()
    normalized = {normalize_country_name(n): n for n in raw_names if normalize_country_name(n)}
    countries_sorted = sorted(normalized.keys(), key=str.lower)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # countries.json — list of all countries
    countries_meta = [{"name": c, "slug": slug(c)} for c in countries_sorted]
    with open(OUT_DIR / "countries.json", "w", encoding="utf-8") as f:
        json.dump(countries_meta, f, indent=2, ensure_ascii=False)
    print(f"Countries: {OUT_DIR / 'countries.json'}  ({len(countries_sorted)} countries)")

    summaries_for_dashboard = []

    # Per-country files: context + Section, Table, Indicator, columns, data
    for country_name in countries_sorted:
        # All raw indicator names that normalize to this country (e.g. China1, China2 -> People's Republic of China)
        raw_names_for_country = [raw for raw in raw_names if normalize_country_name(raw) == country_name]
        subset = country_rows[country_rows["indicator"].astype(str).str.strip().isin(raw_names_for_country)]
        if subset.empty:
            continue

        by_table = []
        for table_id, grp in subset.groupby("table"):
            tinfo = tables.get(table_id, {})
            section_id = tinfo.get("section", 0)
            section_label = section_names.get(section_id, f"Section {section_id}")
            rows = []
            for _, r in grp.iterrows():
                row = {"year": int(r["year"]) if pd.notna(r["year"]) and str(r["year"]).isdigit() else r["year"], "value": float(r["value"])}
                if pd.notna(r.get("category")) and str(r.get("category", "")).strip():
                    row["category"] = str(r["category"]).strip()
                rows.append(row)
            rows.sort(key=lambda x: (x.get("category", ""), x["year"] if isinstance(x["year"], int) else 0))

            by_table.append({
                "section_id": section_id,
                "section": section_label,
                "table_id": table_id,
                "table_title": tinfo.get("title", ""),
                "short_title": tinfo.get("shortTitle", ""),
                "indicator": country_name,
                "columns": ["year", "value"] + (["category"] if grp["category"].astype(str).str.strip().any() else []),
                "data": rows,
            })

        by_table.sort(key=lambda x: (x["section_id"], x["table_id"]))
        out = {
            "country": country_name,
            "context": f"All tables where this country appears (citizenship / country of origin).",
            "section_table_indicator": [
                {
                    "section": x["section"],
                    "table": x["table_id"],
                    "table_title": x["short_title"],
                    "indicator": x["indicator"],
                }
                for x in by_table
            ],
            "tables": by_table,
        }
        path_json = OUT_DIR / f"{slug(country_name)}.json"
        with open(path_json, "w", encoding="utf-8") as f:
            json.dump(out, f, indent=2, ensure_ascii=False)
        path_md = OUT_DIR / f"{slug(country_name)}.md"
        write_summary_md(path_md, country_name, by_table)
        print(f"  {slug(country_name)}: {len(by_table)} tables, {subset.shape[0]} rows -> .json + .md")

        # Short blurb for dashboard spotlight (English)
        table_labels = [t["short_title"] for t in by_table]
        if len(table_labels) <= 3:
            tables_phrase = ", ".join(table_labels)
        else:
            tables_phrase = ", ".join(table_labels[:2]) + " and " + str(len(table_labels) - 2) + " other tables"
        latest_vals = []
        for t in by_table:
            if t["data"]:
                d = t["data"][-1]
                v = d.get("value")
                if v is not None:
                    latest_vals.append((t["short_title"], v))
        n_tables = len(by_table)
        table_word = "table" if n_tables == 1 else "tables"
        if latest_vals:
            sample = latest_vals[0]
            summary = f"{country_name} appears in {n_tables} {table_word}: {tables_phrase}. Latest: {sample[0]} = {int(sample[1]):,}."
        else:
            summary = f"{country_name} appears in {n_tables} {table_word}: {tables_phrase}. Select a map table and indicator for figures."
        summaries_for_dashboard.append({"name": country_name, "slug": slug(country_name), "summary": summary})

    with open(OUT_DIR / "summaries.json", "w", encoding="utf-8") as f:
        json.dump(summaries_for_dashboard, f, indent=2, ensure_ascii=False)
    print(f"\nSummaries: {OUT_DIR / 'summaries.json'}  ({len(summaries_for_dashboard)} entries)")

    print(f"\nDone. By-country files in {OUT_DIR} (JSON + MD + summaries)")


if __name__ == "__main__":
    main()
