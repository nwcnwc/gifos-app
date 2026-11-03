// pclaws-driver.cpp: drives the sim's own pc-lifecycle laws (mesh_link.inc, mesh_linkset_fab.inc, mesh_rcfollow_fab.inc and
// the L18 rungs of mesh.cpp, all in mesh.cpp included whole) from a script on stdin, and prints one JSON line per op: the
// fabric's counters, the whole link table and the law tables after the op, and what the op returned. With MESH_PROOF=<dir>
// the sim's own frames.jsonl / hash.jsonl / --trace come out too. harness/pclaws-check.js runs the same script through
// js/mesh/pclaws.js (with the stand-in physics) and diffs the two. Built by l0/fabric-build.sh against the sim source.
//
// ops (one per line; k=v are Msg fields). Setup:
//   lever NAME VALUE | init N 0 | mk ID | setc ID STATE PC R I | occ ID PC R I OTHER | tick T | seatedat ID T | ctier ID V
//   moving ID V | uplinkof ID X | keep ID PEER TICKS | l22cell ID X PC R I AT | rival ID X AT | callin ID X | callout ID X
//   dialfail ME X PATH | dialgone ME X | dialheard ME X | bare ID PC R I T | word ID X T | work ID X N T | relmark ID X T
//   cousin ID PC R I X | rosterk ID PC R I X | linkset-free ops: sched FROM TO MT CLS [k=v ...]
// Laws:
//   dial | dialjoin | dialup ME X | uptake X H | updecline X H [refer ...] | callframe ME TO MT [k=v] | doordrop | doorhanded ME X
//   doorheard ME X EP | nosock ME G | ltick T | lopen A B | lclose A B FAIL | lhalf A B MASK | lcrash ID | lleave ID
//   l22agree | l22closeask | l22note | l28reply ME X | need ME X | lstate ME X | budget X CLS | l18route A B | l18cell A B
//   l18deliv RTTL | refuse FROM TO MT | l23ref ME FROM MT CK | full ME | stretch ME | end
#define main mesh_main
#include "mesh.cpp"
#undef main
static int mtOf(const string& n){ for(int i=0;i<PROOF_MT_N;i++) if(n==PROOF_MT[i]) return i; fprintf(stderr,"bad MT %s\n",n.c_str()); exit(2); }
static void setField(Msg& m,const string& k,long long v){
  if(k=="id") m.id=(int)v; else if(k=="nc") m.nc=(int)v; else if(k=="tag") m.tag=(uint8_t)v; else if(k=="rvia") m.rvia=(int)v;
  else if(k=="l10E") m.l10E=v; else if(k=="dgOnly") m.dgOnly=v; else if(k=="direct") m.direct=v; else if(k=="routing") m.routing=v;
  else if(k=="gwc") m.gwc=v; else if(k=="knock") m.knock=v; else if(k=="l18") m.l18=v; else if(k=="rttl") m.rttl=(int)v; else if(k=="mv") m.mv=v;
  else if(k=="ck") m.ck=v; else { fprintf(stderr,"bad field %s\n",k.c_str()); exit(2); } }
