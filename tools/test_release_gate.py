import unittest
import json
from pathlib import Path
from tempfile import TemporaryDirectory

from tools.release_gate import ROOT, REQUIRED_IDS, acceptance_failures, read_packet


def complete_packet(evidence: object) -> dict[str, object]:
    return {"account": "KGTPGHJ-YJ28449", "acceptance": "accepted", "requirements": [
        {"id": item, "status": "passed", "parent_reviewed": True, "evidence": evidence}
        for item in sorted(REQUIRED_IDS)
    ]}


class AcceptanceGateTests(unittest.TestCase):
    def test_duplicate_acceptance_when_parsed_rejects_ambiguous_record(self) -> None:
        content = json.dumps(complete_packet(["tools/test_release_gate.py"]))
        content = content.replace('"acceptance": "accepted"',
                                  '"acceptance": "incomplete", "acceptance": "accepted"')
        with TemporaryDirectory() as directory:
            path = Path(directory) / "record.json"
            path.write_text(content)
            with self.assertRaisesRegex(ValueError, "duplicate JSON key: acceptance"):
                read_packet(path)

    def test_duplicate_status_when_parsed_rejects_hidden_pending_requirement(self) -> None:
        content = '{"status": "pending", "status": "passed"}'
        with TemporaryDirectory() as directory:
            path = Path(directory) / "record.json"
            path.write_text(content)
            with self.assertRaisesRegex(ValueError, "duplicate JSON key: status"):
                read_packet(path)

    def test_complete_record_when_repo_evidence_exists_passes(self) -> None:
        self.assertEqual(acceptance_failures(complete_packet(["tools/test_release_gate.py"])), [])

    def test_absolute_evidence_when_checked_blocks_acceptance(self) -> None:
        self.assertTrue(acceptance_failures(complete_packet(["/etc/hosts"])))

    def test_traversal_evidence_when_checked_blocks_acceptance(self) -> None:
        self.assertTrue(acceptance_failures(complete_packet(["../../../../etc/hosts"])))

    def test_symlink_outside_repo_when_checked_blocks_acceptance(self) -> None:
        with TemporaryDirectory(dir=ROOT) as directory:
            link = Path(directory) / "evidence"
            link.symlink_to("/etc/hosts")
            result = acceptance_failures(complete_packet([str(link.relative_to(ROOT))]))
        self.assertTrue(result)

    def test_string_evidence_when_checked_blocks_acceptance(self) -> None:
        self.assertTrue(acceptance_failures(complete_packet("tools/test_release_gate.py")))

    def test_non_object_packet_when_checked_reports_failure(self) -> None:
        self.assertEqual(acceptance_failures([]), ["packet must be an object"])

    def test_non_list_requirements_when_checked_reports_failure(self) -> None:
        self.assertIn("requirements must be a list", acceptance_failures({
            "account": "KGTPGHJ-YJ28449", "requirements": {"S01": "passed"}
        }))

    def test_malformed_requirement_when_checked_reports_failure(self) -> None:
        self.assertIn("requirement must be an object with a string ID", acceptance_failures({
            "account": "KGTPGHJ-YJ28449", "requirements": [None]
        }))

    def test_duplicate_requirement_when_checked_blocks_acceptance(self) -> None:
        packet = complete_packet(["tools/test_release_gate.py"])
        packet["requirements"].append(packet["requirements"][0])
        self.assertIn("duplicate requirement IDs", acceptance_failures(packet))

    def test_incomplete_parent_acceptance_when_checks_pass_blocks_acceptance(self) -> None:
        packet = complete_packet(["tools/test_release_gate.py"])
        packet["acceptance"] = "incomplete"
        self.assertIn("parent acceptance required", acceptance_failures(packet))

    def test_missing_parent_acceptance_when_checks_pass_blocks_acceptance(self) -> None:
        packet = complete_packet(["tools/test_release_gate.py"])
        del packet["acceptance"]
        self.assertIn("parent acceptance required", acceptance_failures(packet))

    def test_pending_requirement_when_checked_blocks_acceptance(self) -> None:
        packet = {"account": "KGTPGHJ-YJ28449", "requirements": [{"id": "S01"}]}
        self.assertIn("S01: pending", acceptance_failures(packet))

    def test_pass_without_evidence_when_checked_blocks_acceptance(self) -> None:
        packet = {"account": "KGTPGHJ-YJ28449", "requirements": [
            {"id": "S01", "status": "passed", "parent_reviewed": True}
        ]}
        self.assertIn("S01: missing evidence", acceptance_failures(packet))

    def test_author_approval_when_checked_blocks_acceptance(self) -> None:
        packet = {"account": "KGTPGHJ-YJ28449", "requirements": [
            {"id": "S01", "status": "passed", "evidence": ["captured journey"]}
        ]}
        self.assertIn("S01: parent review required", acceptance_failures(packet))

    def test_wrong_account_when_checked_blocks_acceptance(self) -> None:
        self.assertIn("account mismatch", acceptance_failures({"account": "OS69400"}))

    def test_empty_requirements_when_checked_blocks_acceptance(self) -> None:
        self.assertIn("requirements missing", acceptance_failures({
            "account": "KGTPGHJ-YJ28449", "requirements": []
        }))


if __name__ == "__main__":
    unittest.main()
