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
#define main mesh_main
#include "mesh.cpp"
#undef main
static int mtOf(const string& n){ for(int i=0;i<PROOF_MT_N;i++) if(n==PROOF_MT[i]) return i; fprintf(stderr,"bad MT %s\n",n.c_str()); exit(2); }
static void setField(Msg& m,const string& k,long long v){
  if(k=="id") m.id=(int)v; else if(k=="nc") m.nc=(int)v; else if(k=="tag") m.tag=(uint8_t)v; else if(k=="rvia") m.rvia=(int)v;
  else if(k=="l10E") m.l10E=v; else if(k=="dgOnly") m.dgOnly=v; else if(k=="direct") m.direct=v; else if(k=="routing") m.routing=v;
  else if(k=="sigAt") m.sigAt=(int)v; else if(k=="pp") m.pp=(int)v; else if(k=="ppAt") m.ppAt=(int)v; else if(k=="swAt") m.swAt=(int)v; else if(k=="ttl") m.ttl=(int)v;
  else if(k=="ck") m.ck=v; else { fprintf(stderr,"bad field %s\n",k.c_str()); exit(2); } }
static Seat* mkSeat(int id){ if(id>=(int)seats.size()){ seats.resize(id+1,nullptr); alive.resize(id+1,0); } seats[id]=new Seat(id); alive[id]=1; if(id>=nextId) nextId=id+1; return seats[id]; }
static void state(const char* op,const char* extra=""){
  printf("{\"op\":\"%s\",\"TICK\":%lld,\"GSEED\":%u,\"FSEED\":%u,\"SEQ\":%llu,\"L10SEQ\":%llu,\"L22SEQ\":%llu,\"nextId\":%d,\"bus\":%zu,\"open\":%zu,\"relay\":%zu,\"gen\":%u,\"emit\":[%lld,%lld,%lld,%lld]%s}\n",
    op,(long long)TICK,GSEED,FSEED,(unsigned long long)fabric::SEQ,(unsigned long long)L10SEQ,(unsigned long long)L22SEQ,nextId,fabric::bus.size(),fabric::openPairs.size(),fabric::relayGreeters.size(),fabric::relayGenesisKey,
    EMIT_NEIGHBOR,EMIT_TELEPORT,EMIT_BOOTSTRAP,EMIT_RELAY,extra); }
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
      else if(n=="SEED0") SEED0=(uint32_t)I(2); else if(n=="JM_A") JM_A=(int)I(2); else if(n=="JM_B") JM_B=(int)I(2); else if(n=="JOINMODE") JOINMODE=tk[2]; else if(n=="LINKMODEL") LINKMODEL=I(2);
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
    else if(op=="end"){ proofTickEnd(seats,alive,nextId); state("end"); }
    else { fprintf(stderr,"bad op %s\n",op.c_str()); return 2; }
  }
  if(TRACE_F) fclose(TRACE_F);
  return 0; }