static Seat* mkSeat(int id){ if(id>=(int)seats.size()){ seats.resize(id+1,nullptr); alive.resize(id+1,0); } seats[id]=new Seat(id); alive[id]=1; if(id>=nextId) nextId=id+1; return seats[id]; }
static string D(long long v){ return to_string(v); }
static string D(const IdP& p){ return D(p.a)+":"+D(p.b); }   // an unpacked id pair, as the JS key "a:b"
static string dump(){
  string s=",\"links\":\"";
  for(auto& kv:LINKS){ Link& L=kv.second; s+=D(kv.first)+"|";
    auto a=[&](long long v){ s+=D(v)+","; };
    a(L.state); a(L.view[0]); a(L.view[1]); a(L.half); a(L.stuck); a(L.leverHalf); a(L.wasOpen); a(L.carried); a(L.epoch); a(L.openEp); a(L.dialAt); a(L.halfAt); a(L.askAt);
    a(L.txAt[0]); a(L.txAt[1]); a(L.nnAt[0]); a(L.nnAt[1]); a(L.nnAsk[0]); a(L.nnAsk[1]); a(L.arrAt[0]); a(L.arrAt[1]);
    s+="q["; for(auto& m:L.q) s+=D(m.t)+"/"+D(m.from)+"/"+D(m.to)+" "; s+="],";
    a(L.outside); a(L.dialBy); a(L.dialT); a(L.dialHow); a(L.callClosed); a(L.gone); a(L.agreed[0]); a(L.agreed[1]);
    for(int e=0;e<2;e++){ s+="h["; for(auto& m:L.hold[e]) s+=D(m.t)+"/"+D(m.from)+"/"+D(m.to)+" "; s+="],"; }
    a(L.closingAt[0]); a(L.closingAt[1]); a(L.farAsk[0]); a(L.farAsk[1]); a(L.uplink); a(L.dHeard); a(L.backAt[0]); a(L.backAt[1]); a(L.dBorn); a(L.dProg);
    a(L.dAsked); a(L.dHomed); a(L.dGw); a(L.dIn); a(L.dSat); a(L.dHoAt); a(L.dWait); a(L.dOwed); a(L.dWaitAtFind); a(L.dOwedAt); s+=";"; }
  s+="\",\"peers\":\""; for(size_t i=0;i<LINKPEERS.size();i++){ s+=D(i)+":"; for(int p:LINKPEERS[i]) s+=D(p)+","; s+=";"; }
  s+="\",\"doorn\":\""; for(int v:DOORN) s+=D(v)+","; s+="\",\"doork\":\""; for(int v:DOORK) s+=D(v)+",";
  s+="\",\"ldoors\":\""; for(const IdP& k:LDOORS) s+=D(k)+",";
  s+="\",\"closing\":\""; for(auto& p:L16CLOSING) s+=D(p.first)+":"+D(p.second)+",";
  s+="\",\"cool\":\""; for(auto& kv:L16COOL) s+=D(kv.first)+":"+D(kv.second.first)+":"+D(kv.second.second)+",";
  s+="\",\"l23s\":\""; for(auto& kv:L23S) s+=D(kv.first)+":"+D(kv.second.until)+":"+D(kv.second.last)+":"+D(kv.second.n)+",";
  s+="\",\"pend\":\""; for(auto& p:DOOR_PEND) s+=D(p.a)+":"+D(p.b)+":"+D(p.at)+",";
  s+="\",\"levq\":\""; for(auto& kv:LEVQ){ s+=D(kv.first)+"{"; for(auto& v:kv.second) s+=D(v.kind)+"/"+D(v.a)+"/"+D(v.b)+"/"+D(v.epoch)+"/"+v.why+"/"+D(v.ref)+" "; s+="}"; }
  s+="\",\"tldeb\":\""; for(auto& kv:TLDEB) s+=D(kv.first)+":"+D(kv.second)+",";
  s+="\",\"lrx\":\""; for(auto v:LRX) s+=D(v)+","; s+="\",\"ltx\":\""; for(auto v:LTX) s+=D(v)+",";
  s+="\",\"lstat\":\""; for(auto v:LSTAT) s+=D(v)+",";
  s+="\",\"ctr\":\""; for(long long v:{(long long)L15_CLOSED,(long long)L16_DROP,(long long)L16_DEFERRED,(long long)L16_PENDDROP,(long long)L16_ANSPEAK,(long long)L16_HANDED,(long long)L16_UNN,(long long)L16_BUSY,(long long)L16_BYE,(long long)L16_IDLEC,(long long)L16_LIFEC,(long long)L16_GWC,(long long)L16_BACKOFF,(long long)L16_DOORPEAK,(long long)L16_EVILPEAK,(long long)L22_CLOSED,(long long)L23_CLOSED,(long long)L23_REFUSED,(long long)L14_REFUSED,(long long)L1611_SHED,(long long)L18_NODIAL,(long long)L18_NOPATH,(long long)L18_SKIPDIRECT,(long long)L18_SKIPFRIEND,(long long)L18_SKIPMASS,(long long)L18_DELIV,(long long)L18_HOPS,(long long)L18_HMAX,(long long)CLOSEDROPS,(long long)ERASEDROPS,(long long)L23PENDT}) s+=D(v)+",";
  s+="\",\"hh\":\""; for(int i=0;i<9;i++) s+=D(L18_HH[i])+",";
  s+="\"";
  return s; }
