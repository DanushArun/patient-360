"""Opt-in server-side Cortex transport. Not wired to application or deployment.

Construction performs no I/O. Live access defaults off; callers must provide
an approved account, a server-side token provider and current-scope authoriser.
Never use a browser token or substitute a cached consent flag for that check.
"""
import json
import re
import ssl
import urllib.request

from .contract import InvalidExtraction, MODEL_FAMILIES


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise InvalidExtraction("redirect_forbidden")


class CortexTransport:
    def __init__(self, account, *, token_provider, authorise, live_enabled=False,
                 max_requests=2, opener=None):
        if not isinstance(account, str) or not re.fullmatch(r"[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*", account):
            raise InvalidExtraction("invalid_account_identifier")
        if not callable(token_provider) or not callable(authorise):
            raise InvalidExtraction("server_authentication_required")
        if type(max_requests) is not int or not 1 <= max_requests <= 4:
            raise InvalidExtraction("invalid_call_budget")
        self.url = f"https://{account.lower()}.snowflakecomputing.com/api/v2/cortex/v1/chat/completions"
        self._token_provider = token_provider
        self._authorise = authorise
        self._opener = opener
        self._enabled = live_enabled is True
        self._max_requests = max_requests
        self.attempts = 0

    def __call__(self, payload):
        if not self._enabled:
            raise InvalidExtraction("live_access_disabled")
        if self.attempts >= self._max_requests:
            raise InvalidExtraction("transport_budget_exhausted")
        if (not isinstance(payload, dict) or set(payload) != {
                "model", "messages", "temperature", "max_completion_tokens", "stream"}
                or payload.get("model") not in MODEL_FAMILIES
                or payload.get("temperature") != 0 or payload.get("stream") is not False
                or type(payload.get("max_completion_tokens")) is not int
                or not 1 <= payload["max_completion_tokens"] <= 1800):
            raise InvalidExtraction("invalid_request_contract")
        messages = payload["messages"]
        if (not isinstance(messages, list) or len(messages) != 1
                or not isinstance(messages[0], dict) or set(messages[0]) != {"role", "content"}
                or messages[0]["role"] != "user" or not isinstance(messages[0]["content"], str)
                or not 0 < len(messages[0]["content"]) <= 24000):
            raise InvalidExtraction("invalid_request_messages")
        try:
            # Must revalidate the bound patient's care team and current consent.
            # This hook is a required integration boundary, not an implementation
            # of the project's Snowflake access procedures.
            if self._authorise() is not True:
                raise InvalidExtraction("access_denied")
            token = self._token_provider()
            if not isinstance(token, str) or not token or any(c.isspace() for c in token):
                raise InvalidExtraction("invalid_token")
            request = urllib.request.Request(self.url, data=json.dumps(payload).encode(),
                headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
                method="POST")
            opener = self._opener or urllib.request.build_opener(
                _NoRedirect(), urllib.request.HTTPSHandler(context=ssl.create_default_context()))
            self.attempts += 1  # Failures consume budget; no retry or fallback.
            with opener.open(request, timeout=30) as response:
                raw = response.read(65537)
                if response.status != 200 or len(raw)>65536:
                    raise InvalidExtraction("invalid_response")
            parsed = json.loads(raw)
            if not isinstance(parsed, dict):
                raise InvalidExtraction("invalid_response")
            return parsed
        except Exception:
            # Do not propagate a URL, source text, credentials or raw server body.
            raise InvalidExtraction("cortex_request_failed") from None
