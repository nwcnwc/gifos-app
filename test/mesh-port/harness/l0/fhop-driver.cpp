// fhop-driver.cpp: drives the sim's own friend-hop (mesh_fhop.inc, via mesh.cpp included whole) from a script on
// stdin and prints one JSON line per op: what the op returned, what it handed to the link model (the hooks fhop-build.sh
// plants, below), and the whole friend-hop state. harness/fhop-check.js runs the same script through harness/fhop.js
// with the real JS seats and diffs the two.
//
// The link model is the sim's own (mesh_link.inc, real Link structs); three calls out of friend-hop are caught by
// hooks that fhop-build.sh puts into a COPY of mesh_fhop.inc (the sim source is not edited): fhXmit (what is handed
// to linkSchedule), l16Refuse and startDial (called only at the end of fhopSchedule). Every other line is the sim's.
//
// ops: lever NAME V | init N 0 | mk ID | setc ID STATE PC R I | occ ID PC R I OTHER | tick T | alive ID V
//      lk A B STATE V0 V1 HALF HALFAT ASKAT | want A X T | claim ME R list... | fnat ME R N | crumb ME PID VIA T
//      seen ME ID T | job R T Q AT | fpeer S T DOWN ASK VIA CLAIM | refuse S T R AT | netg TYPE ISO | seatgrp ID G
//      dialfail ME X | l16ret 0|1 | sponsor FROM TO MT [k=v] | fsched FROM TO MT [k=v] | drop FROM TO MT [k=v]
//      icpt TO FROM MT [k=v] | ftick | friend ME TO | unreach ME X | free PC R | webkit ID | dump
#define main mesh_main
#include "mesh.cpp"
#undef main
static int mtOf(const string& n){ for(int i=0;i<PROOF_MT_N;i++) if(n==PROOF_MT[i]) return i; fprintf(stderr,"bad MT %s\n",n.c_str()); exit(2); }
static void setField(Msg& m,const string& k,long long v){
  if(k=="id") m.id=(int)v; else if(k=="nc") m.nc=(int)v; else if(k=="tag") m.tag=(uint8_t)v; else if(k=="rvia") m.rvia=(int)v;
  else if(k=="routing") m.routing=v; else if(k=="gwc") m.gwc=v; else if(k=="mv") m.mv=v; else if(k=="asker") m.asker=(int)v; else if(k=="via") m.via=(int)v;
  else if(k=="fhTo") m.fhTo=(int)v; else if(k=="fhOrig") m.fhOrig=(int)v; else if(k=="fhTtl") m.fhTtl=(int)v; else if(k=="fhId") m.fhId=v; else if(k=="fhTc") m.fhTc=v;
  else if(k=="rttl") m.rttl=(int)v; else if(k=="rfinal") m.rfinal=(int)v; else if(k=="lk") m.lk=(int)v; else if(k=="from") m.from=(int)v; else if(k=="to") m.to=(int)v;
  else if(k=="rdst") m.rdst=unck((uint64_t)v);
  else { fprintf(stderr,"bad field %s\n",k.c_str()); exit(2); } }
