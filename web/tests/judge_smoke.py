"""Synthetic Judge UI smoke test against a running local build.

Requires Playwright and an installed Chromium browser. Override
PLAYWRIGHT_CHROMIUM_EXECUTABLE when using a preinstalled binary.
No Snowflake access occurs: probe responses are intercepted fixtures.
"""
import json
import os

from playwright.sync_api import sync_playwright


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE'),
        )
        try:
            page = browser.new_page(viewport={'width': 1280, 'height': 900})
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))

            def probe(route):
                number = route.request.post_data_json['probe']
                route.fulfill(json={
                    'probe': number, 'title': 'Synthetic probe', 'description': 'Browser smoke fixture',
                    'sql': 'SELECT 0', 'expect': 'Synthetic expectation',
                    'passed': None if number == 6 else True,
                    'rowCount': 1, 'rows': [{'COUNT': 0}], 'query_id': 'SYNTHETIC-QUERY-ID',
                })

            page.route('**/api/judge', probe)
            page.goto(os.environ.get('SAARTHI_TEST_URL', 'http://127.0.0.1:3100') + '/judge')
            page.wait_for_load_state('networkidle')
            page.get_by_role('button', name='Run all 8 probes').click()
            page.get_by_text('7 of 7 passing', exact=True).wait_for()
            page.get_by_text('INFORMATION · Probe 6', exact=True).wait_for()
            page.get_by_text('Query: SYNTHETIC-QUERY-ID', exact=True).nth(7).wait_for()
            page.set_viewport_size({'width': 640, 'height': 900})
            assert page.get_by_role('button', name='Run all 8 probes').is_visible()
            assert not errors, errors
            print(json.dumps({'judge_smoke': 'passed', 'fixture_probes': 8, 'browser_errors': errors}))
        finally:
            browser.close()


if __name__ == '__main__':
    main()
