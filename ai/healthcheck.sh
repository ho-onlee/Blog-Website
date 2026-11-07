#!/bin/sh
set -eu

OLLAMA_HOST=127.0.0.1:11434 ollama list | grep -F -- "${AI_MODEL:?Set AI_MODEL}" >/dev/null