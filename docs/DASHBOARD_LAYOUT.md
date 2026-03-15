# Dashboard page layout (index.html)

## Page grid (`.page`)

- **Columns:** `240px` (sidebar) | `1fr` (content)
- **Rows:** `5.75rem` (header) then `auto` × 5
- **Flow:** default row; some children set `grid-column` / `grid-row` explicitly.

## Direct children of `.page` (in order)

| # | Element              | grid-column   | grid-row | Resulting cell  |
|---|----------------------|---------------|----------|------------------|
| 1 | `header`             | 1 / -1        | (auto)   | Row 1, full width |
| 2 | `section.news-block`| 1 / -1        | (auto)   | Row 2, full width |
| 3 | `div.kpi-row`        | 1 / -1        | (auto)   | Row 3, full width |
| 4 | `aside.sidebar`      | (none → 1)    | (auto)   | Row 4, **col 1** (DATA / Data Items) |
| 5 | `main.main`          | (none → 2)    | (auto)   | Row 4, **col 2** (chart + map) |
| 6 | `div.dataset-block-wrap` | **1** | **5** | Row 5, col 1 (Dataset; below DATA) |
| 7 | `div.footer-three-blocks` | **2** | **5** | Row 5, col 2 (Notes + Overview) |
| 8 | `div.source-row`     | 1 / -1        | (auto)   | Row 6, full width |

## Important detail

- **Row 5, col 1** is never assigned: no element has `grid-column: 1` and row 5. So that cell is the empty “green” area (below DATA, left of Notes).
- **Row 5, col 2** is the whole footer: `footer-three-blocks` with internal columns `[Dataset | Notes | Overview]`. So Dataset is still inside the content column (2), not in the sidebar column (1).

## Desired layout for “Dataset in the green space”

- **Row 5, col 1:** one block (e.g. `.block-meta-wrap` or `.dataset-block`) containing the Dataset content, with `grid-column: 1; grid-row: 5`.
- **Row 5, col 2:** `footer-three-blocks` with only **Notes | Overview** (2 columns: 1.38fr 0.62fr), with `grid-column: 2; grid-row: 5`.

So Dataset must be a **sibling** of the footer in the page grid, not a child of the footer, and must be explicitly placed in (5, 1).

## Main content grid (`.main`)

- **Columns:** `1.38fr` (chart) | `0.62fr` (map)
- **Rows:** 480px (one row)
- Chart and map sit side by side; footer below them aligns Notes with chart (1.38fr) and Overview with map (0.62fr) when footer has only those two columns.

## Responsive

- **≤1024px:** `.page` → `grid-template-columns: 1fr`; footer → `grid-column: 1 / -1`. Single column; “green” cell disappears.
- **≤1100px:** `.footer-three-blocks` → one column; blocks stack.
