# Data sources — Australian immigration (reference)

Quick reference for official datasets. Use this when implementing the pipeline.

## data.gov.au (CKAN API)

- **Base API:** `https://data.gov.au/data/api/3/action/`
- **Package list:** `package_list`
- **Package show:** `package_show?id=<dataset_id>`
- **Resource download:** use `url` from resource in package.

## Key datasets (to use in pipeline)

| Dataset | Description | Typical format |
|--------|-------------|----------------|
| Australian Migration Statistics | Annual migration stats (permanent & temporary) | XLSX |
| Permanent Migration Program (Skilled & Family) | Outcomes by year/category | XLSX |
| Visitor visas granted | By country, period, subclass | XLSX, CSV |
| Overseas arrivals and departures | Movement statistics | XLSX |
| Historical migration statistics | From 1945 | XLSX |

**Dataset IDs / URLs:** Resolve via data.gov.au search or organisation page:  
[https://data.gov.au/data/dataset](https://data.gov.au/data/dataset) (search: migration, visa, immigration)  
Organisation: **Department of Home Affairs** / **immi**

## Home Affairs (live statistics)

- **Visa statistics:** https://www.homeaffairs.gov.au/research-and-statistics/statistics/visa-statistics
- **Migration program (live):** https://www.homeaffairs.gov.au/research-and-statistics/statistics/visa-statistics/live/migration-program
- Data may be embedded in HTML or PDF; prefer structured data from data.gov.au when available.

## Licence and attribution

- data.gov.au datasets: check each resource (often **CC BY**).
- Always link back to the source and cite "Australian Government, data.gov.au" or "Department of Home Affairs".

---

*Update this file as you add or change data sources.*
