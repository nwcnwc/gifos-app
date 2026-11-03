// fabric-driver.cpp: drives the sim's own fabric (mesh.cpp, included whole) from a script on stdin and prints one
// JSON line per op: the fabric's counters after the op, and what the op returned. With MESH_PROOF=<dir> the sim's
// own frames.jsonl / hash.jsonl / --trace come out too. harness/fabric-check.js runs the same script through
// fabric.js and diffs the two. Built by harness/l0/fabric-build.js against the sim source; nothing is retyped.
//
// ops (one per line, words separated by spaces; k=v are Msg fields):
//   lever NAME VALUE          NUM_SUBNETS NET_LOSS NET_LAT NET_SEVER NET_QUAL_MIN REACH_DENSITY NET_SPINE SEED0 JM_A JM_B JOINMODE
//   init N LEAVE              initSim: prints the spawn plan and the reachability matrix
//   spawnall                  spawn T for every tick of the plan
//   spawn T                   TICK=T; spawnDue(); proofTickEnd (the seats join: the relay knock, the greeter shuffle)
//   mk ID                     a seat that did not join (no frames)
//   setc ID STATE PC R I      state, hasCoord, coord
//   occ ID PC R I OTHER       seat ID believes OTHER sits at the cell
//   tick T                    TICK=T
//   sched FROM TO MT CLS [k=v ...]   schedule(from,to,m,cls)
//   send FROM TO MT [k=v ...]        fabricSend (owned-link and early-frame paths only: no seat code runs)
//   knock ID KEY BLOB         relayKnock
//   force A B UNTIL | sever A B UNTIL | cut ID SIDE | part 0/1 | dark ID | lose T NC | doordark T
//   crash ID                  fabricKill + crashTransport (fireTranslost on the parent fabric)
//   silent FRAC               killFraction(FRAC,"silent")
//   counts                    counts() and DUPS_G
//   coord PC R I              coordStr
//   linkopen A B              fabricLinkOpen
//   end                       proofTickEnd for the current tick
// H2 (link physics, time, net):
//   lever LMOBILE|TIERMIX F | lever CLK_OFF|NET_SKEW|LINKMODEL|NETGRP-less ints   (more levers)
//   tier ID 0|1               TIEROVR[id] = desktop | mobile
//   seatf ID NAME V           ctier l30 seatedAt hostile evilDoor l14Up on seat ID
//   lev WORD ...              the sim's own lever words: link, radio, freeze, tickslow, hide, reloadnew, resume, doordark, verdicts, netgroups, netjoin, netmove, netcut, netlift (printf silenced)
//   lsever A B T | ldark ID   runOp's linkSever / (DARK + linkDark)
//   kill ID | left ID | reloadbye ID    fabricKill(id,-1) | fabricLeft | fabricReloadBye
//   ftick T                   TICK=T; the fabric half of doTick (timeTick, linkTick, netTick, the bus: recvPre, freezeHold; no seat code); held frames of frozen seats are counted ("held") and dropped
//   dial|dialjoin|uplink A B  fabricDial | fabricDialJoin | fabricDialUplink
//   uptake X H | updecline X H R...   fabricUpTake | fabricUpDecline
//   callframe F T MT [k=v]    fabricCallFrame        closedrop MT lk=.. to=..   closedDrop
//   doordrop|doorhanded A B | doorheard ME X EP | nosock ME G | mydoors ME | myknocks ME | l23busy ME X | lstate ME X | lopenfor A B | l22 note|agree|closeask|close|quiet ME X
//   Every state line also carries "lk" (a hash of the whole link table) and "c" (the link/net counters).
#define main mesh_main
#include "mesh.cpp"
#undef main
#include <fcntl.h>
#include <unistd.h>
static int mtOf(const string& n){ for(int i=0;i<PROOF_MT_N;i++) if(n==PROOF_MT[i]) return i; fprintf(stderr,"bad MT %s\n",n.c_str()); exit(2); }
static void setField(Msg& m,const string& k,long long v){
  if(k=="id") m.id=(int)v; else if(k=="nc") m.nc=(int)v; else if(k=="tag") m.tag=(uint8_t)v; else if(k=="rvia") m.rvia=(int)v;
  else if(k=="l10E") m.l10E=v; else if(k=="dgOnly") m.dgOnly=v; else if(k=="direct") m.direct=v; else if(k=="routing") m.routing=v;
  else if(k=="sigAt") m.sigAt=(int)v; else if(k=="pp") m.pp=(int)v; else if(k=="ppAt") m.ppAt=(int)v; else if(k=="swAt") m.swAt=(int)v; else if(k=="ttl") m.ttl=(int)v;
  else if(k=="ck") m.ck=v; else if(k=="lk") m.lk=(int)v; else if(k=="to") m.to=(int)v; else if(k=="from") m.from=(int)v; else if(k=="gwc") m.gwc=v; else if(k=="knock") m.knock=v; else if(k=="mv") m.mv=v; else { fprintf(stderr,"bad field %s\n",k.c_str()); exit(2); } }
