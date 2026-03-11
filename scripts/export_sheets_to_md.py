"""
Export each sheet from the Australian Migration Statistics XLSX to a separate
Markdown document. Uses the first table title found in each sheet (e.g. cell with
"Table 1.0: ...") or the sheet name as the document title. Content is preserved
exactly (no change a single bit). Uses pandas to read Excel.
"""
import re
from pathlib import Path

import pandas as pd

# Paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_XLSX = PROJECT_ROOT / "data" / "raw" / "migration_trends_statistical_package_2024_25.xlsx"
DOCS_DIR = PROJECT_ROOT / "docs"
DOCS_TABLES_DIR = DOCS_DIR / "tables"


def find_sheet_title(df: pd.DataFrame, sheet_name: str) -> str:
    """
    Find the document title for this sheet. Prefer the cell that contains
    "Table X.X: ..." (the official table caption). For Overview / Data Items
    use the standard title. Otherwise use first non-empty cell or sheet name.
    """
    # Search first 5 rows for "Table " (the official table caption in data sheets)
    for r in range(min(5, len(df))):
        for c in range(len(df.columns)):
            val = df.iloc[r, c]
            if pd.isna(val):
                continue
            s = str(val).strip().replace('"', "").replace("\n", " ")
            if s.startswith("Table ") and ":" in s:
                return s
            if sheet_name == "Overview" and "Australian Migration Statistics" in s and "Overview" not in s:
                return s.strip() or "Australian Migration Statistics, 2024–25"
            if sheet_name == "Data Items and Terminology" and "Data Items and Terminology" in s:
                return "Data Items and Terminology"

    if sheet_name == "Overview":
        return "Australian Migration Statistics, 2024–25 — Overview"
    if sheet_name == "Data Items and Terminology":
        return "Data Items and Terminology"

    # Fallback: first non-empty cell in row 0 or 1
    for r in range(min(2, len(df))):
        for c in range(len(df.columns)):
            val = df.iloc[r, c]
            if pd.isna(val) or str(val).strip() == "":
                continue
            return str(val).strip().replace('"', "")

    return sheet_name


def safe_filename(sheet_name: str) -> str:
    """Map sheet name to a safe filename (no extension)."""
    # Keep 1.0, 1.1, ... as-is; replace spaces/special for others
    if re.match(r"^\d+\.\d+$", sheet_name):
        return sheet_name
    return sheet_name.replace(" ", "_").replace("/", "_").replace("&", "and")


def df_to_markdown_table(df: pd.DataFrame) -> str:
    """Convert dataframe to markdown table with exact cell values (no change)."""
    # Use string representation of each value so we don't change a single bit
    df_str = df.astype(object).fillna("")
    df_str = df_str.astype(str)
    # Escape pipe in cells so table renders correctly
    def escape(s):
        return s.replace("|", "\\|").replace("\n", " ")

    for c in df_str.columns:
        df_str[c] = df_str[c].apply(escape)

    try:
        return df_str.to_markdown(index=False)  # requires tabulate
    except Exception:
        # Fallback: simple markdown table
        lines = []
        for i, row in df_str.iterrows():
            lines.append("| " + " | ".join(row) + " |")
        if lines:
            sep = "| " + " | ".join(["---"] * len(df_str.columns)) + " |"
            return "\n".join([sep, lines[0], sep] + lines[1:])
        return ""


def main() -> None:
    if not RAW_XLSX.exists():
        raise FileNotFoundError(f"Run fetch_first_dataset.py first. Missing: {RAW_XLSX}")

    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    DOCS_TABLES_DIR.mkdir(parents=True, exist_ok=True)

    xl = pd.ExcelFile(RAW_XLSX)
    index_entries = []

    for sheet_name in xl.sheet_names:
        df = pd.read_excel(xl, sheet_name=sheet_name, header=None)
        title = find_sheet_title(df, sheet_name)
        fname = safe_filename(sheet_name)
        md_path = DOCS_TABLES_DIR / f"{fname}.md"

        md_body = f"# {title}\n\n"
        md_body += "Source: Australian Migration Statistics 2024–25, Department of Home Affairs (data.gov.au).\n\n"
        md_body += df_to_markdown_table(df)

        md_path.write_text(md_body, encoding="utf-8")
        print(f"  {sheet_name} -> docs/tables/{fname}.md  (title: {title[:60]}...)")

        index_entries.append((sheet_name, title, f"{fname}.md"))

    # Index document: list all tables with their official name (from A1/title)
    index_path = DOCS_DIR / "INDEX.md"
    index_lines = [
        "# Australian Migration Statistics 2024–25 — Document index",
        "",
        "Each table is exported from the official XLSX. The heading of each document is the **table title** from the spreadsheet (e.g. the text in the first row, such as \"Table 1.0: Australia's Migration Program outcome, 1984–85 to 2024–25\").",
        "",
        "| Sheet | Table / document title | File |",
        "|-------|------------------------|------|",
    ]
    for sheet_name, title, file_name in index_entries:
        # Escape pipe in title for markdown table
        title_esc = title.replace("|", "\\|")
        index_lines.append(f"| {sheet_name} | {title_esc} | [tables/{file_name}](tables/{file_name}) |")

    index_lines.extend([
        "",
        "---",
        "",
        "- **Sheet 1** = Overview",
        "- **Sheet 2** = Data Items and Terminology",
        "- **Sheets 1.0–1.18, 2.x, 3.x, …** = Data tables (each number is a table; name from first row).",
        "",
        "Source: [data.gov.au – Australian Migration Statistics](https://data.gov.au/data/dataset/australian-migration-statistics).",
    ])
    index_path.write_text("\n".join(index_lines), encoding="utf-8")
    print(f"\nIndex written to {index_path}")


if __name__ == "__main__":
    main()
