// digroute-driver.cpp: the L0 driver for the S5/S6 pure functions (digest.js, route.js). Built by digroute-build.js.
// One JSON line per case: the inputs and what the sim's code answers. digroute-check.js recomputes it with JS.
//   digroute-driver <cases per kind> <seed>
#include <cstdio>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>
#include <random>
#include <algorithm>
#include <unordered_map>
#include <unordered_set>
#include "topo.h"
#include "roles.h"
#include "laws.h"
#include "omap.h"
using namespace std;
#include "l0-sim.h"
#include "digroute-sim.h"

static string S;
static void put(const char* s){ S+=s; }
static void num(long long v){ S+=to_string(v); }
static void unum(unsigned long long v){ S+=to_string(v); }
static void boolean(bool v){ S+= v?"true":"false"; }
static void coordJ(const Coord& c){ S+="{\"pc\":"; unum(c.pc); S+=",\"r\":"; num(c.r); S+=",\"i\":"; num(c.i); S+='}'; }
static void coordOrNull(bool ok,const Coord& c){ if(ok) coordJ(c); else put("null"); }
template<class T,class F> static void arr(const vector<T>& v,F f){ S+='['; for(size_t i=0;i<v.size();i++){ if(i) S+=','; f(v[i]); } S+=']'; }
static void leJ(const LE& e){ S+="{\"id\":"; num(e.id); S+=",\"k\":"; num(e.k); S+=",\"f\":"; num(e.f); S+='}'; }
static void veJ(const VE& e){ S+="{\"tgt\":"; num(e.tgt); S+=",\"up\":"; num(e.up); S+=",\"dn\":"; num(e.dn); S+='}'; }
static void intJ(const int& x){ num(x); }
static void kJ(const KStmt& k){ S+="{\"voter\":"; num(k.voter); S+=",\"signer\":"; num(k.signer); S+=",\"tn\":"; num(k.tn); S+=",\"ver\":"; num(k.ver);
  S+=",\"ck\":"; unum(k.ck); S+=",\"good\":"; boolean(k.good); S+=",\"all\":"; boolean(k.all); S+=",\"yes\":"; arr(k.yes,intJ); S+=",\"abs\":"; arr(k.abs,intJ); S+='}'; }
static void digJ(const Dig& d){
  S+="{\"n\":"; num(d.n); S+=",\"refuse\":"; num(d.refuse); S+=",\"freeC\":"; num(d.freeC); S+=",\"at\":"; num(d.at); S+=",\"by\":"; num(d.by);
  S+=",\"dmin\":"; num(d.dmin); S+=",\"ag\":"; num(d.ag); S+=",\"rx\":"; num(d.rx); S+=",\"part\":"; num(d.part); S+=",\"leased\":"; num(d.leased);
  S+=",\"handN\":"; num(d.handN); S+=",\"awayN\":"; num(d.awayN);
  S+=",\"hands\":"; arr(d.hands,leJ); S+=",\"stage\":"; arr(d.stage,leJ); S+=",\"apps\":"; arr(d.apps,leJ); S+=",\"votes\":"; arr(d.votes,veJ);
  S+=",\"talk\":"; arr(d.talk,leJ); S+=",\"kick\":"; arr(d.kick,veJ); S+=",\"kabs\":"; num(d.kabs); S+=",\"kOwn\":"; kJ(d.kOwn); S+=",\"kl\":"; arr(d.kl,kJ); S+='}'; }
static void line(){ puts(S.c_str()); S.clear(); }

static mt19937_64 G;
static uint64_t r64(){ return G(); }
static int ri(int lo,int hi){ return lo+(int)(r64()%(uint64_t)(hi-lo+1)); }
static uint32_t pcVal(){ switch(ri(0,3)){ case 0: return 0; case 1: { uint32_t pc=0; int d=ri(1,13); for(int q=0;q<d;q++) pc=childPath(pc,ri(0,C-1)); return pc; } case 2: return (uint32_t)ri(0,2000); default: return (uint32_t)r64(); } }
static Coord coordVal(){ return Coord{pcVal(),(uint8_t)ri(0,C-1),(uint8_t)ri(0,C-1)}; }
// a coord related to c: the same section, an ancestor, a descendant, a sibling subtree, or unrelated
static Coord relVal(const Coord& c){
  switch(ri(0,5)){
    case 0: return Coord{c.pc,(uint8_t)ri(0,C-1),(uint8_t)ri(0,C-1)};
    case 1: { uint32_t pc=c.pc; int d=ri(0,3); while(pc && d-->0) pc=parentPath(pc); return Coord{pc,(uint8_t)ri(0,C-1),(uint8_t)ri(0,C-1)}; }
    case 2: { uint32_t pc=c.pc; int d=ri(1,3); for(int q=0;q<d && pcDepth(pc)<12;q++) pc=childPath(pc,ri(0,C-1)); return Coord{pc,(uint8_t)ri(0,C-1),(uint8_t)ri(0,C-1)}; }
    case 3: { uint32_t pc=c.pc; if(pc){ pc=parentPath(pc); pc=childPath(pc,ri(0,C-1)); } return Coord{pc,(uint8_t)ri(0,C-1),(uint8_t)ri(0,C-1)}; }
    default: return coordVal(); } }
