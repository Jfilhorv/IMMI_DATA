"""
Generate a draw.io (diagrams.net) XML file for the indicator tree:
Root -> 7 Sections -> 46 Tables -> Indicators (577). Opens in draw.io / diagrams.net.
"""
import csv
import json
import xml.etree.ElementTree as ET
from xml.dom import minidom
from pathlib import Path
from collections import defaultdict

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TABLES_JSON = PROJECT_ROOT / "dashboard" / "data" / "tables.json"
INDICATORS_CSV = PROJECT_ROOT / "dashboard" / "data" / "indicators.csv"
OUT_DRAWIO = PROJECT_ROOT / "docs" / "indicator_tree.drawio"

SECTION_LABELS = {
    1: "1. Permanent migration",
    2: "2. Temporary visas",
    3: "3. Humanitarian Program",
    4: "4. Visa cancellations & departures",
    5: "5. Net Overseas Migration",
    6: "6. Citizenship",
    7: "7. Labour market",
}


def escape_xml(text):
    if not text:
        return ""
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def load_indicators_by_table():
    """Return dict table_id -> sorted list of unique indicator names."""
    by_table = defaultdict(set)
    with open(INDICATORS_CSV, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            table = (row.get("table") or "").strip()
            ind = (row.get("indicator") or "").strip()
            if table and ind:
                by_table[table].add(ind)
    return {t: sorted(inds, key=lambda s: s.lower()) for t, inds in by_table.items()}


def main():
    with open(TABLES_JSON, encoding="utf-8") as f:
        tables = json.load(f)
    indicators_by_table = load_indicators_by_table()
    by_section = {}
    for t in tables:
        s = t.get("section")
        if s not in by_section:
            by_section[s] = []
        by_section[s].append(t)
    for s in by_section:
        by_section[s].sort(key=lambda x: (x.get("id") or ""))

    # Layout: vertical flow — one column, root → section → table → indicators, top to bottom
    x_root, x_section, x_table, x_ind = 40, 40, 60, 80
    w_cell = 280
    h_root, h_section, h_table, h_ind = 48, 28, 24, 16
    dy = 4  # gap between rows

    cells = []
    cell_id = [2]
    root_id = 2
    cell_id[0] += 1
    y = 20
    cells.append(
        (
            root_id,
            None,
            "Australian Immigration Data\n7 sections \u00B7 46 tables \u00B7 577 indicators",
            x_root,
            y,
            w_cell,
            h_root,
            "rounded=1;whiteSpace=wrap;html=1;fillColor=#1e40af;strokeColor=#1e3a8a;fontColor=#ffffff;fontStyle=1;fontSize=12;",
        )
    )
    y += h_root + dy * 2

    section_ids = {}
    table_ids = {}
    for sid in [1, 2, 3, 4, 5, 6, 7]:
        if sid not in by_section:
            continue
        tblist = by_section[sid]
        n = len(tblist)
        label = (SECTION_LABELS.get(sid) or f"Section {sid}") + f" ({n} tables)"
        sid_cell = cell_id[0]
        cell_id[0] += 1
        section_ids[sid] = sid_cell
        cells.append(
            (
                sid_cell,
                root_id,
                escape_xml(label),
                x_section,
                y,
                w_cell,
                h_section,
                "rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontStyle=1;",
            )
        )
        y += h_section + dy
        for t in tblist:
            tid_cell = cell_id[0]
            cell_id[0] += 1
            table_ids[(sid, t["id"])] = tid_cell
            short = (t.get("shortTitle") or t.get("title") or t["id"])[:50]
            cells.append(
                (
                    tid_cell,
                    sid_cell,
                    escape_xml(short),
                    x_table,
                    y,
                    w_cell - (x_table - x_root),
                    h_table,
                    "rounded=0;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=10;",
                )
            )
            y += h_table + dy
            inds = indicators_by_table.get(t["id"]) or []
            for ind_name in inds:
                ind_cell = cell_id[0]
                cell_id[0] += 1
                display_name = (ind_name[:45] + "…") if len(ind_name) > 45 else ind_name
                cells.append(
                    (
                        ind_cell,
                        tid_cell,
                        escape_xml(display_name),
                        x_ind,
                        y,
                        w_cell - (x_ind - x_root),
                        h_ind,
                        "rounded=0;whiteSpace=wrap;html=1;fillColor=#e8f5e9;strokeColor=#82b366;fontSize=8;",
                    )
                )
                y += h_ind + dy
        y += dy * 2  # extra space between sections

    # Build XML (draw.io format)
    mxfile = ET.Element(
        "mxfile",
        attrib={
            "host": "app.diagrams.net",
            "modified": "2025-01-01T00:00:00.000Z",
            "agent": "build_drawio_tree.py",
            "version": "22.1.0",
            "etag": "tree",
            "type": "device",
        },
    )
    diagram = ET.SubElement(mxfile, "diagram", attrib={"id": "tree", "name": "Indicator tree"})
    mxgraph = ET.SubElement(
        diagram,
        "mxGraphModel",
        attrib={"dx": "400", "dy": "12000", "grid": "1", "gridSize": "10", "guides": "1", "tooltips": "1", "connect": "1", "arrows": "1", "fold": "1", "page": "1", "pageScale": "1", "pageWidth": "400", "pageHeight": "14000", "math": "0", "shadow": "0"},
    )
    root = ET.SubElement(mxgraph, "root")
    ET.SubElement(root, "mxCell", attrib={"id": "0"})
    ET.SubElement(root, "mxCell", attrib={"id": "1", "parent": "0"})

    for c in cells:
        cid, parent, value, x, y, w, h, style = c
        cell = ET.SubElement(
            root,
            "mxCell",
            attrib={
                "id": str(cid),
                "value": value,
                "style": style,
                "vertex": "1",
                "parent": "1",
            },
        )
        ET.SubElement(
            cell,
            "mxGeometry",
            attrib={"x": str(x), "y": str(y), "width": str(w), "height": str(h), "as": "geometry"},
        )

    # Edges: root -> sections, sections -> tables
    for c in cells:
        cid, parent, value, x, y, w, h, style = c
        if parent is None:
            continue
        eid = cell_id[0]
        cell_id[0] += 1
        edge = ET.SubElement(
            root,
            "mxCell",
            attrib={
                "id": str(eid),
                "value": "",
                "style": "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=blockThin;endFill=1;",
                "edge": "1",
                "parent": "1",
                "source": str(parent),
                "target": str(cid),
            },
        )
        ET.SubElement(edge, "mxGeometry", attrib={"relative": "1", "as": "geometry"})

    # Pretty-print
    rough = ET.tostring(mxfile, encoding="unicode", default_namespace="")
    reparsed = minidom.parseString(rough)
    out_xml = reparsed.toprettyxml(indent="  ", encoding="utf-8").decode("utf-8")
    OUT_DRAWIO.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_DRAWIO, "w", encoding="utf-8") as f:
        f.write(out_xml)
    print(f"Wrote {OUT_DRAWIO}")


if __name__ == "__main__":
    main()
