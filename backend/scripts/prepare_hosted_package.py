"""Build a credential-free product upload with a content-hash manifest."""

import argparse
import hashlib
import json
import shutil
from pathlib import Path

from backend.verification.packaging import allowed


def prepare(source: Path, destination: Path) -> dict[str, str]:
    if destination.exists():
        raise FileExistsError(f'Use a new output directory: {destination}')
    if destination.resolve().is_relative_to(source.resolve()):
        raise ValueError('The upload package must be outside the source checkout')
    manifest: dict[str, str] = {}
    for root in ('frontend',):
        for path in (source / root).rglob('*'):
            relative = path.relative_to(source)
            if not path.is_file() or path.is_symlink() or not allowed(relative):
                continue
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, target)
            manifest[relative.as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    if 'frontend/package-lock.json' not in manifest:
        raise ValueError('Missing dependency lockfile')
    (destination / 'upload-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    arguments = parser.parse_args()
    source = Path(__file__).resolve().parents[2]
    manifest = prepare(source, arguments.output)
    print(f'PASS: packaged {len(manifest)} source files; no credentials or build output')


if __name__ == '__main__':
    main()
