import hashlib
import json
from pathlib import Path

import pytest

from backend.scripts.load_reference_documents import checked_records


def fixture_catalog(tmp_path: Path, content: bytes, expected: str) -> Path:
    (tmp_path / 'guide.pdf').write_bytes(content)
    catalog = tmp_path / 'catalog.json'
    catalog.write_text(json.dumps({'entries': [{'filename': 'guide.pdf', 'sha256': expected,
        'pages': 1, 'publisher': 'Checked publisher'}]}))
    return catalog


def test_reference_loader_when_hash_changed_rejects_before_parsing(tmp_path: Path) -> None:
    catalog = fixture_catalog(tmp_path, b'%PDF-changed', '0' * 64)
    with pytest.raises(ValueError, match='reference_hash_mismatch'):
        checked_records(catalog)


def test_reference_loader_when_html_disguised_as_pdf_rejects(tmp_path: Path) -> None:
    content = b'<html>redirected portal</html>'
    catalog = fixture_catalog(tmp_path, content, hashlib.sha256(content).hexdigest())
    with pytest.raises(ValueError, match='reference_not_pdf'):
        checked_records(catalog)


def test_reference_loader_when_path_escapes_catalog_rejects(tmp_path: Path) -> None:
    catalog = tmp_path / 'catalog.json'
    catalog.write_text(json.dumps({'entries': [{'filename': '../guide.pdf'}]}))
    with pytest.raises(ValueError, match='reference_path_outside_catalog'):
        checked_records(catalog)


def test_reference_parser_when_page_warns_quarantines_text(monkeypatch: pytest.MonkeyPatch,
                                                         tmp_path: Path) -> None:
    import logging
    from types import SimpleNamespace
    from backend.scripts import load_reference_documents as loader

    class Page:
        def extract_text(self) -> str:
            logging.getLogger('pypdf').warning('unsupported encoding')
            return 'possibly corrupted quotation'

    monkeypatch.setattr(loader, 'PdfReader', lambda _path: SimpleNamespace(pages=[Page()]))
    assert loader.checked_pages(tmp_path / 'guide.pdf', 1) == {
        'texts': [''], 'parser_warnings': [{'page_index': 0,
            'messages': ['unsupported encoding']}], 'status': 'unreadable'}


def test_reference_parser_when_page_clean_preserves_literal_text(monkeypatch: pytest.MonkeyPatch,
                                                               tmp_path: Path) -> None:
    from types import SimpleNamespace
    from backend.scripts import load_reference_documents as loader

    page = SimpleNamespace(extract_text=lambda: 'literal checked passage')
    monkeypatch.setattr(loader, 'PdfReader', lambda _path: SimpleNamespace(pages=[page]))
    assert loader.checked_pages(tmp_path / 'guide.pdf', 1) == {
        'texts': ['literal checked passage'], 'parser_warnings': [], 'status': 'active'}