static string mdig(const Msg& m){ char b[400]; snprintf(b,400,"[%d,%d,%d,%d,%d,%d,%d,%d,%lld,%lld,%d,%d,%d,%d,%d,%lld,%d]",(int)m.t,m.from,m.to,m.id,m.nc,m.fhTo,m.fhOrig,m.fhTtl,(long long)m.fhId,(long long)m.fhTc,m.rttl,m.rvia,m.rfinal,(int)m.routing,m.lk,(long long)m.tx,(int)m.tag); return b; }
static string LOG; static int L16RET=0;
static void logAdd(const string& s){ if(!LOG.empty()) LOG+=","; LOG+="\""+s+"\""; }
static void hookX(int me,int p,const Msg& env){ logAdd("X "+to_string(me)+" "+to_string(p)+" "+mdig(env)); }
static int hookL16(int from,int to,int mt){ logAdd("L16 "+to_string(from)+" "+to_string(to)+" "+to_string(mt)); return L16RET; }
static void hookDial(int a,int b,Link& L){ logAdd("D "+to_string(a)+" "+to_string(b)); L.state=LK_DIALING; L.view[lEnd(a,b)]=LK_DIALING; }
static Seat* mkSeat(int id){ if(id>=(int)seats.size()){ seats.resize(id+1,nullptr); alive.resize(id+1,0); } seats[id]=new Seat(id); alive[id]=1; if(id>=nextId) nextId=id+1; return seats[id]; }
static string lst(const vector<int>& v){ string s="["; for(size_t i=0;i<v.size();i++){ if(i) s+=","; s+=to_string(v[i]); } return s+"]"; }
static string dump(){
  string s="{\"seq\":"+to_string(FH_SEQ)+",\"S\":["; for(int i=0;i<16;i++){ if(i) s+=","; s+=to_string(FHS[i]); } s+="],\"M\":["; for(int i=0;i<8;i++){ if(i) s+=","; s+=to_string(FHM[i]); }
  s+="],\"MQ\":["; { bool f=true; for(auto& e:FHMQ){ if(!f) s+=","; f=false; s+="["+to_string(e.first)+",["; for(size_t i=0;i<e.second.size();i++){ auto& x=e.second[i]; if(i) s+=","; s+="["+to_string(x.kind)+","+to_string(x.from)+","+to_string(x.to)+","+to_string(x.target)+"]"; } s+="]]"; } }
  s+="],\"GQ\":["; { bool f=true; for(auto& e:FHGQ){ if(!f) s+=","; f=false; s+="["+to_string(e.first)+",["; for(size_t i=0;i<e.second.size();i++){ auto& x=e.second[i]; if(i) s+=","; s+="["+to_string(get<0>(x))+","+to_string(get<1>(x))+","+lst(*get<2>(x))+"]"; } s+="]]"; } }
  s+="],\"F\":["; bool first=true;
  for(size_t i=0;i<FH.size();i++){ FhSeat& F=FH[i];
    if(F.conns.empty()&&F.nat.empty()&&!F.sentOk&&F.crumb.empty()&&F.seen.empty()&&F.lane.empty()&&F.peer.empty()&&F.jobs.empty()&&F.want.empty()&&F.unlinked.empty()) continue;
    if(!first) s+=","; first=false; s+="["+to_string(i)+",{\"c\":[";
    { bool f=true; for(auto& e:F.conns){ if(!f) s+=","; f=false; s+="["+to_string(e.first)+","+lst(*e.second)+"]"; } }
    s+="],\"n\":["; { bool f=true; for(auto& e:F.nat){ if(!f) s+=","; f=false; s+="["+to_string(e.first)+","+to_string(e.second)+"]"; } }
    s+="],\"sent\":"+(F.sentOk? (F.sent? lst(*F.sent):string("null")) : string("false"))+",\"cr\":["; { bool f=true; for(auto& e:F.crumb){ if(!f) s+=","; f=false; s+="["+to_string(e.first)+","+to_string(e.second.first)+","+to_string(e.second.second)+"]"; } }
    s+="],\"se\":["; { bool f=true; for(auto& e:F.seen){ if(!f) s+=","; f=false; s+="["+to_string(e.first)+","+to_string(e.second)+"]"; } }
    s+="],\"la\":["; { bool f=true; for(auto& e:F.lane){ if(!f) s+=","; f=false; s+="[\""+to_string(e.first.a)+":"+to_string(e.first.b)+"\","+to_string(e.second)+"]"; } }
    s+="],\"pe\":["; { bool f=true; for(auto& e:F.peer){ if(!f) s+=","; f=false; const FhPeer& P=e.second; s+="["+to_string(e.first)+","+to_string(P.downSince)+","+to_string(P.askAt)+","+to_string(P.via)+","+to_string(P.claimAt)+",["; bool g=true; vector<pair<int,long long>> rf; for(auto& r:P.refused) rf.push_back({r.first,r.second}); sort(rf.begin(),rf.end()); for(auto& r:rf){ if(!g) s+=","; g=false; s+="["+to_string(r.first)+","+to_string(r.second)+"]"; } s+="]]"; } }
    s+="],\"jo\":["; for(size_t k=0;k<F.jobs.size();k++){ if(k) s+=","; s+="["+to_string(F.jobs[k].target)+","+to_string(F.jobs[k].req)+","+to_string(F.jobs[k].at)+"]"; }
    s+="],\"wa\":["; { bool f=true; for(auto& e:F.want){ if(!f) s+=","; f=false; s+="["+to_string(e.first)+","+to_string(e.second)+"]"; } }
    s+="],\"ul\":["; { bool f=true; for(auto& e:F.unlinked){ if(!f) s+=","; f=false; s+="["+to_string(e.first)+","+to_string(e.second)+"]"; } }
    s+="]}]"; }
  s+="],\"links\":["; { vector<pair<IdP,Link*>> ls; for(auto& e:LINKS) ls.push_back({e.first,&e.second}); sort(ls.begin(),ls.end()); bool f=true; for(auto& e:ls){ if(!f) s+=","; f=false; Link& L=*e.second; s+="[\""+to_string(e.first.a)+":"+to_string(e.first.b)+"\","+to_string(L.state)+","+to_string((int)L.view[0])+","+to_string((int)L.view[1])+","+to_string((int)L.half)+","+to_string(L.halfAt)+","+to_string(L.askAt)+"]"; } }
  s+="],\"peers\":["; for(int i=0;i<nextId;i++){ if(i) s+=","; s+=lst(i<(int)LINKPEERS.size()?LINKPEERS[i]:vector<int>()); } s+="]}"; return s; }
