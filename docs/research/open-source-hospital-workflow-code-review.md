# Open-source hospital workflow code review

**Research date:** 24 September 2026
**Purpose:** Inspect public repositories that implement real patient, encounter, chart and hospital
workflows; extract product lessons relevant to Saarthi without copying an entire HIS.

## Scope and method

This is a source-level review of selected workflow entry points and repository architecture, not a
claim that every line in every hospital repository on GitHub was audited. The universe is too large
and includes forks, archived projects, client-specific distributions and code that is not hosted on
GitHub. I reviewed repository trees, workflow-specific READMEs/setup paths, explicit UI composition
and navigation definitions, and code/documentation identifying what opens from patient and visit
context. I did not run these systems, audit clinical safety/security, or inspect every backend
handler, schema, migration and test.

Primary repositories reviewed:

| Project | Repository areas / source paths reviewed | What this establishes |
|---|---|---|
| OpenMRS 3 | `openmrs-esm-patient-management` package map (registration, search, appointments, active visits, queues, bed/ward); `openmrs-esm-patient-chart` widget map and layout; patient banner README; distro config | How registration and queues hand off to patient charts; how patient identity and encounter context persist; chart sections are modular widgets. |
| Bahmni | `bahmni-apps-frontend` source tree and setup guide; deployment flow through Bahmni Docker; org repositories for legacy frontend/core and newer frontend/IPD | The EMR is a composed system; active patient / active queue is a landing path; modern UI work is being delivered as frontend modules rather than replacing the clinical backend. |
| OpenEMR | `interface/main/tabs/menu/menus/standard.json`; `interface/patient_file/history/encounters.php`; Standard REST API guide | Workflow navigation is permission-gated; calendar, flow, patient search, chart and encounter history are explicit tasks; chart history resolves documents by encounter. |
| Open Hospital | `openhospital-core` and `openhospital-gui` repository trees; official admin guide and release notes for admission, OPD, patient data and chart flows | A hospital-oriented system separates core and GUI components and connects admission, outpatient care, diagnostics and operational modules. |
| LibreHealth EHR | repository structure, controllers, patient-management heritage and setup docs | Practice-management/EHR codebase descended from OpenEMR; useful as an additional implementation lineage, not an independent workflow validation. |
| HospitalRun | archived monorepo, frontend/server/core architecture notes | Offline-first React + PouchDB/CouchDB design is instructive for constrained settings; repository is archived and must not be treated as an active product baseline. |

GNU Health was checked as a further hospital-management system, but its current project home is
Codeberg and the official docs direct source users there. It is included as corroboration of broad
modular HIS scope, not counted as a GitHub code review.

## Findings by workflow

### 1. Work begins in patient lists and service queues

OpenMRS separates patient registration/search, appointments, active visits, patient lists and
service queues into distinct modules. Its patient-management project describes those areas
explicitly, and its release history shows iterative additions such as queue-screen extensions,
location filters, queue administration and visit-start actions. Bahmni's current setup path likewise
has the user register a patient, start a visit, then enter the clinical module's Active queue.

**Implication:** the useful home screen is an actionable worklist. Rows should answer who needs
attention, for which encounter/location, what state they are in, and what action opens the evidence.
An anatomy illustration does not answer those operational questions.

### 2. Patient identity and active encounter stay visible

The OpenMRS patient banner is an explicit chart-level component. Its description includes name,
avatar, gender, age, identifiers, address/contact/relationships, and tags for an active visit or
deceased state. The chart layout separates navigation, patient header, dashboard widgets, data-entry
workspace and side menu. The patient chart then composes allergies, conditions, medications, notes,
orders, tests, procedures, vitals, forms and other widgets.

**Implication:** keep identity, identifier/link state, current visit and as-of date in a persistent
header. Use compact sections and drill-down; don't put the entire chart on one dashboard. For
Saarthi, source and evidence status need to be persistent alongside identity because cross-facility
reconciliation is the product's core work.

### 3. Encounter history is a navigable record, not a generated story

OpenEMR's standard menu declares calendar, patient finder, flow tracker, patient chart and related
actions with access-control requirements. Its encounter-history implementation is organized around
the selected patient session and encounter ID, including a document list by encounter. Its API
documentation distinguishes native OpenEMR resources from interoperability-focused FHIR APIs and
lists patient and encounter endpoints.

**Implication:** each summary claim should jump to its originating record/encounter/document. Keep
workflow actions in the existing encounter context and honor role permissions. The copilot should
read and reconcile records, then route unresolved clinical questions to the practitioner; it
should not become a parallel chart or make treatment decisions.

### 4. Hospital operations are modular, but the user's task is narrow

Bahmni's org presents a connected stack spanning OpenMRS, OpenELIS and Odoo, plus imaging/PACS and
inpatient components. Its newer apps frontend is a React/TypeScript monorepo; its IPD frontend is a
separate React microfrontend. Open Hospital spans pharmacy, lab, OPD, admission/discharge, pregnancy,
vaccines, billing, therapy and appointments. GNU Health similarly documents EMR/HMIS/HIS modules.

