#!/bin/bash
# pclaws-build.sh <sim dir> <out binary>: build the pc-laws driver against the sim source (mesh.cpp and its includes).
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
g++ -O1 -std=c++17 -w -I"${1:?sim dir}" -o "${2:?out binary}" "$HERE/pclaws-driver.cpp" -lpthread
