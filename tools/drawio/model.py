"""draw.io (mxGraph) document primitives for the SAARTHI architecture diagram set.

Colour and shape semantics are identical to the master notation key in
docs/architecture/ARCHITECTURE-DIAGRAMS.md, so one key serves both
the Mermaid and the draw.io renderings.
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass, field

COL_W, ROW_H, GAP_X, GAP_Y, MARGIN = 300, 150, 60, 90, 60
BOUNDARY_PAD, BOUNDARY_TITLE = 28, 30

_PERSON = "#123a5c"
_NEUTRAL = "#2e6da4"
_EXTERNAL = "#8c8c8c"
_AI = "#8a5a00"
_ENFORCE = "#8b1a1a"
_FAILED = "#4a4a4a"


def _box(fill: str, stroke: str, font: str = "#ffffff", extra: str = "") -> str:
    return (
        f"rounded=1;arcSize=6;whiteSpace=wrap;html=1;fillColor={fill};"
        f"strokeColor={stroke};fontColor={font};align=center;verticalAlign=middle;"
        f"fontSize=12;spacingTop=2;spacingBottom=2;{extra}"
    )


def _cylinder(fill: str, stroke: str) -> str:
    return (
        f"shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=14;whiteSpace=wrap;"
        f"html=1;fillColor={fill};strokeColor={stroke};fontColor=#ffffff;fontSize=11;"
        f"verticalAlign=middle;"
    )


STYLE: dict[str, str] = {
    "person": (
        f"shape=mxgraph.c4.person2;html=1;whiteSpace=wrap;fillColor={_PERSON};"
        "strokeColor=none;fontColor=#ffffff;align=center;verticalAlign=top;"
        "spacingTop=4;fontSize=11;"
    ),
    "system": _box(_NEUTRAL, "#1c4568"),
    "focus": _box(_PERSON, "#0b2439", extra="strokeWidth=3;"),
    "ext": _box(_EXTERNAL, "#6c6c6c"),
    "ai": _box(_AI, "#5c3c00"),
    "det": _box(_PERSON, "#0b2439"),
    "enforce": _box(_ENFORCE, "#5a0f0f"),
    "failed": _box(_FAILED, "#2a2a2a"),
    "plain": _box("#ffffff", "#333333", font="#000000"),
    "store": _cylinder(_NEUTRAL, "#1c4568"),
    "store_det": _cylinder(_PERSON, "#0b2439"),
    "store_enforce": _cylinder(_ENFORCE, "#5a0f0f"),
    "diamond": (
        "rhombus;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#333333;"
        "fontColor=#000000;fontSize=11;"
    ),
    "state": _box("#2e6da4", "#1c4568", extra="arcSize=40;"),
    "state_det": _box(_PERSON, "#0b2439", extra="arcSize=40;"),
    "state_bad": _box(_ENFORCE, "#5a0f0f", extra="arcSize=40;"),
    "terminal": "ellipse;whiteSpace=wrap;html=1;fillColor=#333333;strokeColor=#000000;",
    "note": (
        "shape=note;whiteSpace=wrap;html=1;size=14;fillColor=#fff8dc;"
        "strokeColor=#c8a800;fontColor=#000000;align=left;verticalAlign=top;"
        "fontSize=10;spacingLeft=6;"
    ),
    "boundary": (
        "rounded=1;arcSize=3;html=1;dashed=1;dashPattern=8 4;fillColor=none;"
        "strokeColor=#666666;fontColor=#333333;verticalAlign=top;align=left;"
        "spacingLeft=14;spacingTop=2;fontSize=12;fontStyle=1;"
    ),
    "trust": (
        "rounded=1;arcSize=3;html=1;dashed=1;dashPattern=8 4;strokeWidth=2;"
        "fillColor=#fffafa;strokeColor=#c0392b;fontColor=#c0392b;verticalAlign=top;"
        "align=left;spacingLeft=14;spacingTop=2;fontSize=12;fontStyle=1;"
    ),
    "lifeline": (
        "shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;"
        "container=0;collapsible=0;recursiveResize=0;outlineConnect=0;size=58;"
        f"fillColor={_NEUTRAL};strokeColor=#1c4568;fontColor=#ffffff;fontSize=11;"
    ),
    "entity": (
        "swimlane;fontStyle=1;childLayout=stackLayout;horizontal=1;startSize=32;"
        "horizontalStack=0;resizeParent=0;resizeParentMax=0;html=1;whiteSpace=wrap;"
        f"fillColor=#ffffff;strokeColor=#1c4568;fontColor=#ffffff;swimlaneFillColor=#ffffff;"
        f"swimlaneLine=1;fontSize=12;rounded=0;startFillColor={_NEUTRAL};"
    ),
    "attr": (
        "text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;"
        "spacingLeft=6;spacingRight=6;overflow=hidden;rotatable=0;whiteSpace=wrap;"
        "html=1;fontSize=10;points=[[0,0.5,0,0,0],[1,0.5,0,0,0]];portConstraint=eastwest;"
    ),
}

EDGE = (
    "edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;jumpStyle=arc;jumpSize=8;"
    "strokeColor=#333333;fontSize=10;fontColor=#333333;labelBackgroundColor=#ffffff;"
    "endArrow=blockThin;endFill=1;"
)
EDGE_FAIL = EDGE + "dashed=1;dashPattern=5 5;strokeColor=#8b1a1a;fontColor=#8b1a1a;"
EDGE_STRAIGHT = EDGE.replace("edgeStyle=orthogonalEdgeStyle", "edgeStyle=none")
EDGE_ER = (
    "edgeStyle=entityRelationEdgeStyle;html=1;rounded=0;strokeColor=#1c4568;"
    "fontSize=10;labelBackgroundColor=#ffffff;startArrow=ERone;startFill=0;"
    "endArrow=ERmany;endFill=0;"
)


def label(name: str, kind: str | None = None, desc: str | None = None) -> str:
    """Build a C4-style element label: bold name, [type: technology], description."""
    parts = [f"<b>{name}</b>"]
    if kind:
        parts.append(f"<font style='font-size:10px'>[{kind}]</font>")
    if desc:
        parts.append(f"<font style='font-size:10px'>{desc}</font>")
    return "<br/>".join(parts)


@dataclass
class Node:
    nid: str
    text: str
    style: str = "system"
    col: int = 0
    row: int = 0
    cspan: int = 1
    height: int | None = None
    width: int | None = None
    dx: int = 0
    dy: int = 0

    def geometry(self) -> tuple[int, int, int, int]:
        x = MARGIN + self.col * (COL_W + GAP_X) + self.dx
        y = MARGIN + self.row * (ROW_H + GAP_Y) + self.dy
        w = self.width or (COL_W * self.cspan + GAP_X * (self.cspan - 1))
        return x, y, w, self.height or ROW_H


@dataclass
class Free:
    """A node placed at absolute pixel coordinates rather than on the grid."""

    nid: str
    text: str
    style: str
    x: int
    y: int
    w: int
    h: int

    def geometry(self) -> tuple[int, int, int, int]:
        return self.x, self.y, self.w, self.h


@dataclass
class Entity:
    """An ERD entity rendered as a titled list of attribute rows."""

    nid: str
    name: str
    attrs: list[str]
    col: int = 0
    row: int = 0
    width: int = 300
    dy: int = 0
    row_h: int = 22

    def geometry(self) -> tuple[int, int, int, int]:
        x = MARGIN + self.col * (COL_W + GAP_X)
        y = MARGIN + self.row * (ROW_H + GAP_Y) + self.dy
        return x, y, self.width, 32 + self.row_h * len(self.attrs)


@dataclass
class Edge:
    src: str
    dst: str
    text: str = ""
    style: str = EDGE
    exit_side: str | None = None
    entry_side: str | None = None


@dataclass
class PointEdge:
    """An edge between two absolute points, used for sequence messages."""

    x1: int
    y1: int
    x2: int
    y2: int
    text: str = ""
    style: str = EDGE_STRAIGHT


@dataclass
class Boundary:
    bid: str
    text: str
    members: list[str]
    style: str = "boundary"
    pad: int = BOUNDARY_PAD


@dataclass
class Page:
    name: str
    nodes: list = field(default_factory=list)
    boundaries: list[Boundary] = field(default_factory=list)
    edges: list = field(default_factory=list)

    def by_id(self) -> dict:
        return {n.nid: n for n in self.nodes}


_SIDES = {
    "N": (0.5, 0),
    "S": (0.5, 1),
    "E": (1, 0.5),
    "W": (0, 0.5),
}


def side_style(exit_side: str | None, entry_side: str | None) -> str:
    out = ""
    if exit_side:
        x, y = _SIDES[exit_side]
        out += f"exitX={x};exitY={y};exitDx=0;exitDy=0;"
    if entry_side:
        x, y = _SIDES[entry_side]
        out += f"entryX={x};entryY={y};entryDx=0;entryDy=0;"
    return out


def _boundary_geometry(boundary: Boundary, resolved: dict) -> tuple[int, int, int, int]:
    boxes = [resolved[m] for m in boundary.members]
    x0 = min(b[0] for b in boxes) - boundary.pad
    y0 = min(b[1] for b in boxes) - boundary.pad - BOUNDARY_TITLE
    x1 = max(b[0] + b[2] for b in boxes) + boundary.pad
    y1 = max(b[1] + b[3] for b in boxes) + boundary.pad
    return x0, y0, x1 - x0, y1 - y0


def resolve(page: Page) -> dict:
    """Return {id: (x, y, w, h)} for every node and boundary, nesting-aware."""
    resolved = {n.nid: n.geometry() for n in page.nodes}
    pending = list(page.boundaries)
    for _ in range(len(pending) + 1):
        if not pending:
            break
        deferred = []
        for boundary in pending:
            if all(m in resolved for m in boundary.members):
                resolved[boundary.bid] = _boundary_geometry(boundary, resolved)
            else:
                deferred.append(boundary)
        if len(deferred) == len(pending):
            missing = {m for b in deferred for m in b.members if m not in resolved}
            raise ValueError(f"unresolvable boundary members on '{page.name}': {missing}")
        pending = deferred
    return resolved
