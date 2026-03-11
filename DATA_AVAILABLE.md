# Australian Immigration Data — Full List & How to Get It

All sources are **Australian Government** (data.gov.au, Department of Home Affairs). Prefer **CSV** or **XLSX** for automation.

---

## 1. data.gov.au datasets (by organisation: Department of Home Affairs / immi)

| # | Dataset name | Description | Format | How to get it |
|---|--------------|-------------|--------|----------------|
| **1** | **Australian Migration Statistics** | Annual migration stats (permanent & temporary). "Australia's Migration Trends" statistical package. | XLSX | **Direct download (latest):** `https://data.gov.au/data/dataset/dba45e7c-81f4-44aa-9d82-1b9a0a121017/resource/242e6794-9b6a-4d34-a67f-d940e96e6a37/download/migration_trends_statistical_package_2024_25.xlsx` — Or browse: https://data.gov.au/data/dataset/australian-migration-statistics → pick year → Download. **Dataset ID:** `dba45e7c-81f4-44aa-9d82-1b9a0a121017` |
| 2 | Permanent Migration Program (Skilled & Family) Outcomes | Annual outcomes for Skilled and Family streams. | XLSX | Browse: https://data.gov.au/data/dataset/permanent-migration-program-skilled-family → Download. |
| 3 | Visitor visas granted (pivot) | Visitor visas by financial year, quarter, month, citizenship country, visa subclass. | XLSX, CSV | Browse: https://data.gov.au/data/dataset/visitor-visas-granted-pivot-table → Download. |
| 4 | Student visa program | Lodged and granted for subclasses 500, 570–576. | XLSX, CSV | data.gov.au → search "student visa" or organisation "immi" → Download. |
| 5 | Working Holiday Maker visa program | Grants for subclasses 417 and related. | XLSX, CSV | data.gov.au → organisation "immi" → Download. |
| 6 | Temporary Graduate visa program | Subclass 485 lodged and granted. | XLSX, CSV | data.gov.au → organisation "immi" → Download. |
| 7 | Temporary Work (Skilled) visa program | Skilled temporary visa statistics. | XLSX, CSV | data.gov.au → organisation "immi" → Download. |
| 8 | Temporary visa holders in Australia | Quarterly snapshots of temporary entrants and NZ citizens. | XLSX, CSV | data.gov.au → organisation "immi" → Download. |
| 9 | Overseas Arrivals and Departures | Arrival and departure statistics. | XLSX, CSV | data.gov.au → search "overseas arrivals departures" or organisation "immi" → Download. |
| 10 | Settlement reports | People granted permanent or provisional visas (Settlement Database). | XLSX, CSV | data.gov.au → organisation "immi" → Download. |
| 11 | Historical migration statistics | From 1945 onwards. | XLSX | data.gov.au → search "historical migration statistics" → Download. |

---

## 2. API access (data.gov.au — CKAN)

- **Base URL:** `https://data.gov.au/data/api/3/action/`
- **List packages (paginated):** `package_search?q=immigration&rows=20&start=0` (GET or POST).
- **Show one package (resources = download links):** `package_show?id=dba45e7c-81f4-44aa-9d82-1b9a0a121017`  
  → In the JSON, use `result.resources[].url` for the download URL (or build from `result.resources[].id` and filename).
- **User-Agent:** Some servers expect a browser-like User-Agent; use e.g. `Mozilla/5.0 (compatible; DataBot/1.0)`.

---

## 3. Home Affairs (web only — no direct CSV/Excel API)

| Page | What it shows | How to get data |
|------|----------------|------------------|
| Visa statistics hub | Links to all visa stats | https://www.homeaffairs.gov.au/research-and-statistics/statistics/visa-statistics |
| Migration program (live) | Migration program outcomes | https://www.homeaffairs.gov.au/research-and-statistics/statistics/visa-statistics/live/migration-program |
| Visitor visa statistics | Visitor reports (PDF/HTML) | https://www.homeaffairs.gov.au/research-and-statistics/statistics/visa-statistics/visit |

For **CSV/Excel**, prefer the data.gov.au datasets above; Home Affairs often links to the same or similar data on data.gov.au.

---

## 4. Direct download URLs (first dataset — Australian Migration Statistics)

Use these in scripts to avoid browsing. Replace with newer resource IDs from `package_show` when new years are published.

| Year | Download URL |
|------|--------------|
| 2024-25 | `https://data.gov.au/data/dataset/dba45e7c-81f4-44aa-9d82-1b9a0a121017/resource/242e6794-9b6a-4d34-a67f-d940e96e6a37/download/migration_trends_statistical_package_2024_25.xlsx` |
| 2023-24 | `https://data.gov.au/data/dataset/dba45e7c-81f4-44aa-9d82-1b9a0a121017/resource/2a5f6c20-6924-48fe-a83b-c240b46f0ffa/download/migration_trends_statistical_package_2023_24.xlsx` |

---

## 5. Licence & attribution

- data.gov.au: check each dataset (often **CC BY**).
- Cite: "Australian Government, data.gov.au" or "Department of Home Affairs".
- Contact: statistical.coordination@homeaffairs.gov.au (for data questions).

---

*Update this list when new datasets or resources are added.*
