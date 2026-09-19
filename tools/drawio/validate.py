"""Structural and geometric validation for generated draw.io documents.

Catches the class of defect that is invisible in XML but fatal on screen:
overlapping elements, dangling edge endpoints, and labels too large for their box.
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET

CHAR_W, LINE_H = 6.4, 15


def _cells(tree: ET.ElementTree) -> list[tuple[str, ET.Element, ET.Element]]:
    out = []
    for diagram in tree.getroot().findall("diagram"):
        page = diagram.get("name", "?")
        for cell in diagram.iter("mxCell"):
            geom = cell.find("mxGeometry")
            if geom is not None:
                out.append((page, cell, geom))
    return out


def _box(geom: ET.Element) -> tuple[float, float, float, float] | None:
    try:
        return (
            float(geom.get("x")),
            float(geom.get("y")),
            float(geom.get("width")),
            float(geom.get("height")),
        )
    except (TypeError, ValueError):
        return None


def _overlap(a: tuple, b: tuple) -> bool:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return ax < bx + bw and bx < ax + aw and ay < by + bh and by < ay + ah


def _plain_text(value: str) -> str:
    return re.sub(r"<[^>]+>", " ", value or "").replace("&nbsp;", " ").strip()


def _needed_height(value: str, width: float) -> float:
    """Estimate rendered height, honouring explicit <br/> breaks and wrapping."""
    segments = re.split(r"<br\s*/?>", value or "")
    lines = 0
    for seg in segments:
        text = _plain_text(seg)
        chars_per_line = max(1, int((width - 16) / CHAR_W))
        lines += max(1, -(-len(text) // chars_per_line))
    return lines * LINE_H


def _is_boundary(style: str) -> bool:
    return "fillColor=none" in style or "strokeColor=#c0392b" in style


def _scan(tree: ET.ElementTree, problems: list[str]) -> tuple[dict, dict, list]:
    """Walk every cell once, collecting vertices, page id sets and edges."""
    seen: set[str] = set()
    vertices: dict[str, list[tuple[str, tuple]]] = {}
    ids_by_page: dict[str, set[str]] = {}
    edges: list[tuple[str, str, str, str]] = []

    for page, cell, geom in _cells(tree):
        cid = cell.get("id")
        if cid in seen:
            problems.append(f"[{page}] duplicate cell id '{cid}'")
        seen.add(cid)
        ids_by_page.setdefault(page, set()).add(cid)

        if cell.get("edge") == "1":
            if cell.get("source") or cell.get("target"):
                edges.append((page, cid, cell.get("source"), cell.get("target")))
            continue
        if cell.get("parent") != "1":
            continue  # attribute rows use parent-relative geometry

        box = _box(geom)
        if box is None:
            problems.append(f"[{page}] cell '{cid}' has no usable geometry")
            continue

        if _is_boundary(cell.get("style", "")):
            continue
        vertices.setdefault(page, []).append((cid, box))

        needed = _needed_height(cell.get("value", ""), box[2])
        if needed > box[3] + 1:
            problems.append(
                f"[{page}] '{cid}' text needs ~{needed:.0f}px but box is {box[3]:.0f}px tall"
            )

    return vertices, ids_by_page, edges


def _check_edges(edges: list, ids_by_page: dict, problems: list[str]) -> None:
    for page, cid, src, dst in edges:
        for endpoint, role in ((src, "source"), (dst, "target")):
            if endpoint and endpoint not in ids_by_page.get(page, set()):
                problems.append(f"[{page}] edge '{cid}' {role} '{endpoint}' does not exist")


def _check_overlaps(vertices: dict, problems: list[str]) -> None:
    for page, items in vertices.items():
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                if _overlap(items[i][1], items[j][1]):
                    problems.append(f"[{page}] '{items[i][0]}' overlaps '{items[j][0]}'")


def validate(tree: ET.ElementTree) -> list[str]:
    """Return human-readable problems. An empty list means the document is sound."""
    problems: list[str] = []
    vertices, ids_by_page, edges = _scan(tree, problems)
    _check_edges(edges, ids_by_page, problems)
    _check_overlaps(vertices, problems)
    return problems


def summarise(tree: ET.ElementTree) -> str:
    pages = tree.getroot().findall("diagram")
    lines = []
    for diagram in pages:
        model = diagram.find("mxGraphModel")
        cells = list(diagram.iter("mxCell"))
        v = sum(1 for c in cells if c.get("vertex") == "1" and c.get("parent") == "1")
        e = sum(1 for c in cells if c.get("edge") == "1")
        lines.append(
            f"  {diagram.get('name'):<44} {v:>3} elements  {e:>3} relationships  "
            f"{model.get('pageWidth')}x{model.get('pageHeight')}"
        )
    return f"{len(pages)} pages\n" + "\n".join(lines)