static Seat* mkSeat(int id){ if(id>=(int)seats.size()){ seats.resize(id+1,nullptr); alive.resize(id+1,0); } seats[id]=new Seat(id); alive[id]=1; if(id>=nextId) nextId=id+1; return seats[id]; }
static uint32_t hh(uint32_t h,long long v){ h=hmix(h,(uint32_t)v); return hmix(h,(uint32_t)((unsigned long long)v>>32)); }
static uint32_t linkHash(){
  uint32_t h=2166136261u;
  for(auto& kv:LINKS){ const Link& L=kv.second; h=hh(h,kv.first.a); h=hh(h,kv.first.b);
    for(long long v:{(long long)L.state,(long long)L.view[0],(long long)L.view[1],(long long)L.half,(long long)L.stuck,(long long)L.leverHalf,(long long)L.wasOpen,(long long)L.carried,(long long)L.epoch,(long long)L.openEp,L.dialAt,L.halfAt,L.askAt,L.txAt[0],L.txAt[1],L.nnAt[0],L.nnAt[1],L.nnAsk[0],L.nnAsk[1],L.arrAt[0],L.arrAt[1],(long long)L.q.size(),(long long)L.outside,(long long)L.dialBy,(long long)L.callClosed,(long long)L.gone,(long long)L.agreed[0],(long long)L.agreed[1],(long long)L.hold[0].size(),(long long)L.hold[1].size(),L.closingAt[0],L.closingAt[1],L.farAsk[0],L.farAsk[1],(long long)L.uplink,(long long)L.dHeard,L.backAt[0],L.backAt[1],L.dBorn,L.dProg,(long long)L.dAsked,(long long)L.dHomed,(long long)L.dGw,(long long)L.dIn,(long long)L.dSat,L.dHoAt,L.dWait,(long long)L.dOwed,L.dWaitAtFind,L.dOwedAt}) h=hh(h,v); }
  for(int v:DOORN) h=hh(h,v); h=hh(h,-7); for(int v:DOORK) h=hh(h,v);
  h=hh(h,(long long)LDOORS.size()); h=hh(h,(long long)LEVQ.size()); h=hh(h,(long long)LPENDCLOSE.size()); h=hh(h,(long long)TLDEB.size()); h=hh(h,(long long)L16COOL.size()); h=hh(h,(long long)DOOR_PEND.size());
  h=hh(h,(long long)FROZEN.size()); h=hh(h,(long long)SLOW.size()); h=hh(h,(long long)RESUMEQ.size()); h=hh(h,(long long)RELOADQ.size()); h=hh(h,(long long)RELCLOSEQ.size());
  for(auto& e:LEVQ){ h=hh(h,e.first); for(auto& v:e.second){ h=hh(h,v.kind); h=hh(h,v.a); h=hh(h,v.b); h=hh(h,(long long)v.epoch); for(const char* c=v.why;*c;c++) h=hh(h,*c); h=hh(h,v.ref); } }
  for(auto& kv:fabric::sockCloseAt){ h=hh(h,kv.first); h=hh(h,kv.second); }
  return h; }
