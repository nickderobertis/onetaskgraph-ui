#!/usr/bin/env bash
# What npm serves right now for the one artifact this repository publishes.
#
#   usage: release-probe.sh npm:@onetaskgraph/ui
#
# Three answers, and keeping the last two apart is the whole point:
#   * exit 0 with one line on stdout: the version npm serves now;
#   * exit 0 with nothing on stdout: npm says it has no release of it (a 404);
#   * non-zero with the reason on stderr: not answered. Exit 2 is a usage error.
#
# A consumer holds on "not answered" and stops holding on "no release", so a failed lookup is
# never reported as an empty answer. A probe rules on nothing and refuses no publication.
#
# ONETASKGRAPH_UI_PROBE_REGISTRY replaces the registry's origin, for the suite's local server.
set -euo pipefail

readonly TARGET="npm:@onetaskgraph/ui"
readonly REGISTRY="${ONETASKGRAPH_UI_PROBE_REGISTRY:-https://registry.npmjs.org}"

refuse() {
  printf 'release-probe: %s\n' "$1" >&2
  exit "${2:-1}"
}

[ "$#" -eq 1 ] || refuse "takes exactly one identifier; run release-probe.sh $TARGET" 2
[ "$1" = "$TARGET" ] || refuse "'$1' is not a target this repository declares; it declares $TARGET"
command -v curl >/dev/null 2>&1 || refuse "curl is not on PATH; install it"
command -v python3 >/dev/null 2>&1 || refuse "python3 is not on PATH; install it"

body="$(mktemp "${TMPDIR:-/tmp}/onetaskgraph-ui-probe.XXXXXX")"
trap 'rm -f "$body"' EXIT

status="$(curl -q -sS --connect-timeout 10 --max-time 25 -o "$body" -w '%{http_code}' \
  "$REGISTRY/@onetaskgraph%2Fui/latest")" || refuse "could not reach $REGISTRY; ask again later"

case "$status" in
  404) exit 0 ;;
  200) ;;
  *) refuse "$REGISTRY answered HTTP $status; ask again later" ;;
esac

python3 - "$body" <<'PY' || refuse "$REGISTRY answered a document with no version in it; ask again later"
import json
import re
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    version = json.load(handle)["version"]
if not re.fullmatch(r"\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]+)?", version):
    raise SystemExit(1)
print(version)
PY
