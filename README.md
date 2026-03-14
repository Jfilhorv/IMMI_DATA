# Australian Immigration Data Dashboard

A **free, public** dashboard and webpage showing Australian immigration statistics from official government sources: **when** (year/quarter/month), **from** (country), **to** (Australia), **across years**.

---

<div align="center">

[<img src="dashboard/logo_immi_data.png" alt="IMMI-DATA" height="160" style="vertical-align: middle;" />](https://jfilhorv.github.io/IMMI_DATA/dashboard/) **Australian Immigration — Indicator Dashboard**

7 sections · 46 tables · 577 indicators · [Indicator tree](https://jfilhorv.github.io/IMMI_DATA/dashboard/tree.html) (visual hierarchy)

[![Open live dashboard](https://img.shields.io/badge/🌐_Live_Dashboard-Open_here-1e40af?style=for-the-badge)](https://jfilhorv.github.io/IMMI_DATA/dashboard/)

</div>

---

## Links

| What | URL |
|------|-----|
| **Live dashboard** | [https://jfilhorv.github.io/IMMI_DATA/dashboard/](https://jfilhorv.github.io/IMMI_DATA/dashboard/) |
| **Indicator tree (list)** | [https://jfilhorv.github.io/IMMI_DATA/dashboard/tree.html](https://jfilhorv.github.io/IMMI_DATA/dashboard/tree.html) |
| **Indicator tree (diagram)** | [https://jfilhorv.github.io/IMMI_DATA/docs/indicator_tree.drawio.html](https://jfilhorv.github.io/IMMI_DATA/docs/indicator_tree.drawio.html) |
| **Repository** | [https://github.com/Jfilhorv/IMMI_DATA](https://github.com/Jfilhorv/IMMI_DATA) |

## Data source (where the data comes from)

All statistics shown in the dashboard come from the following official release:

- **Dataset:** [Australian Migration Statistics](https://data.gov.au/data/dataset/australian-migration-statistics)  
- **Publisher:** Department of Home Affairs, Australian Government  
- **Portal:** [data.gov.au](https://data.gov.au)  
- **Content:** Migration program outcomes (permanent and temporary), humanitarian, visa cancellations, Net Overseas Migration, citizenship, labour market. Tables 1.0–7.8, financial year series.  
- **Licence:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — attribution required; we attribute in the dashboard and do not imply government endorsement.

**Current data:** Last update uses the **2024–25** statistical package. File name: `migration_trends_statistical_package_2024_25.xlsx`. Full download URL: [data.gov.au resource 2024-25](https://data.gov.au/data/dataset/dba45e7c-81f4-44aa-9d82-1b9a0a121017/resource/242e6794-9b6a-4d34-a67f-d940e96e6a37/download/migration_trends_statistical_package_2024_25.xlsx). New releases (e.g. 2025–26) typically appear after the end of the financial year (check the dataset page).

**How to update:** See [docs/DATA_AND_UPDATE.md](./docs/DATA_AND_UPDATE.md) for the exact script list, order, and steps. From project root you can run `python scripts/run_update.py` to run the full pipeline.

Additional references: [Visa statistics](https://www.homeaffairs.gov.au/research-and-statistics/statistics/visa-statistics) (Home Affairs), [PLANNING.md](./PLANNING.md), [DATA_SOURCES.md](./DATA_SOURCES.md).

## Project structure

```
IMMI_DATA/
├── PLANNING.md              # Full project plan
├── README.md                # This file
├── DATA_AVAILABLE.md        # List of all datasets and how to get them
├── DATA_SOURCES.md          # Data sources reference
├── data/
│   └── dashboard/           # indicators.csv, kpi_candidates.json, kpi_candidates_list.md
├── scripts/
│   ├── run_update.py           # Run full pipeline (fetch → melt → build → footnotes → KPIs → sync → draw.io)
│   ├── sync_dashboard_data.py  # Copy data/dashboard/ → dashboard/data/
│   ├── fetch_first_dataset.py  # Download XLSX, export by_sheet
│   ├── melt_all_sheets.py      # XLSX → melted CSV
│   ├── build_dashboard_data.py # Build dashboard JSON/CSV
│   ├── extract_table_footnotes.py
│   ├── list_kpi_candidates.py
│   ├── build_drawio_tree.py    # Optional: docs/indicator_tree.drawio
│   └── ...
├── dashboard/                # Static dashboard (HTML/JS, Chart.js, Leaflet)
│   ├── index.html
│   ├── app.js
│   ├── logo_immi_data.png    # Header logo (same as in README)
│   └── data/                 # tables.json, indicators.csv, kpi_candidates.json, etc.
└── docs/                     # indicator_tree.drawio (edit in draw.io); indicator_tree.drawio.html (view: https://jfilhorv.github.io/IMMI_DATA/docs/indicator_tree.drawio.html)
```

## Goals

- Take advantage of publicly available migration datasets released by the Australian Government (Home Affairs, data.gov.au).
- Transform these datasets into clearer visual insights by regrouping and presenting them through intuitive charts and dashboards.
- Help immigrants, analysts, and the public better understand migration trends by providing additional perspectives and visual interpretations of the data.
- Publish an open and freely accessible dashboard on GitHub Pages for public exploration and transparency.

## Status

- **Planning:** Done (see [PLANNING.md](./PLANNING.md))
- **Data pipeline:** First dataset → [data/by_sheet/](data/by_sheet/), [data/melted/](data/melted/), [data/dashboard/](data/dashboard/). Script `scripts/list_kpi_candidates.py` generates [data/dashboard/kpi_candidates_list.md](data/dashboard/kpi_candidates_list.md) and `kpi_candidates.json` (29 tables, 420 indicator×table pairs with 3+ years for sparklines).
- **Dashboard:** Static dashboard in [dashboard/](dashboard/): Section → Table → (Submenu) → Indicator; **dynamic KPIs** (5 most relevant indicators per selected table, with YoY % and 3-point sparkline); Line/Bar chart; choropleth map and donut by country; news ticker; table notes and footnotes. **[Indicator tree](dashboard/tree.html)** — collapsible visual tree of all 7 sections, 46 tables and 577 indicators; links open the dashboard with that table/indicator selected.
- **GitHub Pages:** Live at [jfilhorv.github.io/IMMI_DATA/dashboard/](https://jfilhorv.github.io/IMMI_DATA/dashboard/).

## Publish to GitHub

The repo is initialized with an initial commit. To push to GitHub:

1. Create a **new repository** on [GitHub](https://github.com/new) (e.g. `IMMI_DATA` or `australian-immigration-dashboard`). Do **not** add a README or .gitignore (you already have them).
2. In this folder, add the remote and push:

   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

   Or with SSH: `git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO.git`

3. To enable **GitHub Pages**: repo **Settings → Pages → Source**: choose your branch (e.g. `main`) and folder (e.g. **/ (root)**). The dashboard will be at `https://YOUR_USERNAME.github.io/YOUR_REPO/dashboard/`.

## Licence and attribution

- Code in this repo: use as you like (e.g. MIT or CC0).
- Government data: follow the licence of each dataset (e.g. CC BY); we will attribute sources on the site.

---
