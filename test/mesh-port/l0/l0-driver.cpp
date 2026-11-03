// l0-driver.cpp: the L0 differential driver. Built by l0-build.js against the sim's own source.
// Prints one JSON line per case: the inputs and what the sim's code answers. l0-check.js recomputes every
// answer with js/mesh/* from the inputs alone and compares the JSON text.
//   l0-driver <cases per kind> <seed>
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

static string S;   // the line being written
static void put(const char* s){ S+=s; }
static void num(long long v){ S+=to_string(v); }
static void unum(unsigned long long v){ S+=to_string(v); }
static void boolean(bool v){ S+= v?"true":"false"; }
static void key(const char* k,bool first=false){ if(!first) S+=','; S+='"'; S+=k; S+="\":"; }
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

static mt19937_64 G;   // the driver's own inputs (never part of what is checked)
static uint64_t r64(){ return G(); }
static int ri(int lo,int hi){ return lo+(int)(r64()%(uint64_t)(hi-lo+1)); }   // [lo,hi]

// a value for a 64-bit mix: small, an int (maybe negative, as the sim casts it), a cell key, a tick
static long long mixVal(){ switch(ri(0,4)){ case 0: return ri(-3,300); case 1: return (long long)(int32_t)(uint32_t)r64(); case 2: return (long long)(r64()%(1ull<<48)); case 3: return (long long)(r64()%(1ull<<53)); default: return -(long long)(r64()%(1ull<<40)); } }
static uint32_t pcVal(){ switch(ri(0,3)){ case 0: return 0; case 1: { uint32_t pc=0; int d=ri(1,13); for(int q=0;q<d;q++) pc=childPath(pc,ri(0,C-1)); return pc; } case 2: return (uint32_t)ri(0,2000); default: return (uint32_t)r64(); } }
static Coord coordVal(){ return Coord{pcVal(),(uint8_t)ri(0,C-1),(uint8_t)ri(0,C-1)}; }

static LE leVal(int ids){ LE e; e.id=ri(-1,ids); e.k=ri(-5,40); e.f=(uint8_t)ri(0,7); return e; }
static VE veVal(int ids){ VE v; v.tgt=ri(-1,ids); v.up=ri(-2,9); v.dn=ri(-2,9); return v; }
static KStmt kVal(int ids){ KStmt k; k.voter=ri(-1,ids); k.signer=ri(0,3)?k.voter:ri(-1,ids); k.tn=ri(-1,50); k.ver=ri(-1,6); k.ck=r64()%(1ull<<40);
  k.good=ri(0,4)!=0; k.all=ri(0,5)==0; int n=ri(0,3); for(int q=0;q<n;q++) k.yes.push_back(ri(-1,ids)); n=ri(0,2); for(int q=0;q<n;q++) k.abs.push_back(ri(-1,ids)); return k; }
static Dig digVal(){
  Dig d; int ids=ri(2,24);
  d.n=ri(-2,30); d.refuse=ri(0,5); d.freeC=ri(0,9); d.at=ri(-1,500); d.by=ri(-1,ids); d.dmin=ri(0,1)?99:ri(0,12); d.ag=ri(0,20); d.rx=ri(-1,500); d.part=(uint8_t)ri(0,1);
  d.leased=ri(-2,10); d.handN=ri(-1,20); d.awayN=ri(-1,20);
  int n=ri(0,12); for(int q=0;q<n;q++) d.hands.push_back(leVal(ids));
  n=ri(0,14); for(int q=0;q<n;q++) d.stage.push_back(leVal(ids));
  n=ri(0,6); for(int q=0;q<n;q++) d.apps.push_back(leVal(ids));
  n=ri(0,20); for(int q=0;q<n;q++) d.votes.push_back(veVal(ids));
  n=ri(0,8); for(int q=0;q<n;q++) d.talk.push_back(leVal(ids));
  n=ri(0,3)?0:ri(0,6); for(int q=0;q<n;q++) d.kick.push_back(veVal(ids));
  d.kabs=ri(0,3)?0:ri(-1,6);
  if(ri(0,2)==0) d.kOwn=kVal(ids);
  n=ri(0,2)?0:ri(0,8); for(int q=0;q<n;q++) d.kl.push_back(kVal(ids));
  return d; }

