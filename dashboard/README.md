# Australian Immigration — Web Dashboard

Static dashboard: **one chart + indicator dropdown**. Select an indicator and the chart shows year vs value and rescales automatically.

## Run locally

1. Copy the latest data into this folder (so the page can load it):
   ```bash
   # From project root (PowerShell)
   New-Item -ItemType Directory -Force -Path dashboard\data
   Copy-Item data\dashboard\indicators.csv -Destination dashboard\data\indicators.csv
   ```
2. Open `index.html` in a browser, or serve the folder:
   ```bash
   cd dashboard
   npx serve .
   ```
   Then open http://localhost:3000 (or the URL shown).

If you open `index.html` directly (file://), the CSV must be under `dashboard/data/indicators.csv`; some browsers block file:// fetch, so prefer a local server.

## GitHub Pages

1. In repo **Settings → Pages**, set source to the branch that contains `dashboard/` (e.g. main) and folder to **/ (root)** or a folder that contains `dashboard/`.
2. Ensure `dashboard/data/indicators.csv` is committed (or use a build step to copy it).
3. The site will be at `https://<user>.github.io/<repo>/dashboard/`.

## Files

- `index.html` — Page and dropdown.
- `app.js` — Loads `data/indicators.csv`, fills dropdown, filters by selected indicator, draws Chart.js bar chart (auto rescale).
- `data/indicators.csv` — Copy of `data/dashboard/indicators.csv` (indicator, year, value, table).

Data: [Australian Migration Statistics](https://data.gov.au/data/dataset/australian-migration-statistics), Department of Home Affairs.
