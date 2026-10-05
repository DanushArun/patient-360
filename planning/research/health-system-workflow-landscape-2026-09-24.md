# Hospital software workflow study: India and international references

**Research date:** 24 September 2026
**Purpose:** Learn from hospital information systems and EHR products before shaping SAARTHI's UI.

## Scope and evidence limits

“All hospital systems” is not a finite research set: products vary by country, facility size,
specialty, deployment and local configuration. This study samples public-sector Indian systems,
Indian hospital/clinic vendors, a diagnostics platform, international EHRs and open-source systems.
It does not claim market share or rank vendors.

Sources are product pages, manuals, health-system training material and government documentation.
Public product descriptions establish what vendors say their products support; they do not prove
how consistently hospitals deploy them, their real-world usability, or advertised outcomes. I did
not have authenticated access to live hospital instances. Recommendations are inferences from the
documented workflows and SAARTHI's scope.

## Executive finding

The common pattern is **work first, patient record second, evidence and action always reachable**.
Products organize around concrete jobs: a provider schedule, arrived-patient queue, ward census,
patient chart, lab worklist or follow-up list. They bring the relevant patient context into that
job. Patient charts combine history, visits, medications, tests, documents and operational details;
timelines and summaries help users navigate those records.

Modern AI features are workflow-shaped too: summarize a chart before a visit, answer a bounded
question with links to sources, surface follow-up from an imaging report, or draft documentation
for a human to review. This points to SAARTHI as a **care-readiness and record-reconciliation layer
alongside an existing hospital system**, not a general-purpose HIS. Its narrower job is
cross-facility record reconciliation, pre-visit documentation/authorization completeness,
provenance and tracked coordination work.

## Indian references

