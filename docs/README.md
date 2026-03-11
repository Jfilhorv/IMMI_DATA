# Documentation

We use **CSV** as the main format for the workbook content.

## Where the data lives (CSV)

- **data/by_sheet/** — One CSV per sheet (same content as the XLSX).
- **data/INDEX.csv** — List of all sheets with:
  - **sheet** — e.g. `1.0`, `Overview`
  - **table_title** — e.g. "Table 1.0: Australia's Migration Program outcome, 1984–85 to 2024–25"
  - **filename** — e.g. `1_0.csv`, `Overview.csv`
  - **type** — `Documentation` | `Data` | `Other`

## Documentation vs Data

| Type | Sheets |
|------|--------|
| **Documentation** | Overview, Data Items and Terminology |
| **Data** | **1.0 to 1.7** |
| Other | 1.8+ and 2.x–7.x (also in CSV) |

The **table title** in INDEX.csv is the same text as in the first row of each sheet in the workbook (e.g. "Table 1.0: ...").

See [data/README.md](../data/README.md) for how to regenerate the CSVs and INDEX.
