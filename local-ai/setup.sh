#!/bin/sh
set -eu

if ! command -v ollama >/dev/null 2>&1; then
  printf '%s\n' 'Ollama is not installed. Install it from https://ollama.com/download, then rerun this script.'
  exit 1
fi

if ! ollama list >/dev/null 2>&1; then
  printf '%s\n' 'Start the Ollama app, then rerun this script.'
  exit 1
fi

ollama pull qwen2.5:3b
ollama create patient360-qwen2.5:3b -f local-ai/Modelfile
printf '%s\n' 'Local model is ready. Add the local settings from local-ai/.env.example to web/.env.local.'