static void state(const char* op,const char* extra=""){
  printf("{\"op\":\"%s\",\"TICK\":%lld,\"GSEED\":%u,\"FSEED\":%u,\"SEQ\":%llu,\"L10SEQ\":%llu,\"L22SEQ\":%llu,\"nextId\":%d,\"bus\":%zu%s%s}\n",
    op,(long long)TICK,GSEED,FSEED,(unsigned long long)fabric::SEQ,(unsigned long long)L10SEQ,(unsigned long long)L22SEQ,nextId,fabric::bus.size(),extra,dump().c_str()); }
static string B(bool b){ return b?"true":"false"; }
int main(){
  proofInit(NTHREADS);
  const char* tp=getenv("MESH_TRACE_FILE"); if(tp) TRACE_F=fopen(tp,"w");
  char buf[8192];
  while(fgets(buf,sizeof buf,stdin)){
    vector<string> tk; { string cur; for(char c:string(buf)){ if(c==' '||c=='\n'||c=='\r'){ if(!cur.empty()){ tk.push_back(cur); cur.clear(); } } else cur+=c; } if(!cur.empty()) tk.push_back(cur); }
    if(tk.empty()||tk[0][0]=='#') continue;
    const string& op=tk[0]; auto I=[&](size_t k)->long long{ return k<tk.size()?atoll(tk[k].c_str()):0; };
    auto SE=[&](size_t k)->Seat*{ return seats[I(k)]; };
    auto CK=[&](size_t k)->uint64_t{ return ckey({(uint32_t)I(k),(uint8_t)I(k+1),(uint8_t)I(k+2)}); };
    auto FLD=[&](Msg& m,size_t a){ for(;a<tk.size();a++){ size_t e=tk[a].find('='); setField(m,tk[a].substr(0,e),atoll(tk[a].c_str()+e+1)); } };
    if(op=="lever"){ const string& n=tk[1];
      if(n=="NUM_SUBNETS") NUM_SUBNETS=(int)I(2); else if(n=="NET_LOSS") NET_LOSS=atof(tk[2].c_str()); else if(n=="NET_LAT") NET_LAT=(int)I(2); else if(n=="NET_SEVER") NET_SEVER=atof(tk[2].c_str());
      else if(n=="NET_QUAL_MIN") NET_QUAL_MIN=atof(tk[2].c_str()); else if(n=="REACH_DENSITY") REACH_DENSITY=atof(tk[2].c_str()); else if(n=="NET_SPINE") NET_SPINE=(int)I(2);
      else if(n=="SEED0") SEED0=(uint32_t)I(2); else if(n=="LINKMODEL") LINKMODEL=I(2); else if(n=="FHOP_ON") FHOP_ON=I(2)!=0;
      else if(n=="DOORCAP") DOORCAP=(int)I(2); else if(n=="L16_RESERVE") L16_RESERVE=(int)I(2); else if(n=="DOORCAP_MOBILE") DOORCAP_MOBILE=(int)I(2); else if(n=="L16_RESERVE_MOBILE") L16_RESERVE_MOBILE=(int)I(2);
      else if(n=="L16_MOB_RATE") L16_MOB_RATE=(int)I(2); else if(n=="L15_SETTLE") L15_SETTLE=(int)I(2); else if(n=="LMOBILE") LMOBILE=atof(tk[2].c_str()); else if(n=="TIERMIX") TIERMIX=atof(tk[2].c_str());
      else { fprintf(stderr,"bad lever %s\n",n.c_str()); return 2; }
      state("lever"); }
    else if(op=="init"){ initSim((int)I(1),atof(tk[2].c_str())); state("init"); }
    else if(op=="mk"){ mkSeat((int)I(1)); state("mk"); }
    else if(op=="setc"){ Seat* s=SE(1); s->state=(int)I(2); s->hasCoord=true; s->coord={(uint32_t)I(3),(uint8_t)I(4),(uint8_t)I(5)}; state("setc"); }
    else if(op=="occ"){ SE(1)->occ[ckey({(uint32_t)I(2),(uint8_t)I(3),(uint8_t)I(4)})]=(int)I(5); state("occ"); }
    else if(op=="cousin"){ SE(1)->cousins[CK(2)]=(int)I(5); state("cousin"); }
    else if(op=="rosterk"){ KV e; e.k=CK(2); e.v=(int)I(5); SE(1)->roster.push_back(e); state("rosterk"); }
    else if(op=="tick"){ TICK=I(1); state("tick"); }
    else if(op=="seatedat"){ SE(1)->seatedAt=(int)I(2); state("seatedat"); }
    else if(op=="ctier"){ SE(1)->ctier=(uint8_t)I(2); state("ctier"); }
    else if(op=="moving"){ SE(1)->moving=I(2)!=0; state("moving"); }
    else if(op=="uplinkof"){ SE(1)->l14Up=(int)I(2); state("uplinkof"); }
    else if(op=="keep"){ bool d; SE(1)->keepAdd((int)I(2),I(3),d); state("keep"); }
    else if(op=="l22cell"){ SE(1)->l22Cell[(int)I(2)]={CK(3),(long long)I(6)}; state("l22cell"); }
    else if(op=="rival"){ SE(1)->l22Rival[(int)I(2)]=I(3); state("rival"); }
    else if(op=="callin"){ SE(1)->callBook.noteIn((int)I(2),sNow(SE(1))); state("callin"); }
    else if(op=="callout"){ SE(1)->callBook.noteOut((int)I(2),sNow(SE(1))); state("callout"); }
    else if(op=="dialfail"){ SE(1)->dials.failed((int)I(2),sNow(SE(1)),I(3)!=0); state("dialfail"); }
    else if(op=="dialgone"){ SE(1)->dials.holdLost((int)I(2),sNow(SE(1))); state("dialgone"); }
    else if(op=="dialheard"){ SE(1)->dials.heard((int)I(2)); state("dialheard"); }
    else if(op=="bare"){ SE(1)->bareAt[CK(2)]=I(5); state("bare"); }
    else if(op=="word"){ SE(1)->l23WordAt[(int)I(2)]=I(3); state("word"); }
    else if(op=="work"){ SE(1)->l23Work[(int)I(2)]={(int)I(3),(long long)I(4)}; state("work"); }
    else if(op=="relmark"){ SE(1)->relMark[(int)I(2)]=I(3); state("relmark"); }
    else if(op=="sched"){ Msg m; m.t=(MT)mtOf(tk[3]); int cls=(int)I(4); FLD(m,5); schedule((int)I(1),(int)I(2),m,cls); state("sched"); }
    else if(op=="dial"){ fabricDial((int)I(1),(int)I(2)); state("dial"); }
    else if(op=="dialjoin"){ fabricDialJoin((int)I(1),(int)I(2)); state("dialjoin"); }
    else if(op=="dialup"){ vector<int> r; bool b=fabricDialUplink((int)I(1),(int)I(2),&r); state("dialup",(",\"r\":"+B(b)+",\"n\":"+D(r.size())).c_str()); }
    else if(op=="uptake"){ int r=fabricUpTake((int)I(1),(int)I(2)); state("uptake",(",\"r\":"+D(r)).c_str()); }
    else if(op=="updecline"){ vector<int> r; for(size_t k=3;k<tk.size();k++) r.push_back((int)I(k)); fabricUpDecline((int)I(1),(int)I(2),r); state("updecline"); }
    else if(op=="callframe"){ Msg m; m.t=(MT)mtOf(tk[3]); FLD(m,4); fabricCallFrame((int)I(1),(int)I(2),m); state("callframe"); }
    else if(op=="doordrop"){ fabricDoorDrop((int)I(1),(int)I(2)); state("doordrop"); }
    else if(op=="doorhanded"){ fabricDoorHanded((int)I(1),(int)I(2)); state("doorhanded"); }
    else if(op=="doorheard"){ fabricDoorHeard((int)I(1),(int)I(2),(uint32_t)I(3)); state("doorheard"); }
    else if(op=="nosock"){ fabricNoSock((int)I(1),(int)I(2)); state("nosock"); }
    else if(op=="ltick"){ TICK=I(1); linkTick(); state("ltick"); }
    else if(op=="lopen"){ int a=(int)I(1),b=(int)I(2); Link& L=linkGet(a,b); L.epoch++; L.leverHalf=false; LBLOCK.erase(pairKey(a,b)); linkOpenNow(L,a,b); state("lopen"); }
    else if(op=="lclose"){ int a=(int)I(1),b=(int)I(2); Link* L=linkFind(a,b); bool fail=I(3)!=0; if(L && L->state==LK_OPEN) closeBoth(*L,a,b,fail,fail?"failed-persist":"dc-close"); state("lclose"); }
    else if(op=="lhalf"){ int a=(int)I(1),b=(int)I(2); Link* L=linkFind(a,b); if(L && L->state==LK_OPEN){ L->leverHalf=true; linkHalf(*L,a,b,(uint8_t)I(3),false); } state("lhalf"); }
    else if(op=="lcrash"){ crashTransport((int)I(1)); state("lcrash"); }
    else if(op=="lleave"){ fabricLeft((int)I(1)); state("lleave"); }
    else if(op=="l22agree"){ l22Agree((int)I(1),(int)I(2)); state("l22agree"); }
    else if(op=="l22closeask"){ l22CloseAsk((int)I(1),(int)I(2)); state("l22closeask"); }
    else if(op=="l22note"){ l222Note((int)I(1),(int)I(2)); state("l22note"); }
    else if(op=="l28reply"){ l28Reply((int)I(1),(int)I(2)); state("l28reply"); }
    else if(op=="need"){ bool r=l22Need((int)I(1),(int)I(2)); unsigned w=linkWhy((int)I(1),(int)I(2),false); bool q=l22Quiet((int)I(1),(int)I(2)); state("need",(",\"r\":"+B(r)+",\"w\":"+D(w)+",\"q\":"+B(q)).c_str()); }
    else if(op=="lstate"){ state("lstate",(",\"r\":"+D(fabricLinkState((int)I(1),(int)I(2)))+",\"f\":"+D(fabricDialFails((int)I(1),(int)I(2)))+",\"d\":"+D(fabricMyDoors((int)I(1)))+",\"k\":"+D(fabricMyKnocks((int)I(1)))+",\"b\":"+B(fabricL23Busy((int)I(1),(int)I(2)))).c_str()); }
    else if(op=="budget"){ state("budget",(",\"r\":"+D(pcBudget((int)I(1),(int)I(2)))).c_str()); }
    else if(op=="l18route"){ bool r=l18Route((int)I(1),(int)I(2)); state("l18route",(",\"r\":"+B(r)).c_str()); }
    else if(op=="l18cell"){ Coord c{0,0,0}; bool r=l18Cell((int)I(1),(int)I(2),c); state("l18cell",(",\"r\":"+B(r)+",\"c\":\""+(r?coordStr(c):string("-"))+"\"").c_str()); }
    else if(op=="l18deliv"){ Msg m; m.l18=true; m.rttl=(int)I(1); l18Deliv(m); state("l18deliv"); }
    else if(op=="refuse"){ Msg dummy; L16_DEFER=false; bool r=l16Refuse((int)I(1),(int)I(2),mtOf(tk[3])); state("refuse",(",\"r\":"+B(r)+",\"d\":"+B(L16_DEFER)).c_str()); }
    else if(op=="l23ref"){ bool r=l23Refused((int)I(1),(int)I(2),(int)mtOf(tk[3]),(uint64_t)I(4)); state("l23ref",(",\"r\":"+B(r)).c_str()); }
    else if(op=="full"){ state("full",(",\"r\":"+B(l23Full((int)I(1)))+",\"s\":"+D(l23Stretch((int)I(1)))+",\"h\":"+B(l1610Full((int)I(1)))).c_str()); }
    else if(op=="end"){ proofTickEnd(seats,alive,nextId); state("end"); }
    else { fprintf(stderr,"bad op %s\n",op.c_str()); return 2; }
  }
  if(TRACE_F) fclose(TRACE_F);
  return 0; }
