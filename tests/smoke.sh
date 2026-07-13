#!/bin/sh
# tests/smoke.sh: end-to-end check of recap.py against a synthetic config dir.
#
# Builds a fake CLAUDE_CONFIG_DIR containing one history.jsonl entry plus the
# matching transcript, then asserts that `recap.py --json` reports exactly one
# session with the right project path, branch and model. Also asserts that a
# missing projects directory produces a clear message instead of a traceback.
#
# No network, no writes outside the temp dir, no dependency on a real ~/.claude.

set -eu

ROOT="$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)"
RECAP="$ROOT/skills/recap/recap.py"

TMP="$(mktemp -d 2>/dev/null || mktemp -d -t recap-smoke)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT HUP INT TERM

fail() {
  printf 'smoke: FAIL: %s\n' "$1" >&2
  exit 1
}

SID="11111111-2222-3333-4444-555555555555"
PROJECT="$TMP/workspace/demo-project"
CONFIG="$TMP/claude"
ENC="-$(printf '%s' "${PROJECT#/}" | tr '/.' '--')"

mkdir -p "$PROJECT" "$CONFIG/projects/$ENC"

# history.jsonl uses epoch milliseconds; keep it recent so no filter drops it.
NOW_MS="$(python3 -c 'import time; print(int(time.time() * 1000))')"
NOW_ISO="$(python3 -c 'import datetime; print(datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"))')"

python3 - "$CONFIG" "$ENC" "$SID" "$PROJECT" "$NOW_MS" "$NOW_ISO" <<'PY'
import json, os, sys

config, enc, sid, project, now_ms, now_iso = sys.argv[1:7]
now_ms = int(now_ms)

with open(os.path.join(config, "history.jsonl"), "w", encoding="utf-8") as fh:
    fh.write(json.dumps({
        "display": "wire up the parser and fix the failing test",
        "timestamp": now_ms,
        "project": project,
        "sessionId": sid,
    }) + "\n")
    fh.write("{ this line is broken json and must be skipped\n")

transcript = os.path.join(config, "projects", enc, sid + ".jsonl")
with open(transcript, "w", encoding="utf-8") as fh:
    for row in [
        {"type": "user", "cwd": project, "gitBranch": "feature/parser",
         "timestamp": now_iso, "sessionId": sid,
         "message": {"role": "user", "content": "wire up the parser and fix the failing test"}},
        {"type": "assistant", "cwd": project, "gitBranch": "feature/parser",
         "timestamp": now_iso, "sessionId": sid,
         "message": {"id": "msg_abc123", "role": "assistant",
                     "model": "claude-opus-4-8", "content": [{"type": "text", "text": "on it"}]}},
        {"type": "ai-title", "timestamp": now_iso, "aiTitle": "Parser wiring and test fix"},
    ]:
        fh.write(json.dumps(row) + "\n")
PY

# ---------- 1. one synthetic session is listed ----------
OUT="$TMP/out.json"
CLAUDE_CONFIG_DIR="$CONFIG" python3 "$RECAP" --json --limit 5 >"$OUT" ||
  fail "recap.py --json exited nonzero"

CLAUDE_CONFIG_DIR="$CONFIG" python3 - "$OUT" "$SID" "$PROJECT" <<'PY' || exit 1
import json, sys

out, sid, project = sys.argv[1:4]
data = json.load(open(out, encoding="utf-8"))

def check(cond, msg):
    if not cond:
        print(f"smoke: FAIL: {msg}", file=sys.stderr)
        print(json.dumps(data, indent=2), file=sys.stderr)
        raise SystemExit(1)

check(isinstance(data, list), "--json did not return a list")
check(len(data) == 1, f"expected 1 session, got {len(data)}")
s = data[0]
check(s["sessionId"] == sid, f"wrong sessionId: {s['sessionId']}")
check(s["projectPath"] == project, f"wrong projectPath: {s['projectPath']}")
check(s["summary"] == "Parser wiring and test fix", f"wrong summary: {s['summary']}")
check(s["branch"] == "feature/parser", f"wrong branch: {s['branch']}")
check(s["model"] == "opus-4.8", f"wrong model: {s['model']}")
check(s["turns"] == 2, f"wrong turn count: {s['turns']}")
check(s["resume"] == f"cd {project} && claude -r {sid}", f"wrong resume: {s['resume']}")
print("smoke: ok: one session listed with the expected fields")
PY

# ---------- 2. the human-readable table renders ----------
CLAUDE_CONFIG_DIR="$CONFIG" python3 "$RECAP" --plain --limit 5 >"$TMP/table.txt" ||
  fail "recap.py (table) exited nonzero"
grep -q "Parser wiring and test fix" "$TMP/table.txt" ||
  fail "table output is missing the session summary"
printf 'smoke: ok: table output renders\n'

# ---------- 3. a missing projects dir fails cleanly, without a traceback ----------
EMPTY="$TMP/empty"
mkdir -p "$EMPTY"
if CLAUDE_CONFIG_DIR="$EMPTY" python3 "$RECAP" --json >"$TMP/empty.out" 2>"$TMP/empty.err"; then
  fail "recap.py should exit nonzero when the projects dir is missing"
fi
grep -q "Traceback" "$TMP/empty.err" && fail "recap.py printed a traceback for a missing projects dir"
grep -q "not found" "$TMP/empty.err" ||
  fail "recap.py did not print a clear message for a missing projects dir"
printf 'smoke: ok: missing projects dir reports a clear error\n'

# ---------- 4. --open --dry-run opens nothing and prints the resume command ----------
CLAUDE_CONFIG_DIR="$CONFIG" python3 "$RECAP" --plain --open --dry-run --yes >"$TMP/dry.txt" ||
  fail "recap.py --open --dry-run exited nonzero"
grep -q "claude -r $SID" "$TMP/dry.txt" ||
  fail "--open --dry-run did not print the resume command"
printf 'smoke: ok: --open --dry-run is side-effect free\n'

printf '\nsmoke: PASS\n'
