"""Round 4 offline contracts: single Snowflake provider, N4-03 policy argument, N4-04 UI state."""
import re
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WEB = REPO / "frontend"


class Round4(unittest.TestCase):
    def test_local_ai_code_is_gone_and_snowflake_is_the_only_provider(self):
        self.assertFalse((REPO / "local-ai").exists())
        self.assertFalse(list((WEB / "lib").glob("local-ai*")))
        self.assertFalse((WEB / "LOCAL-AI-PARITY.md").exists())
        for rel in ("lib/patient.ts", "package.json", "README.md", "app/api/ask/route.ts"):
            text = (WEB / rel).read_text()
            self.assertNotRegex(text, r"(?i)local-ai|ollama|SAARTHI_LLM_PROVIDER|askLocalModel")
        self.assertIn("ASK_SAARTHI", (WEB / "lib/patient.ts").read_text())

    def test_policy_body_has_no_unqualified_argument_name_collision(self):
        body = re.sub(r"(?m)^\s*--.*$", "", (REPO / "backend/sql/governance/01_policies.sql").read_text())
        policy = body[body.index("ROW ACCESS POLICY"):body.index("TAG SAARTHI")]
        self.assertNotRegex(policy, r"AS \(doc_id ")
        self.assertNotRegex(policy, r"=\s*doc_id\b(?!\s*\w)")

    def test_present_without_value_is_never_a_bare_present(self):
        text = (WEB / "lib/workspace-patient-facts.mjs").read_text()
        self.assertIn("no value recorded", text)
        for rel in ("components/workspace-patient-facts.tsx", "components/evidence-packet-preview.tsx",
                    "app/patient/[id]/patient-timeline.tsx"):
            self.assertIn("factStateDisplay(", (WEB / rel).read_text(), rel)


if __name__ == "__main__":
    unittest.main()
