#!/usr/bin/env bash
# deploy-tip.sh: publish the tip of the in-progress release branch to the
# TIP test site (Pages project gifos-tip -> https://tip.gifos.app).
#
# It never touches the prod Pages project "gifos", gifos.app, prod's
# version.json, or the R2 GIF bucket. It uses the prod relay (tip.gifos.app
# is inside the relay's *.gifos.app origin allow-list).
#
# Lives under .github/ on purpose: prod's deploy.yml neither publishes .github/
# nor counts it toward the build number, so this file can't change gifos.app.
#
#   .github/tip/deploy-tip.sh          deploy only if the branch sha changed
#   .github/tip/deploy-tip.sh --force  deploy now
#
# Which branch: .github/tip/TIP_BRANCH on main (one line, e.g. release/0.9.25).
# Needs CLOUDFLARE_API_TOKEN (Pages edit) and CLOUDFLARE_ACCOUNT_ID in the env.
set -euo pipefail
WORK="${GIFOS_TIP_WORK:-/workspace/gifos-tip}"
REPO="https://github.com/nwcnwc/gifos-app.git"
PROJECT="gifos-tip"
WRANGLER="wrangler@4.128.0"
FORCE=0; [ "${1:-}" = "--force" ] && FORCE=1
[ -x "$WORK/node/bin/node" ] && export PATH="$WORK/node/bin:$PATH"
log() { echo "$(date '+%F %T %Z') $*"; }

: "${CLOUDFLARE_API_TOKEN:?need CLOUDFLARE_API_TOKEN}"
: "${CLOUDFLARE_ACCOUNT_ID:?need CLOUDFLARE_ACCOUNT_ID}"

BRANCH=${TIP_BRANCH_OVERRIDE:-}
[ -n "$BRANCH" ] || BRANCH=$(curl -fsS "https://raw.githubusercontent.com/nwcnwc/gifos-app/main/.github/tip/TIP_BRANCH?ts=$(date +%s)" | tr -d '[:space:]')
[[ "$BRANCH" =~ ^[A-Za-z0-9._/-]+$ ]] || { log "bad TIP_BRANCH '$BRANCH'"; exit 1; }
SHA=$(git ls-remote "$REPO" "refs/heads/$BRANCH" | cut -f1)
[ -n "$SHA" ] || { log "branch $BRANCH not found"; exit 1; }
LAST=$(cat "$WORK/last-deployed" 2>/dev/null || true)
if [ "$FORCE" = 0 ] && [ "$LAST" = "$BRANCH $SHA" ]; then exit 0; fi
log "deploying $BRANCH @ ${SHA:0:10} (was: ${LAST:-none})"

SRC="$WORK/src"
if [ ! -d "$SRC/.git" ]; then git clone -q --depth 1 -b "$BRANCH" "$REPO" "$SRC"; fi
git -C "$SRC" fetch -q --depth 1 origin "$SHA"
git -C "$SRC" checkout -q --detach "$SHA"

DIST="$WORK/dist"; rm -rf "$DIST"; mkdir -p "$DIST"
rsync -a --exclude .git --exclude .github --exclude worker --exclude dist \
  --exclude README.md --exclude NOTICE --exclude '*.gif' "$SRC/" "$DIST/"
# GIFs are not published: big, and the store reads them from prod's R2.
# Keep small ones (<5 MiB) so local UI still has icons; drop anything a Page can't hold.
(cd "$SRC" && find . -path ./.git -prune -o -name '*.gif' -size -5M -print | while read -r f; do mkdir -p "$DIST/$(dirname "$f")"; cp "$f" "$DIST/$f"; done)
find "$DIST" -type f -size +25M -delete

SHORT=${SHA:0:8}
VER=$(echo "$BRANCH" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1 || true)
printf '/* TIP build */\nwindow.GIFOS_BUILD = "tip-%s";\nwindow.GIFOS_TIP = {branch:"%s",sha:"%s"};\n' "$SHORT" "$BRANCH" "$SHA" > "$DIST/js/build.js"
DIST="$DIST" BRANCH="$BRANCH" SHA="$SHA" VER="$VER" node -e '
const fs=require("fs"),f=process.env.DIST+"/version.json",j=JSON.parse(fs.readFileSync(f));
if(process.env.VER) j.current=process.env.VER.split(".").slice(0,3).join(".");
delete j.emergency; j.edgeBuild=0;
j.tip={branch:process.env.BRANCH,sha:process.env.SHA,deployedAt:new Date().toISOString()};
fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n");'
# The root channel loader sends *.gifos.app visitors to /versions/<current>/.
# On tip.gifos.app the root IS the build under test, so stay on it.
# Badge: fixed red pill on every non-snapshot page.
BADGE="<div id=\"gifos-tip-badge\" style=\"position:fixed;left:50%;bottom:6px;transform:translateX(-50%);z-index:2147483647;background:#d00;color:#fff;font:700 11px/1.6 system-ui,sans-serif;padding:1px 9px;border-radius:9px;pointer-events:none;opacity:.92;box-shadow:0 1px 4px rgba(0,0,0,.4)\">TIP · ${BRANCH} · ${SHORT}</div>"
find "$DIST" -path "$DIST/versions" -prune -o -name '*.html' -print0 | while IFS= read -r -d '' h; do
  sed -i -E 's#/\(\^\|\\\.\)gifos\\\.app\$/\.test\(location\.hostname\)#(/(^|\\.)gifos\\.app$/.test(location.hostname) \&\& location.hostname !== "tip.gifos.app")#g' "$h"
  sed -i -E "s#(href|src)=\"([^\":?]+\.(css|js))\"#\1=\"\2?v=${SHORT}\"#g" "$h"
  if grep -qi '</body>' "$h"; then sed -i "s#</body>#${BADGE//\#/\\#}</body>#I" "$h"; else echo "$BADGE" >> "$h"; fi
done

cd "$WORK"
export WRANGLER_SEND_METRICS=false WRANGLER_CACHE_DIR="$WORK/.wrangler-cache"
mkdir -p "$WORK/node_modules/.cache"
[ -x "$WORK/tools/node_modules/.bin/wrangler" ] || npm install -s --prefix "$WORK/tools" --no-audit --no-fund "$WRANGLER"
"$WORK/tools/node_modules/.bin/wrangler" pages deploy "$DIST" --project-name "$PROJECT" --branch tip \
  --commit-hash "$SHA" --commit-message "TIP $BRANCH ${SHORT}" --commit-dirty=true
echo "$BRANCH $SHA" > "$WORK/last-deployed"
log "deployed $BRANCH @ ${SHA:0:10}"
