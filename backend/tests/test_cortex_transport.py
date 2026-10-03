import io
import json
import unittest
from unittest.mock import patch
from backend.extraction.cortex_transport import CortexTransport, _NoRedirect
from backend.extraction.contract import InvalidExtraction


class Response(io.BytesIO):
    status = 200


class FakeOpener:
    def __init__(self, raw=b'{"choices": []}', error=None):
        self.raw, self.error, self.requests = raw, error, []

    def open(self, request, timeout):
        self.requests.append((request,timeout))
        if self.error:
            raise self.error
        return Response(self.raw)


class CortexTransportTests(unittest.TestCase):
    def setUp(self):
        for target in ("socket.socket.connect", "socket.getaddrinfo"):
            guard=patch(target,side_effect=AssertionError("network_forbidden"))
            guard.start()
            self.addCleanup(guard.stop)
        self.payload={"model":"llama3.3-70b","messages":[{"role":"user","content":"synthetic text"}],
                      "temperature":0,"max_completion_tokens":1800,"stream":False}

    def transport(self, **kwargs):
        return CortexTransport("OHCXVXM-OS69400", token_provider=lambda:"test-token",
                               authorise=kwargs.pop("authorise",lambda:True), **kwargs)

    def test_defaults_off_without_reading_credentials(self):
        with self.assertRaisesRegex(InvalidExtraction,"live_access_disabled"):
            self.transport()(self.payload)

    def test_mock_request_is_snowflake_only_bounded_and_uses_server_token(self):
        fake=FakeOpener()
        self.transport(live_enabled=True,opener=fake)(self.payload)
        request,timeout=fake.requests[0]
        self.assertEqual(request.full_url,"https://ohcxvxm-os69400.snowflakecomputing.com/api/v2/cortex/v1/chat/completions")
        self.assertEqual(request.get_header("Authorization"),"Bearer test-token")
        self.assertEqual(timeout,30)
        self.assertEqual(json.loads(request.data),self.payload)

    def test_scope_is_rechecked_on_each_request(self):
        fake=FakeOpener()
        decisions=iter([True,False])
        transport=self.transport(live_enabled=True,opener=fake,authorise=lambda:next(decisions))
        transport(self.payload)
        with self.assertRaisesRegex(InvalidExtraction,"cortex_request_failed"):
            transport(self.payload)
        self.assertEqual(len(fake.requests),1)

    def test_timeout_consumes_budget_and_does_not_retry_or_leak(self):
        fake=FakeOpener(error=TimeoutError("private token and source"))
        transport=self.transport(live_enabled=True,opener=fake,max_requests=1)
        with self.assertRaisesRegex(InvalidExtraction,"^cortex_request_failed$"):
            transport(self.payload)
        with self.assertRaisesRegex(InvalidExtraction,"transport_budget_exhausted"):
            transport(self.payload)
        self.assertEqual(len(fake.requests),1)

    def test_arbitrary_urls_accounts_and_unbounded_requests_rejected(self):
        for account in ("https://example.com", "x/y", "x@evil.test", "x?y", ""):
            with self.assertRaises(InvalidExtraction):
                CortexTransport(account,token_provider=lambda:"t",authorise=lambda:True)
        for patch in ({"model":"auto"},{"stream":True},{"max_completion_tokens":1801},{"temperature":1}):
            with self.assertRaises(InvalidExtraction):
                self.transport(live_enabled=True,opener=FakeOpener())({**self.payload,**patch})

    def test_oversized_and_invalid_json_responses_rejected(self):
        for raw in (b"x"*65537,b"not json",b"[]"):
            with self.assertRaisesRegex(InvalidExtraction,"cortex_request_failed"):
                self.transport(live_enabled=True,opener=FakeOpener(raw))(self.payload)

    def test_redirect_is_never_followed_with_a_bearer_token(self):
        with self.assertRaisesRegex(InvalidExtraction,"redirect_forbidden"):
            _NoRedirect().redirect_request(None,None,302,"",{},"https://example.com")


if __name__ == "__main__":
    unittest.main()
