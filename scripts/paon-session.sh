#!/usr/bin/env bash
# Own the PAON foreground runner inside one detachable macOS screen session.

set -euo pipefail

ACTION="${1:-}"
if [ "$#" -gt 0 ]; then
  shift
fi
PROVIDER="${PAON_RUNNER_PROVIDER:-codex}"
SESSION_NAME="${PAON_RUNNER_SESSION_NAME:-paon-frontier}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --) shift ;;
    --provider)
      if [ "$#" -lt 2 ]; then
        echo "Missing value for --provider" >&2
        exit 64
      fi
      PROVIDER="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 64
      ;;
  esac
done

case "$PROVIDER" in
  codex | claude) ;;
  *)
    echo "Unknown provider '$PROVIDER'. Use codex or claude." >&2
    exit 64
    ;;
esac

case "$SESSION_NAME" in
  *[!A-Za-z0-9._-]* | '')
    echo "Invalid PAON_RUNNER_SESSION_NAME." >&2
    exit 64
    ;;
esac

if ! command -v screen >/dev/null 2>&1; then
  echo "The macOS screen command is missing." >&2
  exit 69
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$REPO_ROOT" ]; then
  echo "Run this command inside the PAON Git repository." >&2
  exit 69
fi

session_exists() {
  screen -ls 2>/dev/null | grep -Eq "[0-9]+[.]${SESSION_NAME}[[:space:]]"
}

case "$ACTION" in
  start)
    if session_exists; then
      echo "PAON unattended session is already running: $SESSION_NAME"
      exit 0
    fi

    bash "$REPO_ROOT/scripts/paon-run.sh" --provider "$PROVIDER" --dry-run >/dev/null
    screen -DmS "$SESSION_NAME" /usr/bin/env bash -c \
      'cd "$1" && exec bash scripts/paon-run.sh --provider "$2"' \
      _ "$REPO_ROOT" "$PROVIDER"

    attempt=0
    while [ "$attempt" -lt 20 ]; do
      if session_exists; then
        echo "PAON unattended session started."
        echo "Provider: $PROVIDER"
        echo "Session: $SESSION_NAME"
        echo "Inspect: screen -r $SESSION_NAME"
        echo "Stop: pnpm paon:stop"
        exit 0
      fi
      attempt=$((attempt + 1))
      sleep 0.25
    done

    echo "PAON unattended session failed to stay running." >&2
    exit 1
    ;;
  status)
    if session_exists; then
      echo "PAON unattended session is running: $SESSION_NAME"
      exit 0
    fi
    echo "PAON unattended session is not running."
    exit 1
    ;;
  stop)
    if ! session_exists; then
      echo "PAON unattended session is already stopped."
      exit 0
    fi

    screen -S "$SESSION_NAME" -p 0 -X stuff $'\003' || true
    attempt=0
    while [ "$attempt" -lt 20 ]; do
      if ! session_exists; then
        echo "PAON unattended session stopped."
        exit 0
      fi
      attempt=$((attempt + 1))
      sleep 0.25
    done

    screen -S "$SESSION_NAME" -X quit || true
    echo "PAON unattended session stopped."
    ;;
  *)
    echo "Usage: pnpm paon:start -- [--provider codex|claude] | pnpm paon:status | pnpm paon:stop" >&2
    exit 64
    ;;
esac
