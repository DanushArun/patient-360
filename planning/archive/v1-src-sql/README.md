# Archived — v1 schema, superseded

`001_database_and_schemas.sql` and `002_core_tables.sql` predate the revised architecture (`planning/revised-architecture/`) and contradict it: `ENCOUNTER.facility` is a bare `VARCHAR` where the spec requires a `facility_id` FK, six schemas exist where seven are required, and no `GOVERNANCE` schema or tables exist at all.

Superseded by `backend/sql/setup.sql` (`SPEC.md` §2, 34 tables across `CORE`, `DOCUMENTS`, `EVIDENCE`, `OPERATIONAL`, `GOVERNANCE`). Kept here, not deleted, as planning-phase CoCo lifecycle evidence — see `planning/builder-1/REPO-STRUCTURE.md` §4.