static string cnt(){
  long long v[]={L16_BUSY,L16_DROP,L16_DEFERRED,L16_PENDDROP,L16_BYE,L16_HANDED,L16_UNN,L16_IDLEC,L16_LIFEC,L16_GWC,L16_BACKOFF,L16_DOORPEAK,L16_ANSPEAK,L15_CLOSED,L22_CLOSED,L23_CLOSED,L23_REFUSED,CLOSEDROPS,ERASEDROPS,L14_REFUSED,LSTAT[0],LSTAT[1],LSTAT[2],LSTAT[3],LSTAT[4],LSTAT[5],LSTAT[6],LSTAT[7],RELAY_KNOCKS,RELAY_SIGNAL,RELAY_NONDOOR,RELAY_REFUSED,RELAY_CUTS,NET_DROPS,KNOCK_PEAK,VALL,VFALSE,VFROZEN,(long long)N,(long long)L18_NODIAL,(long long)DOORDARK};
  string r; for(long long x:v){ if(!r.empty()) r+=","; r+=to_string(x); } return r; }
static void state(const char* op,const char* extra=""){
  printf("{\"op\":\"%s\",\"TICK\":%lld,\"GSEED\":%u,\"FSEED\":%u,\"SEQ\":%llu,\"L10SEQ\":%llu,\"L22SEQ\":%llu,\"nextId\":%d,\"bus\":%zu,\"open\":%zu,\"relay\":%zu,\"gen\":%u,\"emit\":[%lld,%lld,%lld,%lld]%s}\n",
    op,(long long)TICK,GSEED,FSEED,(unsigned long long)fabric::SEQ,(unsigned long long)L10SEQ,(unsigned long long)L22SEQ,nextId,fabric::bus.size(),fabric::openPairs.size(),fabric::relayGreeters.size(),fabric::relayGenesisKey,
    EMIT_NEIGHBOR,EMIT_TELEPORT,EMIT_BOOTSTRAP,EMIT_RELAY,(string(extra)+",\"lk\":"+to_string(linkHash())+",\"c\":["+cnt()+"]").c_str()); }
