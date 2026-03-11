# Data folder — CSV

We use **CSV** for all sheet exports. No Markdown for data.

## Contents

| Path | Description |
|------|-------------|
| **raw/** | Original XLSX from data.gov.au. |
| **by_sheet/** | One CSV per sheet (wide format; same layout as the workbook). |
| **melted/** | Long-format CSV per meltable table (Year, variable, value, sheet). |
| **dashboard/** | **indicator, year, value** (integer year). One combined `indicators.csv` + per-table CSVs + `indicator_metadata.csv`. For Metabase/Superset or any dropdown + chart dashboard. |
| **INDEX.csv** | List of sheets with **table title** (from the workbook), filename, and **type**: Documentation or Data. |
| **first_dataset_summary.json** | Row/column counts and CSV filenames. |

## Documentation vs Data

| Type | Sheets | Description |
|------|--------|-------------|
| **Documentation** | Overview, Data Items and Terminology | Report overview, caveats, terminology. |
| **Data** | **1.0 to 1.7** | Migration program and skill stream tables (when, from, to, across years). |
| Other | 1.8+ and 2.x–7.x | Extra tables; also exported as CSV in `by_sheet/`. |

## INDEX.csv columns

- **sheet** — Sheet name (e.g. `1.0`, `Overview`).
- **table_title** — Title from the workbook (e.g. "Table 1.0: Australia's Migration Program outcome, 1984–85 to 2024–25").
- **filename** — CSV file in `by_sheet/` (e.g. `1_0.csv`, `Overview.csv`).
- **type** — `Documentation` | `Data` | `Other`.

## First dataset: Australian Migration Statistics 2024–25

- **Source:** [data.gov.au – Australian Migration Statistics](https://data.gov.au/data/dataset/australian-migration-statistics)
- **File:** `raw/migration_trends_statistical_package_2024_25.xlsx`
- **Documentation:** Overview, Data Items and Terminology (CSV in `by_sheet/`).
- **Data:** 1.0–1.7 (CSV in `by_sheet/`).

## How to regenerate

From project root:

```bash
pip install -r requirements.txt
python scripts/fetch_first_dataset.py   # download XLSX, export by_sheet/*.csv, write INDEX.csv
python scripts/melt_all_sheets.py       # export all to by_sheet/ again + melt to melted/*.csv
```

Or run only the melt (no download):

```bash
python scripts/melt_all_sheets.py
```

This writes every sheet to `by_sheet/*.csv` and melts each table that has a Year column into `melted/*.csv` (long format: Year, variable, value, sheet). See [melted/README.md](melted/README.md).
