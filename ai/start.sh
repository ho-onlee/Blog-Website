#!/bin/sh
set -eu

: "${AI_MODEL:?Set AI_MODEL to the Ollama model to download}"
ollama serve &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' INT TERM

until OLLAMA_HOST=127.0.0.1:11434 ollama list >/dev/null 2>&1; do
	if ! kill -0 "$server_pid" 2>/dev/null; then
		wait "$server_pid"
		exit 1
	fi
	sleep 2
done

OLLAMA_HOST=127.0.0.1:11434 ollama pull "$AI_MODEL"
wait "$server_pid"