// silence a lever's printf lines (the check compares the driver's own JSON lines)
template<class F> static void quiet(F f){ fflush(stdout); int sv=dup(1); int nul=open("/dev/null",O_WRONLY); dup2(nul,1); close(nul); f(); fflush(stdout); dup2(sv,1); close(sv); }
int main(){
  proofInit(NTHREADS);
  const char* tp=getenv("MESH_TRACE_FILE"); if(tp) TRACE_F=fopen(tp,"w");
  string line; char buf[8192];
  while(fgets(buf,sizeof buf,stdin)){
    vector<string> tk; { string cur; for(char c:string(buf)){ if(c==' '||c=='\n'||c=='\r'){ if(!cur.empty()){ tk.push_back(cur); cur.clear(); } } else cur+=c; } if(!cur.empty()) tk.push_back(cur); }
    if(tk.empty()||tk[0][0]=='#') continue;
    const string& op=tk[0]; auto I=[&](size_t k)->long long{ return k<tk.size()?atoll(tk[k].c_str()):0; };
    if(op=="lever"){ const string& n=tk[1];
      if(n=="NUM_SUBNETS") NUM_SUBNETS=(int)I(2); else if(n=="NET_LOSS") NET_LOSS=atof(tk[2].c_str()); else if(n=="NET_LAT") NET_LAT=(int)I(2); else if(n=="NET_SEVER") NET_SEVER=atof(tk[2].c_str());
      else if(n=="NET_QUAL_MIN") NET_QUAL_MIN=atof(tk[2].c_str()); else if(n=="REACH_DENSITY") REACH_DENSITY=atof(tk[2].c_str()); else if(n=="NET_SPINE") NET_SPINE=(int)I(2);
      else if(n=="SEED0") SEED0=(uint32_t)I(2); else if(n=="JM_A") JM_A=(int)I(2); else if(n=="JM_B") JM_B=(int)I(2); else if(n=="JOINMODE") JOINMODE=tk[2]; else if(n=="LINKMODEL") LINKMODEL=I(2); else if(n=="ROUTE_ENFORCE") ROUTE_ENFORCE=I(2)!=0; else if(n=="LMOBILE") LMOBILE=atof(tk[2].c_str()); else if(n=="TIERMIX") TIERMIX=atof(tk[2].c_str()); else if(n=="CLK_OFF") CLK_OFF=I(2); else if(n=="NET_SKEW") NET_SKEW=(int)I(2);
      else { fprintf(stderr,"bad lever %s\n",n.c_str()); return 2; }
      state("lever"); }
    else if(op=="init"){ initSim((int)I(1),atof(tk[2].c_str()));
      string x=",\"N\":"+to_string(N)+",\"win\":"+to_string(joinWindow)+",\"maxp\":"+to_string(MAXP)+",\"plan\":[";
      for(size_t t=0;t<spawnPlan.size();t++){ if(spawnPlan[t].empty()) continue; x+="["+to_string(t); for(int k:spawnPlan[t]) x+=","+to_string(k); x+="],"; } if(x.back()==',') x.pop_back(); x+="],\"reach\":[";
      for(auto& r:fabric::reachMx){ x+="\""; for(char c:r) x+=(char)('0'+c); x+="\","; } if(x.back()==',') x.pop_back(); x+="]";
      state("init",x.c_str()); }
    else if(op=="spawn"){ TICK=I(1); spawnDue(); proofTickEnd(seats,alive,nextId); string x=",\"subnets\":["; for(int q=0;q<nextId;q++) if(seats[q]) x+=to_string(seats[q]->subnet)+","; if(x.back()==',') x.pop_back(); x+="],\"qual\":["; for(int q=0;q<nextId;q++) if(seats[q]){ char b[40]; auto r=to_chars(b,b+40,seats[q]->netQual); x+=string(b,r.ptr)+","; } if(x.back()==',') x.pop_back(); x+="]"; state("spawn",x.c_str()); }
    else if(op=="spawnall"){ for(long long t=0;t<(long long)spawnPlan.size();t++){ TICK=t; spawnDue(); proofTickEnd(seats,alive,nextId); } state("spawnall"); }
    else if(op=="mk"){ mkSeat((int)I(1)); state("mk"); }
    else if(op=="setc"){ Seat* s=seats[I(1)]; s->state=(int)I(2); s->hasCoord=true; s->coord={(uint32_t)I(3),(uint8_t)I(4),(uint8_t)I(5)}; state("setc"); }
    else if(op=="occ"){ Seat* s=seats[I(1)]; s->occ[ckey({(uint32_t)I(2),(uint8_t)I(3),(uint8_t)I(4)})]=(int)I(5); state("occ"); }
    else if(op=="tick"){ TICK=I(1); state("tick"); }
    else if(op=="sched"||op=="send"){ Msg m; m.t=(MT)mtOf(tk[3]); size_t a=4; int cls=-1; if(op=="sched"){ cls=(int)I(4); a=5; }
      for(;a<tk.size();a++){ size_t e=tk[a].find('='); setField(m,tk[a].substr(0,e),atoll(tk[a].c_str()+e+1)); }
      if(op=="sched") schedule((int)I(1),(int)I(2),m,cls); else fabricSend((int)I(1),(int)I(2),m); state(op.c_str()); }
    else if(op=="knock"){ relayKnock((int)I(1),(uint32_t)I(2),I(3)!=0); state("knock"); }
    else if(op=="force"){ forcedSever[pairKey((int)I(1),(int)I(2))]=I(3); state("force"); }
    else if(op=="sever"){ fabric::severedUntil[pairKey((int)I(1),(int)I(2))]=I(3); state("sever"); }
    else if(op=="part"){ fabric::PARTITIONED=I(1)!=0; state("part"); }
    else if(op=="cut"){ int id=(int)I(1); if(id>=(int)fabric::partSide.size()) fabric::partSide.resize(id+1,0); fabric::partSide[id]=(char)I(2); state("cut"); }
    else if(op=="dark"){ fabric::DARK.insert((int)I(1)); state("dark"); }
    else if(op=="lose"){ LOSE_T=(int)I(1); LOSE_NC=(int)I(2); state("lose"); }
    else if(op=="doordark"){ DOORDARK=I(1); state("doordark"); }
    else if(op=="crash"){ int id=(int)I(1); fabricKill(id,TICK+SOCK_CLOSE_CRASH); crashTransport(id); state("crash"); }
    else if(op=="silent"){ long long k=killFraction(atof(tk[1].c_str()),"silent"); state("silent",(",\"killed\":"+to_string(k)+",\"N\":"+to_string(N)).c_str()); }
    else if(op=="counts"){ long long s,c; counts(s,c); state("counts",(",\"seated\":"+to_string(s)+",\"s1c\":"+to_string(c)+",\"dups\":"+to_string(DUPS_G)).c_str()); }
    else if(op=="coord"){ Coord c={(uint32_t)I(1),(uint8_t)I(2),(uint8_t)I(3)}; state("coord",(",\"s\":\""+coordStr(c)+"\"").c_str()); }
    else if(op=="linkopen"){ state("linkopen",(string(",\"r\":")+(fabricLinkOpen((int)I(1),(int)I(2))?"true":"false")).c_str()); }
    else if(op=="tier"){ TIEROVR[(int)I(1)]=I(2)?TIER_MOBILE:TIER_DESKTOP; state("tier"); }
    else if(op=="seatf"){ Seat* s=seats[I(1)]; const string& f=tk[2]; long long v=I(3);
      if(f=="ctier") s->ctier=(uint8_t)v; else if(f=="l30") s->l30=v!=0; else if(f=="seatedAt") s->seatedAt=(int)v; else if(f=="hostile") s->hostile=(int)v; else if(f=="evilDoor") s->evilDoor=v!=0; else if(f=="l14Up") s->l14Up=(int)v; else { fprintf(stderr,"bad seatf %s\n",f.c_str()); return 2; }
      state("seatf"); }
    else if(op=="lev"){ vector<string> w(tk.begin()+1,tk.end()); const string& o=w[0];
      quiet([&]{ if(o=="link") linkLever(w); else if(o=="radio") radioLever(w); else if(o=="freeze"||o=="tickslow"||o=="hide"||o=="reloadnew"||o=="resume"||o=="doordark"||o=="verdicts") timeLever(w); else netLever(w); }); state("lev"); }
    else if(op=="lsever"){ linkSever((int)I(1),(int)I(2),I(3)); state("lsever"); }
    else if(op=="ldark"){ int id=(int)I(1); fabric::DARK.insert(id); linkDark(id); state("ldark"); }
    else if(op=="kill"){ fabricKill((int)I(1),-1); state("kill"); }
    else if(op=="left"){ fabricLeft((int)I(1)); state("left"); }
    else if(op=="reloadbye"){ fabricReloadBye((int)I(1)); state("reloadbye"); }
    else if(op=="ftick"){ TICK=I(1); bool tfx=!FROZEN.empty()||!SLOW.empty()||!RELOADQ.empty()||!RESUMEQ.empty()||!RELCLOSEQ.empty();
      if(tfx) timeTick(); if(LINKMODEL) linkTick(); if(NETGRP) netTick();
      auto it=bus.find(TICK);
      if(it!=bus.end()){ for(auto&m:it->second){ if(m.to>=0 && m.to<(int)seats.size() && alive[m.to]){ if(recvPre(m)) continue; if(tfx && isFrozen(m.to)){ freezeHold(m); continue; } } } bus.erase(it); }
      long long held=0; for(auto& kv:FROZEN){ held+=kv.second.q.size(); kv.second.q.clear(); }
      state("ftick",(",\"held\":"+to_string(held)).c_str()); }
    else if(op=="dial"){ fabricDial((int)I(1),(int)I(2)); state("dial"); }
    else if(op=="dialjoin"){ fabricDialJoin((int)I(1),(int)I(2)); state("dialjoin"); }
    else if(op=="uplink"){ vector<int> r; bool b=fabricDialUplink((int)I(1),(int)I(2),&r); state("uplink",(string(",\"r\":")+(b?"true":"false")).c_str()); }
    else if(op=="uptake"){ int r=fabricUpTake((int)I(1),(int)I(2)); state("uptake",(",\"r\":"+to_string(r)).c_str()); }
    else if(op=="updecline"){ vector<int> r; for(size_t a=3;a<tk.size();a++) r.push_back((int)I(a)); fabricUpDecline((int)I(1),(int)I(2),r); state("updecline"); }
    else if(op=="callframe"){ Msg m; m.t=(MT)mtOf(tk[3]); for(size_t a=4;a<tk.size();a++){ size_t e=tk[a].find('='); setField(m,tk[a].substr(0,e),atoll(tk[a].c_str()+e+1)); } fabricCallFrame((int)I(1),(int)I(2),m); state("callframe"); }
    else if(op=="closedrop"){ Msg m; m.t=(MT)mtOf(tk[1]); for(size_t a=2;a<tk.size();a++){ size_t e=tk[a].find('='); setField(m,tk[a].substr(0,e),atoll(tk[a].c_str()+e+1)); } bool r=closedDrop(m); state("closedrop",(string(",\"r\":")+(r?"true":"false")).c_str()); }
    else if(op=="doordrop"){ fabricDoorDrop((int)I(1),(int)I(2)); state("doordrop"); }
    else if(op=="doorhanded"){ fabricDoorHanded((int)I(1),(int)I(2)); state("doorhanded"); }
    else if(op=="doorheard"){ fabricDoorHeard((int)I(1),(int)I(2),(uint32_t)I(3)); state("doorheard"); }
    else if(op=="nosock"){ fabricNoSock((int)I(1),(int)I(2)); state("nosock"); }
    else if(op=="mydoors"){ int a=fabricMyDoors((int)I(1)), b=fabricMyKnocks((int)I(1)); state("mydoors",(",\"r\":["+to_string(a)+","+to_string(b)+"]").c_str()); }
    else if(op=="l23busy"){ bool r=fabricL23Busy((int)I(1),(int)I(2)); state("l23busy",(string(",\"r\":")+(r?"true":"false")).c_str()); }
    else if(op=="lstate"){ int r=fabricLinkState((int)I(1),(int)I(2)); int f=fabricDialFails((int)I(1),(int)I(2)); state("lstate",(",\"r\":["+to_string(r)+","+to_string(f)+"]").c_str()); }
    else if(op=="lopenfor"){ bool r=linkOpenFor((int)I(1),(int)I(2)); state("lopenfor",(string(",\"r\":")+(r?"true":"false")).c_str()); }
    else if(op=="l22"){ const string& w=tk[1]; int a=(int)I(2), b=(int)I(3); string r="";
      if(w=="note") l222Note(a,b); else if(w=="agree") l22Agree(a,b); else if(w=="closeask") l22CloseAsk(a,b); else if(w=="close") l22Close(a,b); else if(w=="quiet") r=string(",\"r\":")+(l22Quiet(a,b)?"true":"false"); else if(w=="release") l22Release(a,b);
      state("l22",r.c_str()); }
    else if(op=="end"){ proofTickEnd(seats,alive,nextId); state("end"); }
    else { fprintf(stderr,"bad op %s\n",op.c_str()); return 2; }
  }
  if(TRACE_F) fclose(TRACE_F);
  return 0; }
