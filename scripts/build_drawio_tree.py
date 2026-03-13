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
OUT_HTML = PROJECT_ROOT / "docs" / "indicator_tree.drawio.html"

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

    # Layout: "armoire on its side" — left to right: Root | 7 sections | 46 tables | 577 indicators
    # Each level is a column; items stack vertically within column. Root/sections/tables centered on their children.
    x_root, x_section, x_table, x_ind = 20, 140, 280, 430
    w_root, w_section, w_table, w_ind = 100, 120, 130, 160
    h_root, h_section, h_table, h_ind = 44, 24, 20, 14
    gap = 2

    # 1) Build flat list of all indicators in order (section → table → indicator); assign y to each
    ind_y_list = []  # (table_id, section_id, indicator_name, y_position)
    y_run = 0
    for sid in [1, 2, 3, 4, 5, 6, 7]:
        if sid not in by_section:
            continue
        for t in by_section[sid]:
            inds = indicators_by_table.get(t["id"]) or []
            for ind_name in inds:
                ind_y_list.append((t["id"], sid, ind_name, y_run))
                y_run += h_ind + gap

    # 2) For each table, get y_min, y_max from its indicators; table y = center
    table_yrange = {}  # table_id -> (y_min, y_max)
    for t in tables:
        tid = t.get("id")
        tbl_ys = [item[3] for item in ind_y_list if item[0] == tid]
        if tbl_ys:
            table_yrange[tid] = (min(tbl_ys), max(tbl_ys))
        else:
            table_yrange[tid] = (0, 0)

    # 3) For each section, get y_min, y_max from its tables; section y = center
    section_yrange = {}
    for sid in [1, 2, 3, 4, 5, 6, 7]:
        if sid not in by_section:
            continue
        tblist = by_section[sid]
        all_ys = []
        for t in tblist:
            ymn, ymx = table_yrange.get(t["id"], (0, 0))
            all_ys.extend([ymn, ymx])
        if all_ys:
            section_yrange[sid] = (min(all_ys), max(all_ys))
        else:
            section_yrange[sid] = (0, 0)

    # 4) Root y = center of all sections (clamp to 0)
    sec_ys = [section_yrange[s][0] for s in section_yrange] + [section_yrange[s][1] for s in section_yrange]
    root_y = max(0, (min(sec_ys) + max(sec_ys) - h_root) // 2) if sec_ys else 0

    cells = []
    cell_id = [2]
    root_id = 2
    cell_id[0] += 1
    cells.append(
        (
            root_id,
            None,
            "7 \u00B7 46 \u00B7 577",
            x_root,
            root_y,
            w_root,
            h_root,
            "rounded=1;whiteSpace=wrap;html=1;fillColor=#1e40af;strokeColor=#1e3a8a;fontColor=#ffffff;fontStyle=1;fontSize=11;",
        )
    )

    section_ids = {}
    table_ids = {}
    # Sections column
    for sid in [1, 2, 3, 4, 5, 6, 7]:
        if sid not in by_section:
            continue
        ymn, ymx = section_yrange.get(sid, (0, 0))
        sy = max(0, (ymn + ymx - h_section) // 2)
        n = len(by_section[sid])
        label = (SECTION_LABELS.get(sid) or f"Section {sid}") + f" ({n})"
        sid_cell = cell_id[0]
        cell_id[0] += 1
        section_ids[sid] = sid_cell
        cells.append(
            (
                sid_cell,
                root_id,
                escape_xml(label),
                x_section,
                sy,
                w_section,
                h_section,
                "rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontStyle=1;fontSize=9;",
            )
        )
    # Tables column
    for sid in [1, 2, 3, 4, 5, 6, 7]:
        if sid not in by_section:
            continue
        for t in by_section[sid]:
            tid = t["id"]
            tid_cell = cell_id[0]
            cell_id[0] += 1
            table_ids[(sid, tid)] = tid_cell
            ymn, ymx = table_yrange.get(tid, (0, 0))
            ty = max(0, (ymn + ymx - h_table) // 2)
            short = (t.get("shortTitle") or t.get("title") or tid)[:36]
            cells.append(
                (
                    tid_cell,
                    section_ids[sid],
                    escape_xml(short),
                    x_table,
                    ty,
                    w_table,
                    h_table,
                    "rounded=0;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=8;",
                )
            )
    # Indicators column (from precomputed list)
    for table_id, section_id, ind_name, iy in ind_y_list:
        ind_cell = cell_id[0]
        cell_id[0] += 1
        display_name = (ind_name[:40] + "…") if len(ind_name) > 40 else ind_name
        tid_cell = table_ids.get((section_id, table_id))
        if tid_cell is None:
            continue
        cells.append(
            (
                ind_cell,
                tid_cell,
                escape_xml(display_name),
                x_ind,
                iy,
                w_ind,
                h_ind,
                "rounded=0;whiteSpace=wrap;html=1;fillColor=#e8f5e9;strokeColor=#82b366;fontSize=7;",
            )
        )

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
        attrib={"dx": "600", "dy": "9500", "grid": "1", "gridSize": "10", "guides": "1", "tooltips": "1", "connect": "1", "arrows": "1", "fold": "1", "page": "1", "pageScale": "1", "pageWidth": "620", "pageHeight": "9500", "math": "0", "shadow": "0"},
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

    # Generate HTML viewer (embed same XML so diagram can be viewed in browser)
    viewer_data = {
        "highlight": "#0000ff",
        "nav": True,
        "resize": True,
        "toolbar": "zoom layers lightbox",
        "xml": out_xml,
    }
    json_str = json.dumps(viewer_data, ensure_ascii=False)
    html_attr = json_str.replace("&", "&amp;").replace('"', "&quot;")
    html_content = (
        '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8"/>\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1"/>\n'
        '<title>Indicator tree — Australian Immigration Data</title>\n</head>\n<body>\n'
        '<p style="margin:0.5rem 1rem;font-family:sans-serif;font-size:0.9rem;">'
        '<a href="../dashboard/index.html">← Dashboard</a> · '
        '<a href="../dashboard/tree.html">Indicator tree (list)</a></p>\n'
        '<div class="mxgraph" style="max-width:100%;border:1px solid transparent;" '
        'data-mxgraph="' + html_attr + '"></div>\n'
        '<script src="https://viewer.diagrams.net/js/viewer-static.min.js"></script>\n'
        '</body>\n</html>'
    )
    with open(OUT_HTML, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"Wrote {OUT_HTML}")


if __name__ == "__main__":
    main()
