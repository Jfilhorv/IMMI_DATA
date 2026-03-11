# Australian Immigration Data Dashboard

A **free, public** dashboard and webpage showing Australian immigration statistics from official government sources: **when** (year/quarter/month), **from** (country), **to** (Australia), **across years**.

## Data sources

- **[data.gov.au](https://data.gov.au)** — Australian Migration Statistics, visa programs, overseas arrivals and departures
- **Department of Home Affairs** — Visa statistics, migration program, humanitarian and temporary visa data
- All data is attributed; sources are linked in the dashboard and in [PLANNING.md](./PLANNING.md)

## Project structure

```
IMMI_DATA/
├── PLANNING.md          # Full project plan
├── README.md            # This file
├── DATA_AVAILABLE.md    # List of all datasets and how to get them
├── DATA_SOURCES.md      # Data sources reference
├── data/                # raw/; by_sheet/; melted/; dashboard/ (indicator,year,value); INDEX.csv
├── scripts/             # fetch_first_dataset.py, build_index_csv.py (pandas)
├── dashboard/           # Static dashboard (HTML/JS + charts)
└── docs/                # Optional .md exports; primary format is CSV in data/
```

## Goals

1. **Get** relevant data from Australian Gov (Home Affairs, data.gov.au).
2. **Show** dimensions: when, from, to, across years (and visa/stream where available).
3. **Publish** a dashboard and webpage on **GitHub Pages** for free public use.

## Status

- **Planning:** Done (see [PLANNING.md](./PLANNING.md))
- **Data pipeline:** First dataset → [data/by_sheet/](data/by_sheet/), [data/melted/](data/melted/), and [data/dashboard/](data/dashboard/) (**indicator, year, value** for dropdown + chart; see [docs/DASHBOARD_METABASE_SUPERSET.md](docs/DASHBOARD_METABASE_SUPERSET.md)).
- **Documentation:** Overview + Data Items and Terminology. **Data:** 1.0–1.7. Index: [data/INDEX.csv](data/INDEX.csv).
- **Dashboard:** Static dashboard in [dashboard/](dashboard/) (dropdown + Chart.js; copy `data/dashboard/indicators.csv` to `dashboard/data/` and open `dashboard/index.html` or serve the folder).
- **GitHub Pages:** Not configured (use repo root or `docs/` and link to `dashboard/`).

## Licence and attribution

- Code in this repo: use as you like (e.g. MIT or CC0).
- Government data: follow the licence of each dataset (e.g. CC BY); we will attribute sources on the site.

---

*Project in English. Next: implement data discovery and pipeline (Phase 1–2).*
