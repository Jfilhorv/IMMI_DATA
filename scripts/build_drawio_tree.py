"""
Generate a draw.io (diagrams.net) XML file for the indicator tree:
Root -> 7 Sections -> 46 Tables. Opens in draw.io / diagrams.net.
"""
import json
import xml.etree.ElementTree as ET
from xml.dom import minidom
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TABLES_JSON = PROJECT_ROOT / "dashboard" / "data" / "tables.json"
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


def main():
    with open(TABLES_JSON, encoding="utf-8") as f:
        tables = json.load(f)
    by_section = {}
    for t in tables:
        s = t.get("section")
        if s not in by_section:
            by_section[s] = []
        by_section[s].append(t)
    for s in by_section:
        by_section[s].sort(key=lambda x: (x.get("id") or ""))

    # Layout: root top, then 7 sections in a row, then tables under each section (vertical stack)
    cell_w, cell_h = 200, 32
    table_w, table_h = 220, 26
    dx_section = 240
    dy_section = 60
    dy_table = 30
    root_x, root_y = 380, 30
    section_y = 100
    table_start_y = 150

    cells = []
    cell_id = [2]
    root_id = 2
    cell_id[0] += 1
    cells.append(
        (
            root_id,
            None,
            "Australian Immigration Data\n7 sections \u00B7 46 tables \u00B7 577 combinations",
            root_x,
            root_y,
            320,
            52,
            "rounded=1;whiteSpace=wrap;html=1;fillColor=#1e40af;strokeColor=#1e3a8a;fontColor=#ffffff;fontStyle=1;fontSize=12;",
        )
    )

    section_ids = {}
    table_ids = {}
    x_section = 40
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
                section_y,
                cell_w,
                cell_h,
                "rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontStyle=1;",
            )
        )
        ty = table_start_y
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
                    x_section + 20,
                    ty,
                    table_w,
                    table_h,
                    "rounded=0;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=10;",
                )
            )
            ty += dy_table
        x_section += dx_section

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
        attrib={"dx": "1200", "dy": "800", "grid": "1", "gridSize": "10", "guides": "1", "tooltips": "1", "connect": "1", "arrows": "1", "fold": "1", "page": "1", "pageScale": "1", "pageWidth": "1600", "pageHeight": "900", "math": "0", "shadow": "0"},
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