static void out(const char* op,const string& r){ printf("{\"op\":\"%s\",\"r\":%s,\"log\":[%s],\"d\":%s}\n",op,r.c_str(),LOG.c_str(),dump().c_str()); LOG.clear(); }
int main(){
  setvbuf(stdout,nullptr,_IOLBF,0); proofInit(NTHREADS); fhXmitHook=hookX; fhL16Hook=hookL16; fhDialHook=hookDial;
  char buf[8192];
  while(fgets(buf,sizeof buf,stdin)){
    vector<string> tk; { string cur; for(char c:string(buf)){ if(c==' '||c=='\n'||c=='\r'){ if(!cur.empty()){ tk.push_back(cur); cur.clear(); } } else cur+=c; } if(!cur.empty()) tk.push_back(cur); }
    if(tk.empty()||tk[0][0]=='#') continue;
    const string& op=tk[0]; auto I=[&](size_t k)->long long{ return k<tk.size()?atoll(tk[k].c_str()):0; };
    auto msgOf=[&](size_t mt,size_t a)->Msg{ Msg m; m.t=(MT)mtOf(tk[mt]); for(;a<tk.size();a++){ size_t e=tk[a].find('='); setField(m,tk[a].substr(0,e),atoll(tk[a].c_str()+e+1)); } return m; };
    if(op=="lever"){ const string& n=tk[1];
      if(n=="LINKMODEL") LINKMODEL=I(2); else if(n=="NETGRP") NETGRP=I(2)!=0; else if(n=="NUM_SUBNETS") NUM_SUBNETS=(int)I(2); else if(n=="SEED0") SEED0=(uint32_t)I(2);
      else if(n=="FH_WEBKIT") FH_WEBKIT=atof(tk[2].c_str()); else if(n=="FHOP_ON") FHOP_ON=I(2)!=0; else { fprintf(stderr,"bad lever %s\n",n.c_str()); return 2; }
      out("lever","0"); }
    else if(op=="init"){ initSim((int)I(1),atof(tk[2].c_str())); out("init","0"); }
    else if(op=="mk"){ mkSeat((int)I(1)); out("mk","0"); }
    else if(op=="setc"){ Seat* s=seats[I(1)]; s->state=(int)I(2); s->hasCoord=true; s->coord={(uint32_t)I(3),(uint8_t)I(4),(uint8_t)I(5)}; out("setc","0"); }
    else if(op=="occ"){ Seat* s=seats[I(1)]; s->occ[ckey({(uint32_t)I(2),(uint8_t)I(3),(uint8_t)I(4)})]=(int)I(5); out("occ","0"); }
    else if(op=="tick"){ TICK=I(1); out("tick","0"); }
    else if(op=="alive"){ alive[I(1)]=(char)I(2); out("alive","0"); }
    else if(op=="lk"){ Link& L=linkGet((int)I(1),(int)I(2)); L.state=(int)I(3); L.view[0]=(int)I(4); L.view[1]=(int)I(5); L.half=(int)I(6); L.halfAt=I(7); L.askAt=I(8); out("lk","0"); }
    else if(op=="want"){ fhEnsure(); FH[I(1)].want[(int)I(2)]=I(3); out("want","0"); }
    else if(op=="claim"){ fhEnsure(); vector<int> v; for(size_t k=3;k<tk.size();k++) v.push_back((int)I(k)); FH[I(1)].conns[(int)I(2)]=make_shared<const vector<int>>(v); out("claim","0"); }
    else if(op=="fnat"){ fhEnsure(); FH[I(1)].nat[(int)I(2)]=(int)I(3); out("fnat","0"); }
    else if(op=="crumb"){ fhEnsure(); FH[I(1)].crumb[(int)I(2)]={(int)I(3),I(4)}; out("crumb","0"); }
    else if(op=="seen"){ fhEnsure(); FH[I(1)].seen[(uint64_t)I(2)]=I(3); out("seen","0"); }
    else if(op=="job"){ fhEnsure(); FH[I(1)].jobs.push_back({(int)I(2),(int)I(3),I(4)}); out("job","0"); }
    else if(op=="fpeer"){ fhEnsure(); FhPeer& P=FH[I(1)].peer[(int)I(2)]; P.downSince=I(3); P.askAt=I(4); P.via=(int)I(5); P.claimAt=I(6); out("fpeer","0"); }
    else if(op=="refuse"){ fhEnsure(); FH[I(1)].peer[(int)I(2)].refused[(int)I(3)]=I(4); out("refuse","0"); }
    else if(op=="netg"){ NETG.push_back({"g"+to_string(NETG.size()),(int)I(1),0,I(2)!=0}); out("netg","0"); }
    else if(op=="seatgrp"){ int id=(int)I(1); if(id>=(int)SEATGRP.size()) SEATGRP.resize(id+1,-1); SEATGRP[id]=(int)I(2); out("seatgrp","0"); }
    else if(op=="dialfail"){ seats[I(1)]->dials.failed((int)I(2),TICK,false); out("dialfail","0"); }
    else if(op=="l16ret"){ L16RET=(int)I(1); out("l16ret","0"); }
    else if(op=="sponsor"){ fhEnsure(); Msg m=msgOf(3,4); bool r=fhopSponsor((int)I(1),(int)I(2),m); out("sponsor",r?"true":"false"); }
    else if(op=="fsched"){ Msg m=msgOf(3,4); bool r=fhopSchedule((int)I(1),(int)I(2),m); out("fsched",r?"true":"false"); }
    else if(op=="drop"){ Msg m=msgOf(3,4); bool r=fhopSponsorDrop((int)I(1),(int)I(2),m); out("drop",r?"true":"false"); }
    else if(op=="icpt"){ fhEnsure(); Msg m=msgOf(3,4); m.to=(int)I(1); m.from=(int)I(2); bool r=fhopIntercept(m); out("icpt",(string("[")+(r?"true":"false")+","+mdig(m)+"]").c_str()); }
    else if(op=="ftick"){ fhopTick(); out("ftick","0"); }
    else if(op=="friend"){ bool r=fhopFriendFor((int)I(1),(int)I(2)); out("friend",r?"true":"false"); }
    else if(op=="unreach"){ bool r=fabricUnreachable((int)I(1),(int)I(2)); out("unreach",r?"true":"false"); }
    else if(op=="free"){ out("free",to_string(fabricFreeCells((uint32_t)I(1),(int)I(2))).c_str()); }
    else if(op=="webkit"){ out("webkit",fhWebkit((int)I(1))?"true":"false"); }
    else if(op=="dump"){ out("dump","0"); }
    else { fprintf(stderr,"bad op %s\n",op.c_str()); return 2; }
  }
  return 0; }
