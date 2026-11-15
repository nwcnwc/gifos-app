#!/usr/bin/env bash
#
# r2-models.sh: GifOS's own copy of the public model files the site fetches
# (the Offline Captions / Whisper encoder and decoder, tiny and base, and the
# on-device captions engine and models phones run, js/ondevice/models.json), on
# Cloudflare R2 behind the gifos.app edge cache, so a page that picks Whisper
# never contacts an outside site. The deploy workflow runs it before the site
# goes up: --check, --apply, then --verify, and the deploy stops if --verify
# is not green, so a site that fetches from models.gifos.app never goes live
# before the files do.
#
#   bucket   gifos-models, public ONLY through the custom domain (r2.dev off)
#   domain   models.gifos.app on the gifos.app zone, so the edge cache sits in
#            front and a cached hit is not an R2 read
#   keys     <model>/<sha256>/<file>: the path holds the pin, so a file never
#            changes in place; a new version is a new path
#   headers  Cache-Control: public, max-age=31536000, immutable
#            Content-Type: application/octet-stream
#   CORS     GET/HEAD from https://gifos.app (MODELS_ORIGINS, space-separated)
#   cache    a zone Cache Rule makes models.gifos.app eligible for the edge
#            cache and keeps each object's own Cache-Control (.onnx is not one
#            of Cloudflare's default cached extensions)
#
# The file list is read from the site tree this script sits in: the Whisper
# app's signed manifest gives each file's source URL, sha256 and size, and
# js/gifos-assets.js (MIRROR) gives the key the page fetches. Each file is
# downloaded from its pinned source and checked against its sha256 before it
# is uploaded.
#
# Modes:
#   --check   (default) read-only: what exists, and what --apply would do
#   --apply   the missing steps, each checked first; a second run changes nothing
#   --verify  read-only, from outside: 200, sha256 of every byte, the cache
#             and CORS headers, and an edge-cache HIT on a second request
#
# Environment: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (not needed for
# --verify). The token is read inside the processes that use it (python, and
# wrangler from its environment); it is never an argument and never printed.
# WRANGLER may name a wrangler binary; otherwise the pinned version is
# installed into the work folder. Needs bash, node, npm, python3, curl,
# sha256sum.
set -euo pipefail

BUCKET="${MODELS_BUCKET:-gifos-models}"
DOMAIN="${MODELS_DOMAIN:-models.gifos.app}"
ZONE_NAME="${ZONE_NAME:-gifos.app}"
ORIGINS="${MODELS_ORIGINS:-https://gifos.app}"
CACHE_CONTROL='public, max-age=31536000, immutable'
CONTENT_TYPE='application/octet-stream'
RULE_REF='gifos_models_edge_cache'
WRANGLER_VERSION='4.128.0'
WORK="${MODELS_WORK:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}/r2-models}"
# Where the Cloudflare API and the published files are read: the real ones,
# or a server on this machine (a dry run against stand-ins). Nothing else.
API_BASE="${CF_API_BASE:-https://api.cloudflare.com/client/v4}"
FILES_BASE="${MODELS_BASE:-https://$DOMAIN}"

MODE=check
case "${1:-}" in
  ''|--check) MODE=check ;;
  --apply) MODE=apply ;;
  --verify) MODE=verify ;;
  -h|--help) sed -n '2,42p' "$0"; exit 0 ;;
  *) echo "usage: $0 [--check|--apply|--verify]" >&2; exit 2 ;;
esac

say() { printf '%s\n' "$*"; }
die() { printf '::error::%s\n' "$*" >&2; exit 1; }

local_or() {   # $1 value, $2 the only remote value allowed
  case "$1" in "$2"|http://127.0.0.1:*) ;; *) die "refusing base $1" ;; esac
}
local_or "$API_BASE" 'https://api.cloudflare.com/client/v4'
local_or "$FILES_BASE" "https://$DOMAIN"

# ---- the site tree --------------------------------------------------------------
APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
[ -f "$APP/js/gifos-assets.js" ] || die "no site tree at $APP"
mkdir -p "$WORK"

