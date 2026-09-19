"""Serialisation of Page objects into a draw.io mxfile document."""
from __future__ import annotations

import xml.etree.ElementTree as ET

from .model import (
    MARGIN,
    STYLE,
    Edge,
    Entity,
    Page,
    PointEdge,
    resolve,
    side_style,
)


def _add_cell(root: ET.Element, cid: str, value: str, style: str, geom: tuple) -> None:
    cell = ET.SubElement(
        root, "mxCell", {"id": cid, "value": value, "style": style, "vertex": "1", "parent": "1"}
    )
    x, y, w, h = geom
    ET.SubElement(
        cell,
        "mxGeometry",
        {"x": str(x), "y": str(y), "width": str(w), "height": str(h), "as": "geometry"},
    )


def _add_entity(root: ET.Element, ent: Entity) -> None:
    x, y, w, h = ent.geometry()
    parent = ET.SubElement(
        root,
        "mxCell",
        {"id": ent.nid, "value": ent.name, "style": STYLE["entity"], "vertex": "1", "parent": "1"},
    )
    ET.SubElement(
        parent,
        "mxGeometry",
        {"x": str(x), "y": str(y), "width": str(w), "height": str(h), "as": "geometry"},
    )
    for i, attr in enumerate(ent.attrs):
        child = ET.SubElement(
            root,
            "mxCell",
            {
                "id": f"{ent.nid}_a{i}",
                "value": attr,
                "style": STYLE["attr"],
                "vertex": "1",
                "parent": ent.nid,
            },
        )
        ET.SubElement(
            child,
            "mxGeometry",
            {
                "x": "0",
                "y": str(32 + i * ent.row_h),
                "width": str(w),
                "height": str(ent.row_h),
                "as": "geometry",
            },
        )


def _add_edge(root: ET.Element, eid: str, edge: Edge) -> None:
    cell = ET.SubElement(
        root,
        "mxCell",
        {
            "id": eid,
            "value": edge.text,
            "style": edge.style + side_style(edge.exit_side, edge.entry_side),
            "edge": "1",
            "parent": "1",
            "source": edge.src,
            "target": edge.dst,
        },
    )
    ET.SubElement(cell, "mxGeometry", {"relative": "1", "as": "geometry"})


def _add_point_edge(root: ET.Element, eid: str, edge: PointEdge) -> None:
    cell = ET.SubElement(
        root,
        "mxCell",
        {"id": eid, "value": edge.text, "style": edge.style, "edge": "1", "parent": "1"},
    )
    geom = ET.SubElement(cell, "mxGeometry", {"relative": "1", "as": "geometry"})
    ET.SubElement(geom, "mxPoint", {"x": str(edge.x1), "y": str(edge.y1), "as": "sourcePoint"})
    ET.SubElement(geom, "mxPoint", {"x": str(edge.x2), "y": str(edge.y2), "as": "targetPoint"})


def _namespace(page: Page, prefix: str) -> None:
    """Prefix every id on the page so ids are unique across the whole document."""
    for node in page.nodes:
        node.nid = prefix + node.nid
    for boundary in page.boundaries:
        boundary.bid = prefix + boundary.bid
        boundary.members = [prefix + m for m in boundary.members]
    for edge in page.edges:
        if isinstance(edge, Edge):
            edge.src = prefix + edge.src
            edge.dst = prefix + edge.dst


def _model_attrs(width: int, height: int) -> dict[str, str]:
    return {
        "dx": "1600",
        "dy": "1000",
        "grid": "1",
        "gridSize": "10",
        "guides": "1",
        "tooltips": "1",
        "connect": "1",
        "arrows": "1",
        "fold": "1",
        "page": "1",
        "pageScale": "1",
        "pageWidth": str(width),
        "pageHeight": str(height),
        "math": "0",
        "shadow": "0",
    }


def _emit_page(mxfile: ET.Element, page: Page, index: int) -> None:
    _namespace(page, f"p{index}_")
    resolved = resolve(page)
    width = max(b[0] + b[2] for b in resolved.values()) + MARGIN
    height = max(b[1] + b[3] for b in resolved.values()) + MARGIN

    diagram = ET.SubElement(mxfile, "diagram", {"id": f"page{index}", "name": page.name})
    model = ET.SubElement(diagram, "mxGraphModel", _model_attrs(width, height))
    root = ET.SubElement(model, "root")
    ET.SubElement(root, "mxCell", {"id": "0"})
    ET.SubElement(root, "mxCell", {"id": "1", "parent": "0"})

    # Largest boundary first so smaller nested boundaries paint on top.
    for boundary in sorted(
        page.boundaries, key=lambda b: -(resolved[b.bid][2] * resolved[b.bid][3])
    ):
        _add_cell(root, boundary.bid, boundary.text, STYLE[boundary.style], resolved[boundary.bid])
    for node in page.nodes:
        if isinstance(node, Entity):
            _add_entity(root, node)
        else:
            _add_cell(root, node.nid, node.text, STYLE.get(node.style, node.style), node.geometry())
    for i, edge in enumerate(page.edges, 1):
        if isinstance(edge, PointEdge):
            _add_point_edge(root, f"e{index}_{i}", edge)
        else:
            _add_edge(root, f"e{index}_{i}", edge)


def build(pages: list[Page]) -> ET.ElementTree:
    """Serialise pages into an mxfile ElementTree."""
    mxfile = ET.Element(
        "mxfile",
        {"host": "app.diagrams.net", "agent": "SAARTHI diagram generator", "type": "device"},
    )
    for index, page in enumerate(pages, 1):
        _emit_page(mxfile, page, index)
    tree = ET.ElementTree(mxfile)
    ET.indent(tree, space="  ")
    return tree
