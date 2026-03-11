# Melted (long) CSVs — for dashboard

Each file here is the **long-format** version of a sheet: one row per (year, variable) with a single **value**. This shape is better for filtering, grouping, and charting in the dashboard.

## Columns (all melted files)

| Column   | Description |
|----------|-------------|
| **Year** | Time period (e.g. `1984–85`, `2015–16`, `2024–25`). |
| **variable** | Category name: stream (Skill stream, Family stream), country (India, United Kingdom), occupation, visa type, etc. |
| **value** | Numeric value (count or rate). Empty where not applicable. |
| **sheet** | Source sheet (e.g. `1.0`, `1.1`, `1.3`). |

## Which sheets are melted

- **Documentation** (Overview, Data Items and Terminology) are **not** melted; they stay in `by_sheet/` only.
- **Data tables** that have a **Year** (or Year2) column and numeric value columns are melted.  
  That includes 1.0–1.18, 2.0–2.4, 3.0–3.4, 4.0–4.4.  
  Some 5.x, 6.x, 7.x use different layouts (e.g. “Year ending December”) and are not melted.

## Examples

- **1_0.csv**: Year × variable (Skill stream, Family stream, Child stream, …) → value (program outcome).
- **1_1.csv**: Year × variable (Employer Sponsored, State/Territory Nominated, …) → value.
- **1_3.csv**: Year × variable (India, United Kingdom, Philippines, …) → value (Employer Sponsored visas by citizenship).

## How to regenerate

From project root:

```bash
python scripts/melt_all_sheets.py
```

This script (1) writes every sheet to `by_sheet/*.csv` and (2) melts each table that has a Year column into `melted/*.csv`.