# key sha256 bytes source-url, one line per file the page fetches from $DOMAIN
MODELS="$(node -e '
  globalThis.window = globalThis; globalThis.location = { origin: "https://gifos.app" };
  const app = process.argv[1], domain = process.argv[2];
  require(app + "/js/gifos-gif.js"); require(app + "/js/gifos-assets.js");
  const A = GifOS.assets;
  if (!A.sourceUrl) { console.error("this site has no first-party model copies"); process.exit(1); }
  const b = new Uint8Array(require("fs").readFileSync(app + "/apps/offline-stt-whisper/offline-stt-whisper.gif"));
  Promise.resolve(GifOS.gif.decode(b)).then((a) => GifOS.gif.readManifest(a)).then((m) => {
    for (const p of A.list(m)) {
      const u = new URL(A.sourceUrl(p));
      if (u.hostname !== domain) { console.error("not on " + domain + ": " + p.path); process.exit(1); }
      console.log(u.pathname.slice(1) + " " + p.sha256 + " " + p.bytes + " " + p.url);
    }
  });' "$APP" "$DOMAIN")"
[ "$(printf '%s\n' "$MODELS" | grep -c . || true)" -ge 1 ] || die "no model files found"
# On-device captions (js/ondevice/models.json): the engine and model files a phone's
# browser fetches. Each comes out of a published upstream archive, so its source is
# 'ondevice': ondevice-files.mjs downloads the archives, checks every file against its
# pin and leaves it at $WORK/ondevice/out/<key>.
ONDEVICE_TOOL="$APP/.github/scripts/ondevice-files.mjs"
if [ -f "$ONDEVICE_TOOL" ]; then
  MODELS="$MODELS
