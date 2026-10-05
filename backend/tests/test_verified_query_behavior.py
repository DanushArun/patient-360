from pathlib import Path
import sqlite3

from backend.verification.native import verified_queries


def query(name: str) -> str:
    source = Path('backend/sql/semantic/01_semantic_view.sql').read_text()
    return next(item['sql'] for item in verified_queries(source) if item['name'] == name)


def test_authorisation_when_decisive_sources_disagree_returns_conflict() -> None:
    with sqlite3.connect(':memory:') as db:
        db.execute('CREATE TABLE authorization(patient_id,scheme,status,letter_status)')
        db.execute("INSERT INTO authorization VALUES ('P7','PM-JAY','approved','denied')")
        sql = query('vq_conflicting_authorisation').replace('SAARTHI.CORE.AUTHORIZATION',
                                                           'authorization')
        assert db.execute(sql).fetchall() == [('P7', 'PM-JAY', 'approved', 'denied')]


def test_authorisation_when_letter_missing_does_not_turn_missing_into_conflict() -> None:
    with sqlite3.connect(':memory:') as db:
        db.execute('CREATE TABLE authorization(patient_id,scheme,status,letter_status)')
        db.execute("INSERT INTO authorization VALUES ('P8','PM-JAY','approved','not_received')")
        sql = query('vq_conflicting_authorisation').replace('SAARTHI.CORE.AUTHORIZATION',
                                                           'authorization')
        assert db.execute(sql).fetchall() == []


def test_authorisation_when_table_pending_and_letter_approved_returns_conflict() -> None:
    with sqlite3.connect(':memory:') as db:
        db.execute('CREATE TABLE authorization(patient_id,scheme,status,letter_status)')
        db.execute("INSERT INTO authorization VALUES ('P7','PM-JAY','pending','approved')")
        sql = query('vq_conflicting_authorisation').replace('SAARTHI.CORE.AUTHORIZATION',
                                                           'authorization')
        assert db.execute(sql).fetchall() == [('P7', 'PM-JAY', 'pending', 'approved')]


def test_blockers_when_open_informational_issue_exists_does_not_count_it() -> None:
    with sqlite3.connect(':memory:') as db:
        db.execute('CREATE TABLE issue(gate,state,severity)')
        db.executemany('INSERT INTO issue VALUES (?,?,?)',
                       [('clinical', 'open', 'blocker'), ('clinical', 'open', 'info')])
        sql = query('vq_open_blockers_per_gate').replace('SAARTHI.OPERATIONAL.REVIEW_ISSUE',
                                                        'issue')
        assert db.execute(sql).fetchall() == [('clinical', 1)]
