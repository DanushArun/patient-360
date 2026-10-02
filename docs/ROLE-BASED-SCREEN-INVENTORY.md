# SAARTHI — Role-based screen inventory

This inventory follows `DESIGNER-BRIEF.md`, `PROJECT-OVERVIEW.md`, the existing Next.js
interface and the supplied captures. It deliberately excludes the Judge Console and every
Judge-only route, control and probe.

## Coordinator

| Screen | Navigation | Primary work | Required states |
| --- | --- | --- | --- |
| Day-care list | `Day-care list` | Find an accessible scheduled patient; inspect readiness headline; open the record | loading timestamp, search/no matches, no visits, census failure, accessible-patient picker |
| Patient record | row `Open`, patient picker | Orient to identity, consent, visit, regimen and readiness; inspect evidence; file a permitted review task; ask a bounded record question | stored snapshot/live refresh, selected gate, no readiness, live-refresh failure, answer pending/success/error/refusal |
| Review queue | `Review queue` | Prioritise open issues by visit urgency, see unowned work, filter, acknowledge or resolve in the workflow preview | filter results, no matches, unowned state, local acknowledgement/resolution feedback |
| Review + history | Patient record → `Review history` | View a selected readiness result beside task lifecycle and audit limitation | task loading, no filed task, task-service error, access denied |

## Oncologist

| Screen | Navigation | Primary work |
| --- | --- | --- |
| Patient record | Day-care list or patient picker | Two-minute orientation: patient/consent/visit first, then readiness, timeline and record questions; clinical-go/no-go questions remain referred to the treating team |

The oncologist uses the shared patient record rather than a parallel dashboard. This prevents
two clinical sources of truth and keeps evidence alongside the exact readiness claim.

## Navigator

| Screen | Navigation | Primary work | Required states |
| --- | --- | --- | --- |
| Navigator view | Patient record → `Navigator View` | Prepare the family in the selected language, review draft translations, copy the message and see eligible scheme information | no upcoming visit, loading/no scheme eligibility, copy success/fallback, unreviewed/reviewed draft |

The Navigator view intentionally omits the full clinical record link. It shows only the
documented preparation checklist, visit context, scheme information and the standing
"treating team decides" notice.

## Navigation structure

```text
SAARTHI
├── Day-care list
│   └── Patient record
│       ├── Ask the record
│       ├── Record timeline
│       ├── Family checklist
│       ├── Navigator view
│       └── Review history
└── Review queue
    └── Patient record
```

## Design patterns informing the implementation

- NHS patterns distinguish task lists from summary lists. SAARTHI uses the day-care list
  and review queue as operational task lists, while patient/visit/consent facts are compact
  labelled fields rather than dashboard metrics. This makes ownership and next action
  scannable without hiding evidence.
- NHS guidance says staff-facing patient-record tabs can work when users need fast switching
  between related information. The three existing patient modes are retained, with the
  evidence panel persistent so citations stay visible beside the selected claim.
- AHRQ's clinical decision-support guidance recommends patient-specific, clear and
  workflow-aligned information, with interruptiveness proportionate to severity. SAARTHI
  therefore uses quiet, rule-specific rows rather than alert banners, and makes the SQL
  outcome/reason/evidence path explicit without recommending a clinical decision.
- Status remains glyph + word + border treatment throughout; colour adds reinforcement only.
  This preserves the project design-system requirement and supports greyscale/cognitive
  scanning of pass, fail, conflicting and not-evaluated states.

The supplied app captures remain the visual foundation: Inter, thin rules, restrained
surfaces, tabular numerals, flat controls and the calm white/sunken-grey evidence layout are
preserved rather than replaced with a generic health-dashboard aesthetic.
