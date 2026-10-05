import os
from pathlib import Path
import subprocess


def test_preflight_when_pre_ai_install_does_not_require_host_urls(tmp_path: Path) -> None:
    runner = tmp_path / 'python'
    runner.write_text('#!/bin/sh\nprintf "%s\\n" "$*"\n')
    runner.chmod(0o700)
    env = {key: value for key, value in os.environ.items() if not key.startswith('SAARTHI_')}
    env['SAARTHI_PYTHON'] = str(runner)
    result = subprocess.run(['bash', 'backend/scripts/preflight_and_deploy.sh',
                             'install-pre-ai'], env=env, capture_output=True, text=True)
    assert result.returncode == 0 and 'install_clean_account --pre-ai' in result.stdout
