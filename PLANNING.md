# Australian Immigration Data Dashboard — Project Plan

## 1. Project overview

**Goal:** Build a free, public dashboard and webpage showing Australian immigration statistics (when, from where, to Australia) across years, using official government data, and host it on GitHub Pages.

**Scope:**
- Data from **Australian Government** sources: Department of Home Affairs, data.gov.au, and related official statistics.
- Dimensions: **when** (year, quarter, month), **from** (country of citizenship/origin), **to** (Australia), **across years**.
- Deliverables: **data pipeline**, **dashboard**, and **public GitHub Pages site**.

---

## 2. Data sources (official)

| Source | What it provides | Format / access |
|--------|------------------|------------------|
| **data.gov.au** | Australian Migration Statistics (annual), visa programs, arrivals/departures | XLSX, CSV; CKAN API |
| **Department of Home Affairs** | Visa statistics (live), migration program, humanitarian, visitor, skilled, student | Web reports, linked datasets on data.gov.au |
| **data.gov.au – Organisation: immi** | Multiple datasets (temporary visas, student, skilled, visitor, OAD, settlement) | XLSX, CSV, API |

**Relevant datasets (to validate and use):**
- Australian Migration Statistics (yearly packs, e.g. 2020–21 to 2024–25)
- Permanent Migration Program (Skilled & Family) outcomes
- Visitor visa program (by country, period)
- Overseas arrivals and departures
- Temporary visa holders, Student visa, Temporary Graduate, Temporary Work (Skilled)
- Historical migration statistics (from 1945)

**Licence:** CC BY where applicable; we will attribute and link sources.

---

## 3. Data dimensions (for the dashboard)

| Dimension | Description | Example |
|-----------|-------------|--------|
| **When** | Time period | Year, financial year, quarter, month |
| **From** | Origin / citizenship | Country of citizenship or residence |
| **To** | Destination | Australia (fixed) |
| **Visa / stream** | Category of migration | Skilled, Family, Humanitarian, Student, Visitor, etc. |
| **Across years** | Time series | Compare same metric over multiple years |

---

## 4. Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Data sources   │     │  Data pipeline    │     │  Dashboard &     │
│  (Gov AU,      │────▶│  (fetch, clean,   │────▶│  GitHub Pages    │
│   data.gov.au)  │     │   normalize,      │     │  (static site)   │
└─────────────────┘     │   export JSON/   │     └─────────────────┘
                        │   CSV)           │
                        └──────────────────┘
```

- **Data pipeline:** Scripts (e.g. Python or Node) to:
  - Call data.gov.au CKAN API and/or download known dataset URLs.
  - Parse XLSX/CSV, normalize “when / from / to / visa” into a common schema.
  - Output clean JSON/CSV for the front end.
- **Dashboard:** Web app (e.g. HTML/JS + lightweight charts, or React/Vue) that reads the exported data and renders:
  - Time series (across years),
  - Breakdowns by country (from),
  - Breakdowns by visa/stream.
- **GitHub Pages:** Static site from the repo (e.g. `docs/` or `gh-pages` branch) so the page is free and public.

---

## 5. Phases and tasks

### Phase 1 — Setup and discovery
- [ ] Create repo structure (e.g. `data/`, `scripts/`, `dashboard/`, `docs/` for GitHub Pages).
- [ ] Document exact dataset URLs and API endpoints from data.gov.au and Home Affairs.
- [ ] List which datasets give “when”, “from”, “to” and visa type; note any gaps.

### Phase 2 — Data pipeline
- [ ] Implement fetchers (API + direct download for XLSX/CSV).
- [ ] Normalize to a common schema (e.g. `year`, `period`, `country_origin`, `visa_category`, `count`).
- [ ] Save outputs under `data/` (e.g. `migration_by_year_country.json`, `visa_series.csv`).
- [ ] Add a simple README in `data/` describing each file and source.

### Phase 3 — Dashboard
- [ ] Build a single-page (or multi-tab) dashboard:
  - Time series of key metrics across years.
  - Filters: year range, country (from), visa/stream.
  - Charts: e.g. line (years), bar (countries), stacked bar (visa types).
- [ ] Use only static assets so it works on GitHub Pages (no backend).

### Phase 4 — GitHub Pages and docs
- [ ] Configure GitHub Pages (publish from `main`/`docs/` or `gh-pages`).
- [ ] Add README with: purpose, data sources, how to run pipeline and view dashboard locally.
- [ ] Add a short “Data and methodology” section (sources, dimensions, update frequency).

### Phase 5 — Maintenance (optional)
- [ ] Document how to re-run the pipeline when new data is published.
- [ ] Optional: GitHub Action to periodically re-fetch and rebuild.

---

## 6. Tech stack (suggested)

| Layer | Option | Notes |
|-------|--------|------|
| Data fetch/parse | Python (pandas, openpyxl, requests) or Node (axios, xlsx) | Depends on team preference |
| Output | JSON + CSV | Easy for static front end |
| Dashboard | HTML/CSS/JS + Chart.js or D3.js | No build required; works on Pages |
| Hosting | GitHub Pages | Free, public, from repo |

---

## 7. Success criteria

- Data is traceable to official sources (Gov AU, Home Affairs, data.gov.au).
- Dashboard clearly shows “when”, “from”, “to” and “across years”.
- Site is public and free on GitHub.
- README explains how to reproduce and update.

---

## 8. Next steps

1. Create the repo folders and a minimal README.
2. Implement Phase 1: document exact dataset IDs and URLs.
3. Implement Phase 2: first script that downloads one dataset and outputs one normalized JSON/CSV.
4. Then proceed to dashboard and GitHub Pages.

---

*Document version: 1.0 — Planning only. All project text in English.*
