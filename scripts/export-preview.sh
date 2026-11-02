#!/usr/bin/env bash
set -euo pipefail

# Run from the repository root; keep previews and server output out of git.
cd "$(dirname "$0")/.."
output=${1:-var/previews/index.html}
port=${PORT:-18787}
mkdir -p var "$(dirname "$output")"
log=$(mktemp var/export-preview.XXXXXX)
temporary=$(mktemp "${output}.XXXXXX")
pid=
cleanup() {
  if [[ -n "$pid" ]]; then
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
  rm -f "$temporary"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Refuse an occupied port so health checks cannot hit another rig process.
PORT="$port" node --input-type=module -e '
  import net from "node:net";
  const server = net.createServer();
  server.on("error", () => { console.error("Preview port unavailable"); process.exit(1); });
  server.listen(Number(process.env.PORT), () => server.close());
'
PORT="$port" node --import tsx --env-file-if-exists=.env src/server.ts >"$log" 2>&1 &
pid=$!
ready=false
for ((attempt = 0; attempt < 50; attempt++)); do
  if ! kill -0 "$pid" 2>/dev/null; then
    echo 'Preview server exited; see ignored var/export-preview.* logs.' >&2
    exit 1
  fi
  if curl --fail --silent --max-time 1 "http://localhost:$port/health" >/dev/null; then
    ready=true
    break
  fi
  sleep 0.1
done
if [[ "$ready" != true ]]; then
  echo 'Preview server did not become healthy in time.' >&2
  exit 1
fi
curl --fail --silent --show-error --max-time 10 \
  "http://localhost:$port/digest/2026-10-28" -o "$temporary"

# Fixed sample: validate the copy without printing HTML or the lane marker.
node --input-type=module - "$temporary" <<'NODE'
import { readFileSync } from 'node:fs';
const html = readFileSync(process.argv[2], 'utf8');
const valid = html.length > 0
  && /^<!doctype html>/i.test(html)
  && /<\/html>\s*$/i.test(html)
  && (html.match(/<style>/g) ?? []).length === 1
  && /<header>.*class="marker">[^<]+<\/span>.*<\/header>/s.test(html)
  && html.includes('digest · 2026-10-28')
  && html.includes('malformed lines: 1')
  && (html.match(/<th scope="row">/g) ?? []).length === 5
  && !/<(?:script|link|iframe|img|object|embed|audio|video|source|base)\b/i.test(html)
  && !/\b(?:src|href|srcset)\s*=|@import\b|url\s*\(/i.test(html);
if (!valid) {
  console.error('Preview HTML failed self-contained sample validation.');
  process.exit(1);
}
NODE
mv "$temporary" "$output"
echo "Preview exported to $output"
