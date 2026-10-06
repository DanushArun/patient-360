"""Generate the SAARTHI draw.io architecture document.

Usage:  python3 -m tools.drawio.generate
Writes: docs/architecture/drawio/SAARTHI-architecture.drawio

The generated file is a normal editable draw.io document. Once it has been edited
by hand in draw.io, the .drawio file becomes the source of truth and regenerating
will overwrite those edits.
"""
from __future__ import annotations

import pathlib
import sys

from .serialize import build
from .validate import summarise, validate
from . import pages_c4, pages_data, pages_flow

OUT = pathlib.Path("docs/architecture/drawio/SAARTHI-architecture.drawio")

ORDER = [
    *pages_c4.PAGES[:5],
    pages_flow.trust_boundaries,
    pages_flow.sequence,
    pages_flow.extraction,
    pages_data.erd_identity,
    pages_data.erd_clinical,
    pages_flow.pipeline,
    pages_data.state_assertion,
    pages_data.state_document,
    pages_flow.class_routing,
    pages_flow.gate_outcomes,
]


def main() -> int:
    tree = build([factory() for factory in ORDER])
    problems = validate(tree)

    print(summarise(tree))
    if problems:
        print(f"\n{len(problems)} problem(s):")
        for problem in problems:
            print("  -", problem)
        return 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    tree.write(OUT, encoding="utf-8", xml_declaration=True)
    print(f"\nvalidation clean -> {OUT} ({OUT.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