**Implication:** don't imitate all of an incumbent HIS. Fit alongside it with the cross-system task
it does poorly: establish what is present, pending, missing or conflicting for an upcoming care
decision, show exactly where that came from, and assign/track the operational next step.

### 5. Offline capability is a deployment property, not a decorative UI feature

HospitalRun explicitly used an offline-first React/PouchDB/CouchDB architecture for developing-world
hospitals, but the project organization is now archived and its code is not a current baseline.
Bahmni's current frontend setup describes PWA/offline capabilities as part of the deployed frontend
architecture.

**Implication:** do not claim offline readiness unless local persistence, synchronization conflicts,
security and stale-data behavior are actually implemented and demonstrated. A local loading state or
cached visual shell is not offline clinical workflow support.

## Relevance to the anatomy-map idea

Across these examined repositories, the patient chart is organized around identity, encounters,
lists, vitals, diagnoses/conditions, medications, tests, notes and documents. The reviewed source
areas do not establish an animated organ map as a standard HIS dashboard pattern. That does not prove
no specialty product ever uses body diagrams. It does show that adding a polished model without
structured, source-backed anatomical locations would be a visual feature detached from the core
workflow.

**Recommendation remains: defer it.** If a specific workflow later needs body-site localization,
start with a clinician-validated static diagram attached to a source-backed observation and exact
body site, with a link back to the source. Do not infer location from a free-text diagnosis or use an
animation as a clinical finding.

## Saarthi workflow recommendation

The code patterns support this narrow end-to-end flow:

1. **Worklist:** upcoming visits / records needing review, each with owner and state.
2. **Patient orientation:** stable identity/link state, current encounter, facility, care team and
   `known_as_of`.
3. **Readiness / reconciliation:** deterministic status, reason and explicit missing/conflicting /
   pending states.
4. **Evidence inspection:** each claim opens the source document span or structured row with source,
   event time, recorded time and ingestion time.
5. **Coordination action:** assign/request/escalate, then return to the list with visible owner,
   state, history and resolution evidence.
6. **Ask the record:** bounded Class B questions with citations; ambiguous or Class A questions are
   routed to the named treating practitioner as an evidence packet.

This aligns with Saarthi's current architecture and completeness map. It is an implementation
priority recommendation, not evidence that the workflow is already complete.

## Evidence quality and limitations

- **Code paths are primary evidence** for module boundaries, component composition and navigation
  metadata; they are not proof that a deployed hospital configures the system the same way.
- **Bahmni, OpenMRS and OpenEMR** provide the strongest active code examples in this review.
- **Open Hospital** is valuable for real hospital module coverage and longevity; the inspected
  workflow specifics also rely on its official manual/release descriptions.
- **LibreHealth** inherits heavily from OpenEMR and should not be treated as an independent pattern
  vote.
- **HospitalRun** is archived; use only as historical architecture reference.
- **No source-code review validates clinical safety, usability outcomes, legal compliance or
  production security.** Those require separate work.
- This selection is representative, not exhaustive. Vendor systems in the prior landscape study
  are generally not open-source and do not publish their production implementation.
- Repository links point to default branches and can change after this research date; this review
  did not pin a commit SHA for every repository.

## Repository/source index

- [OpenMRS patient management](https://github.com/openmrs/openmrs-esm-patient-management)
- [OpenMRS patient chart](https://github.com/openmrs/openmrs-esm-patient-chart)
- [OpenMRS patient banner component](https://github.com/openmrs/openmrs-esm-patient-chart/blob/main/packages/esm-patient-banner-app/README.md)
- [OpenMRS reference application config](https://github.com/openmrs/openmrs-distro-referenceapplication/blob/main/frontend/config-core_demo.json)
- [Bahmni apps frontend](https://github.com/Bahmni/bahmni-apps-frontend)
- [Bahmni frontend setup and active-queue path](https://github.com/Bahmni/bahmni-apps-frontend/blob/main/docs/setup-guide.md)
- [Bahmni organization and components](https://github.com/bahmni)
- [OpenEMR standard menu definition](https://github.com/openemr/openemr/blob/master/interface/main/tabs/menu/menus/standard.json)
- [OpenEMR encounter history](https://github.com/openemr/openemr/blob/master/interface/patient_file/history/encounters.php)
- [OpenEMR Standard REST API guide](https://github.com/openemr/openemr/blob/master/Documentation/api/STANDARD_API.md)
- [Open Hospital core](https://github.com/informatici/openhospital-core)
- [Open Hospital GUI](https://github.com/informatici/openhospital-gui)
- [Open Hospital official manual](https://github.com/informatici/openhospital-doc/blob/develop/doc_admin/AdminManual.adoc)
- [LibreHealth EHR](https://github.com/LibreHealthIO/lh-ehr)
- [HospitalRun archived organization](https://github.com/HospitalRun)
- [GNU Health project docs](https://docs.gnuhealth.org/his/)
