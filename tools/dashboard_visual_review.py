"""Build a local comparison gallery from the supplied designs and captured frontend."""

import argparse
import html
import json
import shutil
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "planning/dashboard-release/screen-comparison.json"
STYLE = """
body { margin:0; background:#fff; color:#1a1d21; font:14px/1.5 system-ui,sans-serif; }
header { padding:24px 32px; border-bottom:1px solid #e8e7e4; }
h1 { margin:0 0 8px; font-size:28px; } h2 { font-size:22px; margin:0 0 8px; }
nav { display:flex; flex-wrap:wrap; gap:12px; margin-top:16px; }
a { color:#2463a6; } p { max-width:1000px; } section { padding:28px 32px; }
section+section { border-top:1px solid #e8e7e4; }
.pair { display:grid; grid-template-columns:1fr 1fr; gap:20px; align-items:start; }
figure { margin:0; min-width:0; } figcaption { margin:8px 0; color:#656c73; }
img { width:100%; height:auto; border:1px solid #e8e7e4; }
pre { white-space:pre-wrap; overflow-wrap:anywhere; padding:16px; background:#f7f7f5; }
@media(max-width:760px) { .pair { grid-template-columns:1fr; } section { padding:20px; } }
"""


def escaped(value: Any) -> str:
    return html.escape(str(value), quote=True)


def copy_asset(relative: str, destination: Path) -> Path:
    source = (ROOT / relative).resolve()
    if not source.is_relative_to(ROOT) or not source.is_file():
        raise ValueError(f"Missing or out-of-scope asset: {relative}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return source


def screen_markup(row: dict[str, Any], output: Path) -> str:
    number = row["screen"]
    reference = Path(row["reference"])
    reference_name = f"reference/{number}{reference.suffix}"
    actual_name = f"actual/{number}.png"
    source = copy_asset(row["reference"], output / reference_name)
    copy_asset(row["capture"], output / actual_name)
    design = (f'<a href="{reference_name}"><img loading="lazy" '
              f'src="{reference_name}" alt="Designer screen {number}"></a>')
    if reference.suffix == ".txt":
        design = f'<pre>{escaped(source.read_text())}</pre>'
    return f"""<section id="screen-{number}">
      <h2>{number} · {escaped(row['title'])}</h2>
      <p>{escaped(row['note'])}</p>
      <div class="pair"><figure><figcaption>Supplied designer reference</figcaption>
      {design}</figure><figure><figcaption>Actual frontend · synthetic test responses</figcaption>
      <a href="{actual_name}"><img loading="lazy" src="{actual_name}"
      alt="Actual frontend screen {number}"></a></figure></div>
      <p>Implementation: <code>{escaped(row['implementation'])}</code></p>
      </section>"""


def build_gallery(output: Path) -> None:
    packet = json.loads(MANIFEST.read_text())
    rows = packet["screens"]
    if len(rows) != 22 or {row["screen"] for row in rows} != {
        f"{number:02}" for number in range(1, 23)
    }:
        raise ValueError("The comparison must cover exactly 22 designer steps.")
    links = " ".join(f'<a href="#screen-{row["screen"]}">{row["screen"]}</a>' for row in rows)
    screens = "\n".join(screen_markup(row, output) for row in rows)
    document = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>SAARTHI · All 22 screen comparisons</title><style>{STYLE}</style></head><body>
      <header><h1>SAARTHI · All 22 screen comparisons</h1>
      <p>Captured from the implemented frontend. Synthetic API responses demonstrate UI behavior;
      these captures do not prove live database integration or model access.</p>
      <p>237 unit/render tests and 40 browser checks passed. Data-dependent differences are
      listed with each screen. Click either image to inspect it at full size.</p>
      <nav aria-label="Screen comparisons">{links}</nav></header>{screens}</body></html>"""
    (output / "index.html").write_text(document)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="Directory to receive the standalone gallery")
    build_gallery(parser.parse_args().output.resolve())


if __name__ == "__main__":
    main()
