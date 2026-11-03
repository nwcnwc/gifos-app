// heal-l0-driver.cpp: differential driver for the pure functions of mesh_heal.inc. One JSON line per case.
//   heal-l0-driver <cases> <seed>
#include <cstdio>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>
#include <random>
#include <unordered_map>
#include "topo.h"
using namespace std;
#include "heal-l0-sim.h"
static mt19937_64 G;
static uint64_t r64(){ return G(); }
static int ri(int lo,int hi){ return lo+(int)(r64()%(uint64_t)(hi-lo+1)); }
static uint32_t pcVal(){ switch(ri(0,3)){ case 0: return 0; case 1: { uint32_t pc=0; int d=ri(1,6); for(int q=0;q<d;q++) pc=childPath(pc,ri(0,C-1)); return pc; } case 2: return (uint32_t)r64(); default: return (uint32_t)ri(0,40); } }
static string S;
static void coordJ(const Coord& c){ S+="{\"pc\":"+to_string(c.pc)+",\"r\":"+to_string((int)c.r)+",\"i\":"+to_string((int)c.i)+"}"; }
static void coordsJ(Coord* a,int n){ S+='['; for(int q=0;q<n;q++){ if(q) S+=','; coordJ(a[q]); } S+=']'; }
int main(int argc,char** argv){
  int N=argc>1?atoi(argv[1]):1000; G.seed(argc>2?strtoull(argv[2],0,10):1);
  for(int t=0;t<N;t++){
    Coord H{pcVal(),(uint8_t)ri(0,C-1),(uint8_t)ri(0,C-1)}; L13_15=ri(0,1);
    S="{\"H\":"; coordJ(H); S+=",\"l13_15\":"; S+=L13_15?"true":"false";
    Coord out[2*C+2]; int n=rmWitCells(H,out); S+=",\"wit\":"; coordsJ(out,n);
    n=l13Ring(H,out); S+=",\"ring\":"; coordsJ(out,n);
    Coord w; bool ok=l13Witness(H,w); S+=",\"witness\":"; if(ok) coordJ(w); else S+="null";
    Coord ch[L13_CHAIN_MAX]; n=l13Chain(H,ch); S+=",\"chain\":"; coordsJ(ch,n);
    n=l13Line(H,ch); S+=",\"line\":"; coordsJ(ch,n);
    uint64_t k=ckey(H); int x=ri(0,3)?ri(0,10000):ri(0,1<<20); uint64_t fk=(1ULL<<50)|hmix64(hmix(H_INIT,(uint32_t)x),k);   // findLeaf's l9Fwd key
    S+=",\"x\":"+to_string(x)+",\"fk\":\""+to_string((unsigned long long)fk)+"\"}";
    puts(S.c_str());
  }
}
