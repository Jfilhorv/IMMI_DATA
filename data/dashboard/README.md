# Dashboard-ready data

Structure: **indicator**, **year**, **value**. Same as Tableau, Power BI, Metabase, Superset: one chart + indicator filter.

## Files

| File | Description |
|------|--------------|
| **indicators.csv** | All data: `indicator`, `year`, `value`, `table`. Use for one dashboard that can filter by table and indicator. |
| **1_0.csv**, **1_1.csv**, … | One file per table: `indicator`, `year`, `value`. Use for a single-table dashboard (e.g. "Migration Program 1.0" only). |
| **indicator_metadata.csv** | `indicator_id`, `indicator_name`, `category` (table). Optional for dropdown labels and grouping. |

## Data structure

```text
indicator       year    value
Skill stream    1984    10100
Family stream   1984    43000
Child stream    1984    1200
Skill stream    1985    16200
...
```

- **year**: Integer (start of financial year). 1984–85 → 1984.
- **indicator**: Category name (stream, country, visa type, etc.).
- **value**: Numeric (counts). Different indicators can have different year ranges; the chart rescales to the selected indicator.

## Dashboard logic

1. User selects **indicator** (e.g. from dropdown: "Skill stream", "Family stream", "India").
2. Filter dataset where `indicator = selected`.
3. Render chart (e.g. bar or line: year vs value). Axis rescales to the filtered data.

Example: 35 indicators × 40 years ≈ 1,400 rows per table — small and fine for the browser.

## Regenerate

From project root:

```bash
python scripts/build_dashboard_data.py
```

Requires `data/melted/*.csv` (from `scripts/melt_all_sheets.py`).
