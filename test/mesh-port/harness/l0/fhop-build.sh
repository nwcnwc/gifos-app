#!/bin/bash
# fhop-build.sh <gifos repo> <sha> <out binary> <work dir>: extract the sim at <sha>, plant the three hooks in a copy of
# mesh_fhop.inc (fhXmit, l16Refuse and startDial calls; see fhop-driver.cpp), and build the friend-hop driver.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=${1:?gifos repo}; SHA=${2:?sha}; OUT=${3:?out binary}; WORK=${4:?work dir}
rm -rf "$WORK"; mkdir -p "$WORK"
git -C "$REPO" archive "$SHA" test/sim | tar -x -C "$WORK"
F="$WORK/test/sim/mesh_fhop.inc"
python3 - "$F" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
def rep(a,b):
    global s
    assert s.count(a)==1, a
    s=s.replace(a,b)
rep("static void fhXmit(int me,int p,Msg env){ linkSchedule(me,p,move(env)); }",
    "void (*fhXmitHook)(int,int,const Msg&)=nullptr; int (*fhL16Hook)(int,int,int)=nullptr; void (*fhDialHook)(int,int,Link&)=nullptr;\nstatic void fhXmit(int me,int p,Msg env){ if(fhXmitHook) fhXmitHook(me,p,env); else linkSchedule(me,p,move(env)); }")
rep("if(l16Refuse(from,to,m.t)) return true;   // L16: a door past","if(fhL16Hook ? fhL16Hook(from,to,(int)m.t) : l16Refuse(from,to,m.t)) return true;   // L16: a door past")
rep("(namesOwned(from,to) || farView(sf,to).seat==-1)) startDial(from,to,L);","(namesOwned(from,to) || farView(sf,to).seat==-1)) { if(fhDialHook) fhDialHook(from,to,L); else startDial(from,to,L); }")
rep("TICK-L.askAt>=LINK_ASK_GAP){ L.askAt=TICK; startDial(from,to,L); }","TICK-L.askAt>=LINK_ASK_GAP){ L.askAt=TICK; if(fhDialHook) fhDialHook(from,to,L); else startDial(from,to,L); }")
open(p,'w').write(s)
PY
g++ -O1 -std=c++17 -w -I"$WORK/test/sim" -o "$OUT" "$HERE/fhop-driver.cpp" -lpthread