static KStmt kVal(int ids){ KStmt k; k.voter=ri(-1,ids); k.signer=ri(0,3)?k.voter:ri(-1,ids); k.tn=ri(-1,50); k.ver=ri(-1,6); k.ck=r64()%(1ull<<40);
  k.good=ri(0,4)!=0; k.all=ri(0,5)==0; int n=ri(0,3); for(int q=0;q<n;q++) k.yes.push_back(ri(-1,ids)); n=ri(0,2); for(int q=0;q<n;q++) k.abs.push_back(ri(-1,ids)); return k; }

int main(int argc,char** argv){
  const int N=argc>1?atoi(argv[1]):1000; G.seed(argc>2?strtoull(argv[2],0,10):1);
  for(int q=0;q<N;q++){   // l12 candidate walk and origin
    int r0=ri(-1,C), col=ri(-1,C), n=ri(-1,30); int rr=-9, cc=-9; bool ok=l12Cand(r0,col,n,rr,cc);
    Coord sk=coordVal(); int o0, oc; l12Origin(sk,o0,oc);
    S+="{\"k\":\"l12\",\"r0\":"; num(r0); S+=",\"col\":"; num(col); S+=",\"n\":"; num(n); S+=",\"seeker\":"; coordJ(sk);
    S+=",\"out\":{\"cand\":"; if(ok){ S+='['; num(rr); S+=','; num(cc); S+=']'; } else put("null");
    S+=",\"origin\":["; num(o0); S+=','; num(oc); S+="]}}"; line(); }
  for(int q=0;q<N;q++){   // l12Score
    int r=ri(0,C-1), c=ri(0,C-1), r0=ri(0,C-1), col=ri(0,C-1);
    S+="{\"k\":\"l12s\",\"r\":"; num(r); S+=",\"c\":"; num(c); S+=",\"r0\":"; num(r0); S+=",\"col\":"; num(col); S+=",\"out\":"; num(l12Score(r,c,r0,col)); S+='}'; line(); }
  for(int q=0;q<N;q++){   // kHash / kSameVote / kHasVote / kTakerOf / cellOk / coordStr
    int a=ri(-3,3000); long long b=ri(0,2)?(long long)(r64()%(1ull<<40)):ri(0,100000); int c=ri(0,255);
    KStmt x=kVal(6), y=ri(0,2)?x:kVal(6); if(ri(0,1)){ reverse(y.yes.begin(),y.yes.end()); reverse(y.abs.begin(),y.abs.end()); }
    Coord cd=coordVal(); uint64_t ck=ri(0,3)?(uint64_t)ckey(cd):(r64()%(1ull<<40));
    S+="{\"k\":\"kmisc\",\"a\":"; num(a); S+=",\"b\":"; num(b); S+=",\"c\":"; num(c); S+=",\"x\":"; kJ(x); S+=",\"y\":"; kJ(y); S+=",\"ck\":"; unum(ck);
    S+=",\"out\":{\"kHash\":"; unum(kHash(a,b,c)); S+=",\"same\":"; boolean(kSameVote(x,y)); S+=",\"has\":"; boolean(kHasVote(x)); S+=",\"taker\":"; unum(kTakerOf(ck));
    S+=",\"cellOk\":"; boolean(cellOk(ck)); string cs=coordStr(unck(ck)); S+=",\"coordStr\":\""+cs+"\"}}"; line(); }
  for(int q=0;q<N;q++){   // kInScope
    Coord c=coordVal(); Coord v=relVal(c); bool rs=ri(0,1);
    S+="{\"k\":\"kscope\",\"v\":"; unum(ckey(v)); S+=",\"c\":"; unum(ckey(c)); S+=",\"rowScope\":"; boolean(rs); S+=",\"out\":"; boolean(kInScope(ckey(v),ckey(c),rs)); S+='}'; line(); }
  for(int q=0;q<N;q++){   // kOver
    Dig R; R.n=ri(-2,40); R.leased=ri(-2,10); R.at=ri(-1,500); R.rx=ri(-1,500); R.part=(uint8_t)ri(0,1); R.kabs=ri(-1,8);
    int m=ri(0,6); for(int z=0;z<m;z++){ VE e; e.tgt=ri(-1,20); e.up=ri(-2,30); e.dn=ri(-2,9); R.kick.push_back(e); }
    long long now=R.rx+ri(-5,80); int self=ri(-1,20); vector<int> on; kOver(R,now,self,on);
    S+="{\"k\":\"kover\",\"R\":"; digJ(R); S+=",\"now\":"; num(now); S+=",\"self\":"; num(self); S+=",\"out\":"; arr(on,intJ); S+='}'; line(); }
  for(int q=0;q<N;q++){   // nextHopCoord
    Coord c=coordVal(); Coord t=ri(0,9)==0?c:relVal(c); Coord out; bool ok=nextHopCoordF(c,t,out);
    S+="{\"k\":\"nhc\",\"c\":"; coordJ(c); S+=",\"t\":"; coordJ(t); S+=",\"out\":"; coordOrNull(ok,out); S+='}'; line(); }
  return 0; }
