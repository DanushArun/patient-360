"""Allow only product source and the explicit runtime contracts in hosted uploads."""

from pathlib import Path


WEB_FILES = frozenset({
    'package.json', 'package-lock.json', 'next.config.ts', 'next-env.d.ts',
    'tsconfig.json', 'postcss.config.mjs', 'components.json',
})
RUNTIME_FILES = frozenset({
    'frontend/contracts/answer_schema.json',
    'frontend/fixtures/daycare_census_recorded.json',
})
FONT_NOTICES = frozenset({
    'frontend/public/fonts/LICENSE-Inter.txt',
    'frontend/public/fonts/LICENSE-JetBrainsMono.txt',
    'frontend/public/fonts/LICENSE-MaterialSymbols.txt',
})
SOURCE_ROOTS = frozenset({'app', 'components', 'lib', 'public'})
SOURCE_SUFFIXES = frozenset({
    '.ts', '.tsx', '.mjs', '.mts', '.js', '.jsx', '.css', '.json',
    '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.woff', '.woff2',
})


def allowed(path: Path) -> bool:
    parts = path.parts
    if path.is_absolute() or '..' in parts or any(part.startswith('.') for part in parts):
        return False
    if path.as_posix() in RUNTIME_FILES | FONT_NOTICES:
        return True
    if len(parts) < 2 or parts[0] != 'frontend':
        return False
    if len(parts) == 2:
        return parts[1] in WEB_FILES
    if parts[1] not in SOURCE_ROOTS or path.suffix not in SOURCE_SUFFIXES:
        return False
    return not ('.test.' in path.name or path.name.endswith('.spec.ts'))