$(node "$ONDEVICE_TOOL" list | awk '{ print $1, $2, $3, "ondevice" }')"
fi
while read -r key sha _bytes src; do
  case "$key" in */"$sha"/*) ;; *) die "key $key does not hold its sha256" ;; esac
  case "$src" in https://*|ondevice) ;; *) die "source of $key is not https" ;; esac
done <<< "$MODELS"
say "$(printf '%s\n' "$MODELS" | grep -c .) files for $DOMAIN (bucket $BUCKET):"
printf '%s\n' "$MODELS" | awk '{ printf "  %s  %.1f MB\n", $1, $3/1e6 }'

# ---- verify: from outside, read-only ------------------------------------------------
hdr_of() { grep -i "^$1:" "$2" | tail -1 | tr -d '\r' | cut -d' ' -f2- || true; }
verify() {
  local bad=0 origin key sha src status got cc acao hit
  origin="${ORIGINS%% *}"
  mkdir -p "$WORK/verify"
  while read -r key sha _bytes src; do
    : > "$WORK/verify/body"; : > "$WORK/verify/h1"; : > "$WORK/verify/h2"
    status="$(curl -sS --connect-timeout 10 --max-time 600 -o "$WORK/verify/body" -D "$WORK/verify/h1" -w '%{http_code}' -H "Origin: $origin" "$FILES_BASE/$key" || echo 000)"
    if [ "$status" != 200 ]; then say "FAIL $key http $status"; bad=1; continue; fi
    got="$(sha256sum "$WORK/verify/body" | cut -d' ' -f1)"
    if [ "$got" = "$sha" ]; then say "ok   $key sha256"; else say "FAIL $key sha256 $got"; bad=1; fi
    cc="$(hdr_of cache-control "$WORK/verify/h1")"
    case "$cc" in *max-age=31536000*immutable*|*immutable*max-age=31536000*) say "ok   $key cache-control" ;; *) say "FAIL $key cache-control '$cc'"; bad=1 ;; esac
    acao="$(hdr_of access-control-allow-origin "$WORK/verify/h1")"
    if [ "$acao" = "$origin" ] || [ "$acao" = '*' ]; then say "ok   $key CORS for $origin"; else say "FAIL $key access-control-allow-origin '$acao'"; bad=1; fi
    curl -sS --connect-timeout 10 --max-time 600 -o /dev/null -D "$WORK/verify/h2" -H "Origin: $origin" "$FILES_BASE/$key" || true
    hit="$(hdr_of cf-cache-status "$WORK/verify/h2")"
    if [ "$hit" = HIT ]; then say "ok   $key edge cache HIT"; else say "FAIL $key second request cf-cache-status '$hit' (want HIT)"; bad=1; fi
  done <<< "$MODELS"
  rm -rf "$WORK/verify"
  if [ "$bad" = 0 ]; then say "VERIFY GREEN: $DOMAIN serves every file, pinned, edge-cached, CORS for $origin"; else say "VERIFY RED"; fi
  return "$bad"
}
if [ "$MODE" = verify ]; then verify; exit $?; fi

# ---- Cloudflare -------------------------------------------------------------------------
[ -n "${CLOUDFLARE_API_TOKEN:-}" ] || die "CLOUDFLARE_API_TOKEN is not set"
[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ] || die "CLOUDFLARE_ACCOUNT_ID is not set"
export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID CF_API_BASE="$API_BASE"

# cfapi METHOD PATH [BODY-FILE]: prints the JSON "result" (null on 404); exits 1 on an API error.
cfapi() {
  python3 -I - "$@" <<'PY'
import json, os, sys, urllib.request, urllib.error
method, path = sys.argv[1], sys.argv[2]
body = open(sys.argv[3], 'rb').read() if len(sys.argv) > 3 else None
req = urllib.request.Request(os.environ['CF_API_BASE'] + path, data=body, method=method,
    headers={'Authorization': 'Bearer ' + os.environ['CLOUDFLARE_API_TOKEN'], 'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.load(r)
except urllib.error.HTTPError as e:
    if e.code == 404:
        print('null'); sys.exit(0)
    try: data = json.load(e)
    except Exception: data = {'errors': [{'message': 'http %d' % e.code}]}
    sys.stderr.write('::error::cloudflare api %s %s: %s\n' % (method, path.split('?')[0], json.dumps(data.get('errors'))[:400])); sys.exit(1)
if not data.get('success', False):
    sys.stderr.write('::error::cloudflare api %s: %s\n' % (path.split('?')[0], json.dumps(data.get('errors'))[:400])); sys.exit(1)
print(json.dumps(data.get('result')))
PY
}
jget() { python3 -I -c 'import json,sys; d=json.load(sys.stdin); exec(sys.argv[1])' "$@"; }

ACCT="/accounts/$CLOUDFLARE_ACCOUNT_ID"
TODO=0
plan() { TODO=$((TODO + 1)); say "TODO $*"; }

WR="${WRANGLER:-$WORK/tools/node_modules/.bin/wrangler}"
wrangler_ready() {
  if [ ! -x "$WR" ]; then
    npm install --prefix "$WORK/tools" --no-audit --no-fund "wrangler@$WRANGLER_VERSION" >/dev/null
    WR="$WORK/tools/node_modules/.bin/wrangler"
  fi
  local v; v="$("$WR" --version 2>/dev/null | grep -o '[0-9][0-9.]*' | head -1 || true)"
  [ "$v" = "$WRANGLER_VERSION" ] || die "wrangler is $v, want $WRANGLER_VERSION"
}

# ---- 1. the bucket -------------------------------------------------------------------
if [ "$(cfapi GET "$ACCT/r2/buckets/$BUCKET")" = null ]; then
  if [ "$MODE" = apply ]; then wrangler_ready; "$WR" r2 bucket create "$BUCKET"; say "made bucket $BUCKET"; HAVE_BUCKET=1
  else plan "create R2 bucket $BUCKET"; HAVE_BUCKET=0; fi
else
  say "ok   bucket $BUCKET"; HAVE_BUCKET=1
fi

# ---- 2. the files: from the pinned source, sha256 checked, then uploaded ----------------
declare -A STORED=()
if [ "$HAVE_BUCKET" = 1 ]; then
  listing="$(cfapi GET "$ACCT/r2/buckets/$BUCKET/objects?per_page=1000")"
  while read -r k size cc ct; do [ -n "$k" ] && STORED["$k"]="$size|$cc|$ct"; done < <(printf '%s' "$listing" | jget '
for o in (d or []):
    h = o.get("http_metadata") or {}
    print(o["key"], o.get("size", 0), (h.get("cacheControl") or "-").replace(" ", "_"), (h.get("contentType") or "-"))')
fi
mkdir -p "$WORK/files"
while read -r key sha bytes src; do
  have="${STORED[$key]:-}"
  if [ "$have" = "$bytes|${CACHE_CONTROL// /_}|$CONTENT_TYPE" ]; then say "ok   $key stored"; continue; fi
  # A listing without object headers: the size is the check (the key holds the sha256); --verify reads the headers.
  if [ "$have" = "$bytes|-|-" ]; then say "ok   $key stored (headers checked by --verify)"; continue; fi
  if [ "$MODE" != apply ]; then plan "upload $key (${have:-missing}) from $src"; continue; fi
  f="$WORK/files/$sha"
  if [ "$src" = ondevice ]; then
    f="$WORK/ondevice/out/$key"
    [ -f "$f" ] || node "$ONDEVICE_TOOL" fetch "$WORK/ondevice" >/dev/null
  elif [ ! -f "$f" ] || [ "$(sha256sum "$f" | cut -d' ' -f1)" != "$sha" ]; then
    curl -fsSL --retry 3 --connect-timeout 20 --max-time 1200 -o "$f.part" "$src"
    mv "$f.part" "$f"
  fi
  got="$(sha256sum "$f" | cut -d' ' -f1)"
  [ "$got" = "$sha" ] || { rm -f "$f"; die "$src does not match its pin ($got, want $sha); nothing uploaded"; }
  wrangler_ready
  "$WR" r2 object put "$BUCKET/$key" --file "$f" --content-type "$CONTENT_TYPE" --cache-control "$CACHE_CONTROL" --remote
  say "put  $key"
done <<< "$MODELS"

# ---- 3. CORS ---------------------------------------------------------------------------
CORS_FILE="$WORK/cors.json"
python3 -I -c 'import json,sys; print(json.dumps({"rules": [{"allowed": {"origins": sys.argv[1].split(), "methods": ["GET", "HEAD"]}, "exposeHeaders": ["Content-Length", "ETag"], "maxAgeSeconds": 86400}]}))' "$ORIGINS" > "$CORS_FILE"
cors_now=null
if [ "$HAVE_BUCKET" = 1 ]; then cors_now="$(cfapi GET "$ACCT/r2/buckets/$BUCKET/cors")"; fi
same="$(printf '%s' "$cors_now" | jget '
want = json.load(open(sys.argv[2]))["rules"]
norm = lambda rs: sorted(json.dumps([sorted(r.get("allowed", {}).get("origins", [])), sorted(r.get("allowed", {}).get("methods", [])), sorted(r.get("exposeHeaders") or []), r.get("maxAgeSeconds")]) for r in rs)
print("yes" if d and norm(d.get("rules") or []) == norm(want) else "no")' "$CORS_FILE")"
if [ "$same" = yes ]; then say "ok   CORS GET/HEAD from $ORIGINS"
elif [ "$MODE" = apply ]; then wrangler_ready; "$WR" r2 bucket cors set "$BUCKET" --file "$CORS_FILE" -y; say "set  CORS GET/HEAD from $ORIGINS"
else plan "set CORS on $BUCKET: GET/HEAD from $ORIGINS"; fi

# ---- 4. the custom domain --------------------------------------------------------------
ZONE_ID="$(cfapi GET "/zones?name=$ZONE_NAME" | jget 'print(d[0]["id"] if d else "")')"
[ -n "$ZONE_ID" ] || die "zone $ZONE_NAME not found for this token"
doms=null
if [ "$HAVE_BUCKET" = 1 ]; then doms="$(cfapi GET "$ACCT/r2/buckets/$BUCKET/domains/custom")"; fi
dstate="$(printf '%s' "$doms" | jget '
ds = d.get("domains", []) if isinstance(d, dict) else []
m = [x for x in ds if x.get("domain") == sys.argv[2]]
s = (m[0].get("status") or {}) if m else {}
print("none" if not m else ("on" if m[0].get("enabled") else "off") + ":" + str(s.get("ownership")) + "/" + str(s.get("ssl")))' "$DOMAIN")"
case "$dstate" in
  on:active/active) say "ok   $DOMAIN serves $BUCKET" ;;
  none)
    # A DNS record of its own on that name belongs to something else: never overwrite it.
    rec="$(cfapi GET "/zones/$ZONE_ID/dns_records?name=$DOMAIN" | jget 'print(len(d or []))')"
    [ "$rec" = 0 ] || die "$DOMAIN already has a DNS record; not touching it"
    if [ "$MODE" = apply ]; then wrangler_ready; "$WR" r2 bucket domain add "$BUCKET" --domain "$DOMAIN" --zone-id "$ZONE_ID" --min-tls 1.2 -y; say "added $DOMAIN (certificate and DNS take a few minutes)"
    else plan "connect $DOMAIN to $BUCKET (min TLS 1.2)"; fi ;;
  *) say "WAIT $DOMAIN is connected, not active yet ($dstate)" ;;
esac
if [ "$HAVE_BUCKET" = 1 ]; then
  dev="$(cfapi GET "$ACCT/r2/buckets/$BUCKET/domains/managed" | jget 'print("on" if (d or {}).get("enabled") else "off")')"
  if [ "$dev" = off ]; then say "ok   r2.dev URL off"; else say "::warning::the r2.dev URL of $BUCKET is on (want off: public only through $DOMAIN)"; fi
fi

# ---- 5. the edge cache rule ------------------------------------------------------------
RS="$(cfapi GET "/zones/$ZONE_ID/rulesets/phases/http_request_cache_settings/entrypoint")"
has_rule="$(printf '%s' "$RS" | jget 'print("yes" if d and any(r.get("ref") == sys.argv[2] for r in d.get("rules", [])) else "no")' "$RULE_REF")"
RULE_FILE="$WORK/cache-rule.json"
python3 -I -c 'import json,sys; print(json.dumps({"ref": sys.argv[1], "description": "models.gifos.app: model files are edge-cached by their own Cache-Control", "expression": "(http.host eq \"%s\")" % sys.argv[2], "action": "set_cache_settings", "action_parameters": {"cache": True, "edge_ttl": {"mode": "respect_origin"}, "browser_ttl": {"mode": "respect_origin"}}, "enabled": True}))' "$RULE_REF" "$DOMAIN" > "$RULE_FILE"
if [ "$has_rule" = yes ]; then say "ok   cache rule $RULE_REF"
elif [ "$MODE" != apply ]; then plan "add zone cache rule $RULE_REF ($DOMAIN edge-cached, TTL from Cache-Control)"
elif [ "$RS" = null ]; then
  python3 -I -c 'import json,sys; print(json.dumps({"rules": [json.load(open(sys.argv[1]))]}))' "$RULE_FILE" > "$WORK/cache-ruleset.json"
  cfapi PUT "/zones/$ZONE_ID/rulesets/phases/http_request_cache_settings/entrypoint" "$WORK/cache-ruleset.json" >/dev/null; say "made the cache ruleset with $RULE_REF"
else
  RS_ID="$(printf '%s' "$RS" | jget 'print(d["id"])')"
  cfapi POST "/zones/$ZONE_ID/rulesets/$RS_ID/rules" "$RULE_FILE" >/dev/null; say "added cache rule $RULE_REF (other rules kept)"
fi

if [ "$MODE" = check ]; then
  if [ "$TODO" = 0 ]; then say "CHECK: nothing to do"; else say "CHECK: $TODO step(s) for --apply"; fi
else
  say "APPLY done"
fi
