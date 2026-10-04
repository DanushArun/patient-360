"""No credentials or network; exercises the real LangExtract arm and direct arm."""
import importlib.util
import json
import unittest
from unittest.mock import patch
from pypdf import PdfReader

from backend.extraction.contract import InvalidExtraction, SourcePage

HAS_LANGEXTRACT = importlib.util.find_spec('langextract') is not None


@unittest.skipUnless(HAS_LANGEXTRACT, 'isolated LangExtract trial environment required')
class LiveTrialTests(unittest.TestCase):
    def setUp(self):
        for target in ('socket.socket.connect', 'socket.getaddrinfo'):
            guard=patch(target,side_effect=AssertionError('network_forbidden'))
            guard.start();self.addCleanup(guard.stop)
        from backend.extraction.live_trial import ROOT
        text=PdfReader(ROOT/'data/generated/pdf/EVT-HER2-SURGICAL').pages[0].extract_text()
        self.page=SourcePage('PAT-DEEP-0001','DOC-E2E-HER2-SURGICAL-01',0,text,'SPEC-SURGICAL-001')

    def response(self):
        extractions=[]
        for concept,value,quote in [('histological_grade','III','Grade: III'),('HER2_IHC','2+','HER2 IHC: 2+')]:
            extractions.append({'finding':quote,'finding_attributes':{
                'concept':concept,'value':value,'unit':None,'negation':False,
                'missingness_state':'present','specimen_id':'SPEC-SURGICAL-001'}})
        return {'choices':[{'finish_reason':'stop','message':{'content':json.dumps({'extractions':extractions})}}],
                'usage':{'prompt_tokens':700,'completion_tokens':100}}

    def test_one_page_four_call_comparison_never_writes_and_reports_exact_source(self):
        from backend.extraction.live_trial import run_comparison
        sent=[]
        def complete(payload):
            sent.append(payload)
            return self.response()
        def accept(plan):
            self.assertEqual(len(plan),4)
            self.assertEqual([p['model'] for p in plan],['llama3.3-70b','claude-haiku-4-5']*2)
            self.assertEqual(plan[0]['messages'],plan[1]['messages'])
            self.assertEqual(plan[2]['messages'],plan[3]['messages'])
            return {'plannedCalls':4}
        report=run_comparison(self.page,complete,accept)
        self.assertEqual(len(sent),4)
        self.assertEqual(report['status'],'completed_sample')
        self.assertEqual([arm['verified_findings'] for arm in report['arms']],[2,2])
        self.assertEqual([score['correct_with_exact_evidence'] for arm in report['arms'] for score in arm['read_scores']],[2,2,2,2])
        self.assertEqual([p['model'] for p in sent],['llama3.3-70b','claude-haiku-4-5']*2)

    def test_bad_second_read_fails_without_claiming_four_calls_complete(self):
        from backend.extraction.live_trial import run_comparison
        calls=[]
        def complete(payload):
            calls.append(payload)
            return {'choices':[{'finish_reason':'length','message':{'content':'{}'}}]} if len(calls)==2 else self.response()
        with self.assertRaises(InvalidExtraction):
            run_comparison(self.page,complete,lambda plan:{'plannedCalls':4})
        self.assertEqual(len(calls),2)

    def test_changed_source_passage_stops_before_plan(self):
        from backend.extraction.live_trial import run_comparison
        page=SourcePage(self.page.patient_id,self.page.doc_id,0,self.page.text.replace('HER2 IHC: 2+','HER2 IHC: 3+'),self.page.specimen_id)
        with self.assertRaisesRegex(InvalidExtraction,'fixture_passage_changed'):
            run_comparison(page,lambda payload:self.response(),lambda plan:None)


if __name__=='__main__': unittest.main()
