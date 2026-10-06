from pathlib import Path


def test_package_when_credential_or_build_path_seen_excludes_upload() -> None:
    from backend.verification.packaging import allowed

    paths = ['frontend/.env.local', 'frontend/.snowflake/key.p8', 'frontend/.next/server/app.js',
             'frontend/node_modules/pkg/index.js', 'frontend/snowflake.log']
    assert not any(allowed(Path(path)) for path in paths)


def test_package_when_product_source_seen_includes_upload() -> None:
    from backend.verification.packaging import allowed

    assert allowed(Path('frontend/app/api/ask/route.ts'))


def test_package_when_official_font_notice_seen_preserves_distribution_notice() -> None:
    from backend.verification.packaging import allowed

    notices = ['LICENSE-Inter.txt', 'LICENSE-JetBrainsMono.txt', 'LICENSE-MaterialSymbols.txt']
    assert all(allowed(Path('frontend/public/fonts') / name) for name in notices)