int main(int argc,char** argv){
  const int N=argc>1?atoi(argv[1]):1000; G.seed(argc>2?strtoull(argv[2],0,10):1);
  // ---- hash helpers
  for(int q=0;q<N;q++){
    uint32_t h=(uint32_t)r64(), x=(uint32_t)r64(); long long w=mixVal(); int a=ri(0,(1<<21)-1), b=ri(0,(1<<21)-1);
    S+="{\"k\":\"hash\",\"h\":"; unum(h); S+=",\"x\":"; unum(x); S+=",\"w\":"; num(w); S+=",\"a\":"; num(a); S+=",\"b\":"; num(b);
    S+=",\"out\":{\"fmix32\":"; unum(fmix32(x)); S+=",\"hmix\":"; unum(hmix(h,x)); S+=",\"hmix64\":"; unum(hmix64(h,(uint64_t)w)); S+=",\"idPair\":"; unum(idPair(a,b)); S+="}}"; line(); }
  // ---- topology
  for(int q=0;q<N;q++){
    Coord s=coordVal(); int d=ri(0,C-1);
    S+="{\"k\":\"topo\",\"s\":"; coordJ(s); S+=",\"d\":"; num(d);
    S+=",\"out\":{\"ckey\":"; unum(ckey(s)); S+=",\"childPath\":"; unum(childPath(s.pc,d)); S+=",\"parentPath\":"; unum(parentPath(s.pc));
    S+=",\"pcDepth\":"; num(pcDepth(s.pc)); S+=",\"lastDigit\":"; num(lastDigit(s.pc));
    Coord o; bool ok=up(s,o); S+=",\"up\":"; coordOrNull(ok,o);
    S+=",\"down\":"; coordJ(down(s)); ok=crossLink(s,o); S+=",\"crossLink\":"; coordOrNull(ok,o);
    Coord m[C-1]; rowMates(s,m); S+=",\"rowMates\":["; for(int j=0;j<C-1;j++){ if(j) S+=','; coordJ(m[j]); } S+=']';
    colMates(s,m); S+=",\"colMates\":["; for(int j=0;j<C-1;j++){ if(j) S+=','; coordJ(m[j]); } S+=']';
    Coord ol[MAXLINKS]; int n=ownedLinks(s,ol); S+=",\"ownedLinks\":["; for(int j=0;j<n;j++){ if(j) S+=','; coordJ(ol[j]); } S+="]}}"; line(); }
  // ---- roles: occ(c) = fmix32(low word of ckey ^ salt) % 100 < dens (l0-check.js computes the same)
  for(int q=0;q<N;q++){
    Coord row=coordVal(); row.i=0; uint32_t salt=(uint32_t)r64(); int dens=ri(0,4)==0?100:ri(0,100); Coord s=coordVal();
    auto occ=[&](Coord c){ return fmix32((uint32_t)ckey(c)^salt)%100u<(uint32_t)dens; };
    S+="{\"k\":\"roles\",\"row\":"; coordJ(row); S+=",\"salt\":"; unum(salt); S+=",\"dens\":"; num(dens); S+=",\"s\":"; coordJ(s); S+=",\"out\":{";
    Coord o; bool ok;
    ok=ownerOf(row,o); S+="\"ownerOf\":"; coordOrNull(ok,o);
    ok=heirOf(row,occ,o); S+=",\"heirOf\":"; coordOrNull(ok,o);
    ok=backupOwnerOf(row,occ,o); S+=",\"backupOwnerOf\":"; coordOrNull(ok,o);
    ok=standbyOf(row,occ,o); S+=",\"standbyOf\":"; coordOrNull(ok,o);
    ok=e2SrcOf(row,occ,o); S+=",\"e2SrcOf\":"; coordOrNull(ok,o);
    for(int l2=0;l2<2;l2++){ Coord out[MAXLINKS_E]; uint8_t cls[MAXLINKS_E]; int n=ownedLinksE(s,out,cls,l2!=0);
      S+= l2?",\"ownedLinksE1\":{\"out\":[":",\"ownedLinksE0\":{\"out\":["; for(int j=0;j<n;j++){ if(j) S+=','; coordJ(out[j]); } S+="],\"cls\":["; for(int j=0;j<n;j++){ if(j) S+=','; num(cls[j]); } S+="]}"; }
    S+="}}"; line(); }
  // ---- random streams: the seat's (seeded from its id), the fabric LCGs, mt19937
  for(int q=0;q<N/10+1;q++){
    int id=ri(0,3)?ri(0,20000):ri(0,99999999); RngSeat st(id); uint32_t g0=(uint32_t)r64(), m0=(uint32_t)r64(); int n=ri(1,40);
    S+="{\"k\":\"rng\",\"id\":"; num(id); S+=",\"g0\":"; unum(g0); S+=",\"m0\":"; unum(m0); S+=",\"n\":"; num(n); S+=",\"out\":{\"seed\":"; unum(st.rs);
    S+=",\"seat\":["; for(int j=0;j<n;j++){ if(j) S+=','; char b[40]; snprintf(b,40,"%.17g",st.rng()); S+=b; } S+=']';
    GSEED=g0; S+=",\"lcg\":["; for(int j=0;j<n;j++){ if(j) S+=','; char b[40]; snprintf(b,40,"%.17g",grnd()); S+=b; } S+=']';
    mt19937 mt(m0); int nm=n+(ri(0,3)==0?700:0); S+=",\"mt\":["; for(int j=0;j<nm;j++){ if(j) S+=','; unum(mt()); } S+="]}}"; line(); }
  // ---- digest helpers
  for(int q=0;q<N;q++){
    Dig dst=digVal(); int k=ri(1,4); vector<Dig> in; vector<int> held; for(int j=0;j<k;j++){ in.push_back(digVal()); held.push_back(ri(0,3)==0); }
    S+="{\"k\":\"dig\",\"dst\":"; digJ(dst); S+=",\"in\":"; arr(in,digJ); S+=",\"held\":"; arr(held,intJ);
    for(int j=0;j<k;j++){ if(held[j]) digFoldHeld(dst,in[j]); else digFold(dst,in[j]); }
    S+=",\"out\":{\"fold\":"; digJ(dst); digTrim(dst); S+=",\"trim\":"; digJ(dst); S+=",\"listHash\":"; unum(digListHash(dst)); S+=",\"sig\":"; unum(digSig(dst));
    // the raw helpers on the inputs: listHolds / votesHold (pub = the trimmed fold, mine = an input's lists)
    S+=",\"holdsH\":"; boolean(listHolds(dst.hands,in[0].hands,K_HAND,true)); S+=",\"holdsA\":"; boolean(listHolds(dst.apps,in[0].apps,K_APP,false));
    S+=",\"votesHold\":"; boolean(votesHold(dst.votes,in[0].votes));
    vector<LE> t=in[0].talk; talkMerge(t,dst.talk); S+=",\"talkMerge\":"; arr(t,leJ);
    vector<VE> va=in[0].votes; voteAdd(va,dst.votes); S+=",\"voteAdd\":"; arr(va,veJ);
    S+="}}"; line(); }
  return 0;
}
