#!/bin/bash
# run.sh <sim dir> <work dir> [cases per kind] [seed...]: build the L0 driver against the sim and check js/mesh/*
# against it, once per seed. Exit 1 on the first seed with a diff.
set -e
SIM=${1:?sim dir}; WORK=${2:?work dir}; N=${3:-2000}; shift 3 || shift $#
SEEDS=${*:-1}
HERE=$(cd "$(dirname "$0")" && pwd)
node "$HERE/l0-build.js" "$SIM" "$WORK" > /dev/null
for s in $SEEDS; do
  "$WORK/l0-driver" "$N" "$s" > "$WORK/out.$s.jsonl"
  echo "seed $s: $(wc -l < "$WORK/out.$s.jsonl") cases"
  node "$HERE/l0-check.js" "$WORK/out.$s.jsonl"
done