| System | Publicly documented workflow | Lesson for SAARTHI | Evidence limit |
|---|---|---|---|
| **NIC eHospital / NextGen eHospital** | Government HMIS covering registration, OPD/IPD, ADT, billing, clinic, lab, radiology, pharmacy and other modules; ORS exposes appointments and patient-facing report access. Clinic records visits, exams, diagnoses, history, treatment and prescriptions, and supports ordering tests and medicines. | Model the visit as a workflow across registration, clinical work, diagnostics and follow-up. Separate staff operations from citizen-facing access. | Government overview, not a live usability study. [NIC eHospital](https://www.nic.gov.in/project/ehospital/), [NextGen eHospital](https://nextgen.ehospital.nic.in/) |
| **Bahmni / OpenMRS** | Open-source HIS/EMR integrating patient management, billing/inventory, lab and PACS. Clinical forms and patient dashboards are configurable; inpatient dashboards and bed workflows can reflect local needs. It targets settings where local hosting and unreliable internet matter. | One fixed dashboard will not suit every specialty or facility. Make role/task views adaptable, and account for connectivity and deployment constraints. | Product/project descriptions; implementations vary. [Bahmni](https://www.bahmni.org/), [Clinical Services](https://www.bahmni.org/clinical-services), [Inpatient Management](https://www.bahmni.org/inpatient-management) |
| **DocPulse** | Connected clinic/hospital operations: appointments, EMR, billing, pharmacy, lab, telemedicine and IPD. EMR material describes structured records, specialty templates, visit history, prescriptions, lab/radiology results and integrated workflows. | History and associated reports should be available in the current consultation context; reduce repeated entry across modules. | Product pages only; no authenticated walkthrough. [DocPulse EMR](https://docpulse.com/products/electronic-medical-health-records/), [Products](https://docpulse.com/products/) |
| **Practo Ray** | Clinic scheduling/calendar, reminders, digital records, follow-up communication and patient sharing. Help material documents offline mobile appointment, billing, records and report capture. | Indian workflows include phone/online/walk-in channels, mobile use, continuity after consultation and offline constraints. Keep provider and patient views distinct. | Vendor/help-center documentation, not independent evaluation. [Practo Ray](https://www.practo.com/providers/clinics/ray), [Offline mobile app](https://help.practo.com/practo-ray/app/how-to-access-ray-offline/) |
| **HealthPlix** | Doctor-first EMR: patient history, vitals, investigation results, specialty case sheets/forms, prescriptions, multilingual communication and offline access. | Keep high-frequency facts close to the encounter. Specialty forms should not force one generic layout; language and connectivity matter. | Vendor pages; scale and impact figures are vendor-reported. [Consultant EMR](https://www.healthplix.com/emr-for-consultant-physician), [Offline EMR](https://blogs.healthplix.com/product-updates/revolutionizing-healthcare-the-launch-of-offline-emr-for-doctors-in-india/) |
| **MocDoc** | Clinic/hospital pages describe connected appointments, EMR, lab, pharmacy, billing, patient portal, OP/IP flows and reporting. | Connect clinical, administrative and diagnostic state while giving each staff role an appropriate workspace. | Primarily marketing material; product implementation detail is limited. [MocDoc clinic EHR](https://mocdoc.com/clinic-emr-ehr-software), [MocDoc India](https://mocdoc.com/india) |
| **IQVIA Hospital Information System (India)** | Described as a single patient record across patient administration, EMR and ancillary modules; includes outpatient/ER, ADT, inventory, pharmacy, billing/claims and patient portal. | Shared patient identity must coexist with role-specific workspaces for clinical, nursing and administrative users. | Vendor overview, not a specific hospital build. [IQVIA HIS India](https://www.iqvia.com/locations/india/product/iqvia-hospital-information-system) |
| **CrelioHealth (diagnostics)** | Lab/radiology workflows include sample management, reporting, provider/patient portals, RIS/PACS, DICOM images and HIS/EHR integration. | Treat reports as source artifacts with dates and links; do not flatten findings into unattributed summaries. | Specialized diagnostic subsystem, not a whole-hospital EHR. [Crelio radiology](https://creliohealth.com/solutions/radiology/), [Crelio LIS](https://creliohealth.com/in/lis/lis-system/laboratory-information-system) |
| **ABDM / India's EHR exchange direction** | FHIR implementation profiles define exchange structures, including diagnostic reports linked to patient and encounter context. National design emphasizes consent-mediated exchange across heterogeneous systems. | Source, facility, time and consent belong in the user-visible trust model. Integration should not imply every facility's records are synchronized. | Standards define exchange shapes, not local adoption or completeness. [ABDM FHIR IG](https://nrces.in/ndhm/fhir/r4/3.0.0/), [MoHFW EHR Standards](https://www.mohfw.gov.in/sites/default/files/EMR-EHR_Standards_for_India_as_notified_by_MOHFW_2016.pdf) |

### India-specific implications

- Patients may cross facilities with different local identifiers. A unified view must preserve
  source/facility, record date and identity-link state; it must not hide unresolved identity or
  consent issues.
- Clinic, hospital, lab, imaging and pharmacy software may be separate modules or products.
  SAARTHI should show source and freshness instead of implying all systems are synchronized.
- Mobile, multilingual and low-connectivity use appear explicitly in Indian products. For
  SAARTHI, first finish the clinician/coordinator desktop chart-review flow; keep family
  translation and bring-list support as a focused companion surface.

## International references

| System | Publicly documented workflow | Lesson for SAARTHI | Evidence limit |
|---|---|---|---|
| **Epic** | Storyboard gives access to the patient's story throughout the chart. Epic describes AI summaries, imaging follow-up identification, message context and documentation drafts. FHIR APIs support interoperability. | Persistent patient context and in-workflow summaries matter more than a standalone chatbot. Summaries should lead to deeper source inspection. | Vendor and health-system training material; local builds differ. [Iowa Storyboard guide](https://epicsupport.sites.uiowa.edu/epic-resources/storyboard), [Epic AI tools](https://www.epic.com/software/art/), [Epic FHIR](https://fhir.epic.com/) |
| **Oracle Health EHR (formerly Cerner)** | User documentation covers schedules, inbox, orders, patient panel, problems and a Life Timeline for history, problems and medications. Organizer, pre-visit and patient summaries link back to source data. | Build a selective pre-visit summary with “see more” and links to the underlying record. Preserve time range and as-of context. | Product documentation does not prove accuracy or measured benefit. [Oracle summaries](https://docs.oracle.com/en/industries/health/oracle-health-ehr/ehrfg/summaries.html), [Oracle timeline](https://docs.oracle.com/en/industries/health/oracle-health-ehr/ehrug/timeline.html), [Oracle guide](https://docs.oracle.com/en/industries/health/oracle-health-ehr/) |
| **MEDITECH Expanse** | Describes customizable physician workflows, chart reference panels, mobile tools, external-data summaries and search across structured/unstructured, scanned and legacy records. | Reduce chart retrieval work, let clinicians adapt high-frequency views, and preserve source context for outside records. | Vendor features and testimonials are not neutral outcome evaluations. [Expanse for Physicians](https://ehr.meditech.com/ehr-solutions/expanse-for-physicians), [Physician efficiency](https://home.meditech.com/en/d/mktcontent/otherfiles/physicianefficiencysinglepage.pdf) |
| **InterSystems TrakCare** | Describes a shared electronic patient record populated across clinical and administrative data. Inpatient management follows bed requests, movements, discharge progress, handovers and status. | The relevant dashboard differs for a ward manager and a clinician preparing an outpatient visit. | Vendor overview. [TrakCare overview](https://www.intersystems.com/reimagining-care-intersystems-trakcare.pdf), [Fact sheet](https://www.intersystems.com/it/trakcare-overview-fact-sheet/) |
| **Dedalus ORBIS / ORBIS U (Europe)** | Materials describe role-based workflows, patient chart/dashboard, orders/results/medication and departmental modules. | Specialty workflows belong inside a common record, but SAARTHI should borrow the separation of workspaces rather than the module count. | Vendor brochure/product page, no independent evaluation here. [ORBIS U](https://www.dedalus.com/uki/our-offer/products/orbis-u/), [Capabilities](https://www.dedalus.com/uki/wp-content/uploads/sites/7/2023/01/UK_Flyer_Orbis.pdf) |
| **Philips Tasy (Brazil and international)** | Philips describes integrated care management and a patient portal for appointments, consultation details and results. | Patient access and clinician operations are related but distinct surfaces. Give families a focused bring-list, not the full clinician chart by default. | Public overview, not hands-on assessment. [Philips Tasy](https://www.philips.com.br/a-w/about/news/archive/standard/news/press/2018/20180611-philips-presents-tasy-as-an-efficient-and-safe-technology-solution-for-the-management-of-integral-patient-care.html) |
| **OpenEMR (open source)** | Guides describe a provider calendar that opens a patient summary and past encounters/documents, appointment status indicators, recall/follow-up lists and configurable patient dashboard links. | A worklist should open directly into relevant patient/visit context; follow-up needs status, ownership and a return path. | Community documentation applies to specific versions/configurations. [Encounter workflow](https://www.open-emr.org/wiki/index.php/New_Encounters_%26_Coding), [Patient dashboard](https://www.open-emr.org/wiki/index.php/HOWTO%3A_Create_a_New_Patient_Record_-_OpenEMR_v7), [Calendar](https://www.open-emr.org/wiki/index.php/Using_the_Calendar) |
| **NHS England EPR / Single Patient Record direction** | NHS documentation describes EPRs for diagnoses, treatment, medication and results. The proposed Single Patient Record aims to connect records across care settings and remains in development. | Interoperability is a long-running system programme. Design for provenance and source systems instead of presenting a partial data lake as complete. | The future programme is not a shipped capability. [NHS EPR programme](https://www.england.nhs.uk/digitaltechnology/digitising-the-frontline/), [Single Patient Record](https://www.england.nhs.uk/digitaltechnology/the-single-patient-record/) |
| **Australia: clinical systems and My Health Record** | National documentation emphasizes documenting care, reviewing history, managing medications and securely sharing information; the shared record can contain pathology, imaging, prescriptions, immunisations and discharge summaries. | Interoperability standards should support ordinary clinical tasks and reliable terminology. Make source, timing and access controls visible. | National standards/shared-record material, not one EHR UI. [CIS standards](https://www.digitalhealth.gov.au/digital-health-standards/clinical-information-system-standards), [My Health Record](https://www.digitalhealth.gov.au/healthcare-providers/initiatives-and-programs/my-health-record) |

## Patterns that recur

1. **Landing screens are worklists, schedules or status boards.** They answer what needs attention
   next and open the right patient/encounter. Include visit/date, location, owner, state and next
   action—not only names.
2. **Patient context persists.** Identity, encounter, care team and selected time period stay
   clear while users inspect notes, results, medications and history.
3. **Summaries are selective and expandable.** Highlight recent/relevant information and link to
   the full record. Avoid a long wall of chart text.
4. **Events and source documents are distinct.** A lab value can be trended; a report can be
   opened; a derived value can be labeled as derived.
5. **Status comes with action and ownership.** Follow-up lists, inboxes and queues need an owner,
   visible progress and a closure path.
6. **Roles and locations shape views.** Clinician, nurse, coordinator, lab, front desk and family
   workflows need different priorities and permitted actions over a common record.
7. **Interoperability does not guarantee a complete chart.** Preserve facility, source,
   timestamps, missingness, conflicts, consent and feed freshness.
8. **Assistive AI is workflow-specific.** Search, summarize, draft and follow up recur. SAARTHI's
   citations and explicit conflict/missing states are more valuable than a generic chatbot style.

The reviewed public materials emphasize worklists, patient context, timelines, records, orders,
results and workflow-specific dashboards. They do not establish animated body maps as a core HIMS
pattern. Defer anatomy visualization unless a validated need and structured location data exist.

## What this means for SAARTHI

SAARTHI should not reproduce every module of these systems. They manage hospital operations,
including registration, encounters, orders, notes, medications, diagnostics and billing. SAARTHI's
narrower job is to help care teams prepare a cross-facility visit, reconcile records, identify
operational gaps and track coordination work.

Recommended clinician/coordinator information order:

1. **Worklist:** upcoming visit, facility, regimen/cycle where known, readiness summary, owner and
   leading operational blocker.
2. **Patient header:** identity/link state, care team, consent, current encounter and
   `known_as_of`.
3. **Attention summary:** pass/fail/conflicting/not-evaluated record checks, short reason and
   visible missingness. Clinical judgment remains with the practitioner.
4. **Timeline:** event time, source-recorded time and ingestion time; label derived values.
5. **Evidence:** open the exact source row or document span from each assertion/check. Keep answer
   and source visible together.
6. **Work tracking:** request/assign/escalate, owner/status, history and resolution evidence.
7. **Ask the record:** bounded questions with per-claim citations and Class A routing.

The family surface should stay smaller: upcoming visit, documented missing/pending items,
what to bring, language choice and a clear boundary to confirm with the care team. It should not
expose the clinician's full chart by default.

This follows the proposed sequence in the [completeness map](../../docs/project/COMPLETENESS-MAP.md):
worklist → patient orientation → source inspection → owned action → closure. Market references do
not replace implementation or usability sessions with clinicians, coordinators and navigators.

## Product direction options

| Direction | Meaning | Advantages | Cost/risk | Fit |
|---|---|---|---|---|
| **1. Full HIS/EHR imitation** | Add registration, orders, notes, medication, billing and departmental modules. | Broadly resembles incumbent products. | Massive scope; duplicates existing systems; delays proof of SAARTHI's core cross-facility evidence workflow. | Poor for this hackathon. |
| **2. Focused workflow copilot** | Make worklist, patient/visit context, readiness evidence, timeline and tracked task one complete flow. | Matches observed patterns and the product specification; can be demonstrated end to end. | Requires source traceability and task closure; breadth remains intentionally narrow. | **Recommended.** |
| **3. Patient/family portal first** | Prioritize mobile records, appointments, translations and bring-lists. | Directly serves patient access and continuity. | Does not solve clinician review or care-team ownership first; risks implying advice or communication functions not built. | Supporting surface after clinician workflow. |

## Research-informed priorities

1. Finish source-resolvable readiness checks: every status opens its actual input or explicitly
   says evidence is unavailable.
2. Make the **worklist → patient → source → task** journey complete, including loading/error
   states and task return/closure.
3. Add a pre-visit orientation summary only from supplied structured facts and verified
   assertions, with clickable sources and explicit conflicts/missingness.
4. Show facility, source, three clocks and refresh state wherever data may be stale or
   cross-facility. Do not claim integrations that are only designed.
5. Validate the workflow with representative users before adding an anatomy map, broad analytics
   or decorative medical renders. Measure whether users find the gap, verify its source and assign
   the next action correctly.

## Selected source index

- India: [NIC eHospital](https://www.nic.gov.in/project/ehospital/); [Bahmni](https://www.bahmni.org/);
  [DocPulse](https://docpulse.com/); [Practo Ray](https://www.practo.com/providers/clinics/ray);
  [HealthPlix](https://www.healthplix.com/); [MocDoc](https://mocdoc.com/india);
  [IQVIA HIS India](https://www.iqvia.com/locations/india/product/iqvia-hospital-information-system);
  [CrelioHealth](https://creliohealth.com/solutions/radiology/).
- International: [Epic](https://www.epic.com/software/art/); [Oracle Health](https://docs.oracle.com/en/industries/health/oracle-health-ehr/);
  [MEDITECH](https://ehr.meditech.com/ehr-solutions/expanse-for-physicians);
  [InterSystems TrakCare](https://www.intersystems.com/reimagining-care-intersystems-trakcare.pdf);
  [Dedalus ORBIS U](https://www.dedalus.com/uki/our-offer/products/orbis-u/);
  [Philips Tasy](https://www.philips.com.br/a-w/about/news/archive/standard/news/press/2018/20180611-philips-presents-tasy-as-an-efficient-and-safe-technology-solution-for-the-management-of-integral-patient-care.html);
  [OpenEMR](https://www.open-emr.org/wiki/index.php/New_Encounters_%26_Coding);
  [NHS England EPR](https://www.england.nhs.uk/digitaltechnology/digitising-the-frontline/);
  [Australian Digital Health Agency](https://www.digitalhealth.gov.au/digital-health-standards/clinical-information-system-standards).
- Standards: [ABDM FHIR Guide](https://nrces.in/ndhm/fhir/r4/3.0.0/); [India EHR Standards](https://www.mohfw.gov.in/sites/default/files/EMR-EHR_Standards_for_India_as_notified_by_MOHFW_2016.pdf).
- Existing research: [clinical UX evidence](design/clinical-ux-evidence.md),
  [PS-04 competitor field report](clinical/ps04-competitive-landscape.md),
  [SAARTHI completeness map](../../docs/project/COMPLETENESS-MAP.md).
