# Dashboard with Metabase or Apache Superset

Use the **indicator, year, value** dataset so one chart can switch between many indicators and auto-rescale.

## Data layout

- **indicators.csv**: `indicator`, `year`, `value`, `table`
- **indicator_metadata.csv**: `indicator_id`, `indicator_name`, `category` (optional, for dropdown labels)

Different indicators can have different years (e.g. Indicator A: 1984–1990, Indicator B: 1995–2000). When you switch indicator, the chart redraws with the available years — normal for time-series dashboards.

---

## Metabase

1. **Add data**: Connect a database or upload **indicators.csv** (e.g. SQLite or your DB with this table).
2. **Create a question**:
   - SQL example (if you have a table `indicators`):
   ```sql
   SELECT indicator, year, value
   FROM indicators
   WHERE indicator = {{ indicator }}
   ORDER BY year
   ```
   - Or use the GUI: filter by `indicator`, dimensions `year`, metric `value`.
3. **Dashboard**: Add a **dropdown filter** (field: `indicator`, source: list or from `indicator_metadata`) and a **line or bar chart** (x: year, y: value).
4. **Auto rescale**: Metabase rescales axes from the result set, so switching the indicator updates the chart and scale.

**Single chart, many indicators**: One line/bar chart + one filter on `indicator`. No need for 35 separate charts.

---

## Apache Superset

1. **Add dataset**: Upload CSV or connect to a database with the indicators table (`indicator`, `year`, `value`, optionally `table`).
2. **Create chart**:
   - Chart type: Line, Bar, or Time-series.
   - X-axis: `year` (as dimension).
   - Metrics: `value` (e.g. SUM or AVG; for one row per year, SUM = value).
   - Filter: `indicator` = (parameter or dropdown).
3. **Dashboard**: Add a **filter** (Filter box or dropdown) for `indicator`. Link it to the chart. When the user picks an indicator, the chart filters and rescales.
4. **Optional**: Use `indicator_metadata` to build a dropdown with `indicator_name` and group by `category` (table).

**Rescale**: Superset’s time-series charts use the filtered data for the axis range, so switching indicator gives a clean chart without broken scales.

---

## Build one chart that switches 35 indicators

1. **One dataset**: One table with columns `indicator`, `year`, `value` (and optionally `table`).
2. **One chart**: Line or bar, x = year, y = value.
3. **One filter**: Dropdown or list of distinct `indicator` (or join `indicator_metadata` for nicer names).
4. **Logic**: `WHERE indicator = [selected]` (or filter in the tool). Chart updates and rescales automatically.

This avoids 35 separate charts and keeps the dashboard simple and scalable.

---

## Files in this project

| Path | Use in Metabase/Superset |
|-----|---------------------------|
| `data/dashboard/indicators.csv` | Main table: load into DB or upload. Filter by `indicator` and `table`. |
| `data/dashboard/indicator_metadata.csv` | Optional: dropdown labels, categories. |
| `data/dashboard/1_0.csv`, `1_1.csv`, … | Per-table datasets if you want one dashboard per table. |

Source: Australian Migration Statistics (Department of Home Affairs, data.gov.au).
