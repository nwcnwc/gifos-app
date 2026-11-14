/*
 * laws.js: the mesh's shared constants (ticks unless noted).
 * GENERATED from the constants source: do not edit by hand.
 * A *_PER_C entry is multiplied by C, the seats per row.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  GifOS.meshLaws = Object.freeze({
    ASK_GAP: 2,                  // A greeter asked again sooner than this (two ticks, under one second) is a burst: the newcomer's second ask waits the long time. A gap of this or more asks again one tick past L7_HOLD.
    CHAN_UP: 32,                 // a channel counts as up only while its proof is this fresh
    CHILD_LEDGER_H: 300,         // no child-row ledger this long means an unheard child cell is an echo
    COMPACT_PERIOD: 90,          // Q2: min ticks between one leaf's compaction probes
    COMPACT_SETTLE: 300,         // Q2: quiet window before compaction stirs the tree
    COMPACT_TTL: 30,             // Q2: hop budget for a compaction probe
    CONFIRM_TTL: 16,             // law T: a mover's claim window before it confirms
    DARK_ASK_FRESH: 60,          // ...while the latest ask to it is at most this old
    DARK_LEAVE: 60,              // D6: no owned link carrying a channel this long, a seat vacates and re-joins
    DARK_WAIT: 6,                // a greeter asked WHOHOME that has not answered this long is dark (FIND's dark list)
    DIG_HOLD_LEVEL: 16,          // G: handover hold, two pulse periods per tree level
    DIG_LOSS_H: 300,             // G3: the fail-closed blur horizon (spans RING_HOLD)
    DIG_TTL: 60,                 // G3: a digest report older than this is stale
    DOORCALL_HOLD: 108,          // FHOP.8: a friend called to the door stays a greeter this long: the rounds a knocker still has before it founds, (ISLAND_ASKS + 1) x (ISLAND_WAIT + the door's ask wave of 12)
    E3_PERIOD: 200,              // Section-1 re-knock cadence; below RELAY_TTL so live seats stay listed
    EARLY_HOLD: 12,              // D5: settle window a transport-death probe gets before the death is confirmed
    FHOP_BEAT: 8,                // FHOP: the status beat that carries a seat's conns list (SCALE.HB 4 s)
    FHOP_CARRY_MAX: 12,          // FHOP.9: carries one friend runs at once, video or voice only: every carry one full row can ask of one mate, (C-1) x (C-2)
    FHOP_CRUMB_TTL: 120,         // FHOP: a crumb (the channel a peer's frames came in on) and an envelope dedup entry live this long (60 s)
    FHOP_MAX_JOBS: 4,            // FHOP: carries with video one friend on Wi-Fi (or an unknown link) runs at once; past it a carry is voice only (FHOP.9)
    FHOP_REFUSE_HOLD: 60,        // FHOP: a friend that refused a relay is not asked again for this long (30 s)
    FHOP_RELAY_ASK: 13,          // FHOP: the direct verdict. A peer's direct pair down this long before a friend is asked, and the gap between asks. Depends on: the offer and answer over the relay, then the answered dial's clock (LINK_DIAL_ICE)
    FHOP_SWEEP: 4,               // FHOP: the page's 2 s sweep that asks a friend to forward a peer's media
    FHOP_TTL: 12,                // FHOP: a friend-hop envelope's hop budget (run.html sponsorSend ttl 12)
    FHOP_VIDEO_CELL: 2,          // FHOP.9: carries with video a friend on a cellular link runs at once
    FHOP_VIDEO_WIRED: 8,         // FHOP.9: carries with video a friend on a wired link runs at once
    FH_ICE_N: 3,                 // FHOP typing: a link is unreachable, not a blip, once this many of my dials to it went nowhere while both NAT kinds are known and cannot meet; until then friend-hop carries the pair and no law moves or drops a seat for it
    FIND_ACK_WAIT: 12,           // a seeker re-asks when its FIND has no FINDACK after this long
    FIND_TTL: 200,               // an honest seeker's FIND hop budget; every FIND is clamped to it
    FRESH: 60,                   // S5: a seat is fresh this long after it took its cell or regained its neighbours
    HEAD_HEIR_WAIT: 40,          // a row-mate past column 1 leaves a confirmed-dead head to its own healer this long (H2 backstop)
    HELD_BEATS: 24,              // three rook beats: the occupant is answering right now
    HELLO_BACK: 20,              // ticks between HELLOs answering one unheard greeter
    ISLAND_ASKS: 2,              // L8.1.1: silent rounds at the door before a joiner founds an island: the first silent round knocks again (a member that re-seated or re-registered since the first list is named now); only the second silent round founds
    ISLAND_WAIT: 24,             // L8.1: ticks after a joiner asked every listed greeter with no HOME back before it founds an island
    ISLAND_WAIT_BLOCKED: 13,     // L8.47.1: the silence wait of a joiner whose own network verdict is blocked, in place of ISLAND_WAIT. Depends on: one answered dial's verdict (the offer and the answer over the relay, then LINK_DIAL_ICE)
    KICK_AUD_EVERY: 2,           // L27.9: a seat that folds vote lists runs one spot audit per this many pulses (a hash draw), alternating an entry of a child's list and a seat of its scope
    KICK_AUD_GRACE: 120,         // L27.9: a voter's statement this old (signing time) should be in every list above it: an audit that finds it missing or contradicted counts against the child
    KICK_AUD_WAIT: 24,           // L27.9: an audited voter that has not answered in this long counts as unanswered (weak evidence against the child that listed it)
    KICK_CONF_EVERY: 6,          // L27.10: a row-mate whose head's fold votes off the row's E2 source asks the backup owner and the standby (named by that head) for their own fold this often, until one of them confirms
    KICK_EVID: 2,                // L27.12: hard audit evidence against one aggregator (a forged or out-of-scope entry in its own report, an entry claiming its own cell, a listed voter that the real holder of its cell disproves) at this count makes it a suspect: its vote lists are dropped from the fold
    KICK_EVID_FORGET: 720,       // L27.12: hard evidence against an aggregator older than this with nothing newer is forgotten (the count starts again)
    KICK_HOLD: 24,               // L27: a voted-off seat's cells are healed this long after the seat's own verdict, so neighbours whose fold is a beat behind do not defend the cell for it
    KICK_LIFT: 120,              // L27: a seat lets a voted-off target back only after its complete folds have shown the majority gone this long (a voter's move or requeue, which keeps its vote out of the fold for up to ~100 ticks, is no withdrawal)
    KICK_SEAT: 16,               // L27: a voter's statement counts only once the folding seat has held it at that cell this long (two beats): a phone cannot seat itself and vote in one breath
    KNOCK_FRESH: 40,             // a FIND from x within this long means x is knocking (split-off guard)
    K_APP: 3,                    // digest list cap: apps
    K_HAND: 8,                   // digest list cap: raised hands
    K_STAGE_PER_C: 2,            // digest list cap: stage entries, two per seat in a row
    K_VOTE: 16,                  // digest list cap: votes
    L10_BUCKET_BURST: 2,         // L10: a receiver accepts this many state messages in a burst from one sender per state class
    L10_BUCKET_REFILL: 2,        // L10: a receiver refills one state-message token per sender per class every this many ticks (1 per second)
    L10_EARLY_GAP: 2,            // L10: a seat sends a state message early (its content changed) at most once per this many ticks (1 s); an early send resets the regular beat
    L10_NEW_WAIT: 16,            // L10: a report from a seat new at that cell is passed up early only after this many ticks (a mover's old cell has been vacated by then: it is not counted twice)
    L11_ARRIVE: 32,              // L11: a seat that took its cell less than this long ago is an ARRIVAL: a live rival holder of its cell heard first-hand wins over it at once (two claim windows: a move's claim and the witness's answer)
    L13_CHAIN_MAX: 6,            // L13.15: a mass-leave witness chain holds this many cells (owner, its witness, ...): enough to reach the home cell from depth 4
    L16_17_DOOR: 10,             // L16.17: a seat outside Section 1 that admits a seeker holds its door socket this long (the longest dial: the offer, the answer and the candidates of the pc to the seat it placed cross on the relay; without a socket they walk up the tree and back)
    L29_ACCUSE: 120,             // L29.4: a receiver complains (signed, to the seat itself) only after the seat's own feed has starved this long (a minute): longer than the ladder takes to shed and to move
    L29_ASK_T: 8,                // L29.1: a seat that has shed both classes this long asks its row head to move it to a cell that carries less (one beat)
    L29_BEAT: 16,                // L29.3: a light seat repeats its word to its head this often (two beats); the head forgets the word after three of these
    L29_BUD_D: 60,               // L29.1: a desktop's media budget in load units (a hot copy to one seat costs L29_HOT, a parked copy L29_PARK): the device can carry this much and no more
    L29_BUD_M: 40,               // L29.1: a mobile's media budget in load units (two thirds of a desktop's): it carries any cell whole with its tenth of headroom, a Section-1 cell (own camera to 8 rook peers, their flood, a down feed, a parked copy: 35-36) included, but for a full Section-1 head: that one sheds to 33 and asks to swap
    L29_CALM: 16,                // L29.1: ...for this long (two beats); and a seat that moved for load is light again only after twice this long at its full budget
    L29_HOT: 2,                  // L29.1: the load of one hot copy to one seat: a seat's own camera to a receiver costs this; a forward costs one for its high-priority part (the stage) and one for its low-priority part (the stadium, the gallery mix)
    L29_PARK: 1,                 // L29.1: the load of one parked copy (a backup held ready); a parked copy woken by its receiver costs L29_HOT
    L29_QMIN: 2,                 // L29.4: the fewest complainants that can ever agree: max(L29_QMIN, w/2+1) of the w seats a seat serves, never one
    L29_RECOVER: 90,             // L29.1: a light seat whose budget is back at this percent of its device's full budget (for twice L29_CALM) stops asking to be kept light
    L29_REPEAT: 16,              // L29.4: a receiver repeats its complaint this often while the starve lasts
    L29_RESTORE: 75,             // L29.1: a shed class comes back only when the load with it would be at most this percent of the budget...
    L29_SHED: 90,                // L29.1: a seat sheds the next class of duties as soon as its load at the current level passes this percent of its budget (before it fails: the remaining tenth is headroom)
    L29_STARVE: 4,               // L29.4: a receiver whose feed from a seat has stopped this long while the link to it lives reads a starve (the one-pipe watchdog's L2_PROMOTE)
    L29_WIN: 48,                 // L29.4: a complaint counts this long after its signing (three repeats)
    L2_PARK: 20,                 // L2.7: E2 parks again this long after E1 returns
    L2_PROMOTE: 4,               // L2.4 / sim plan 4.6: a parked media copy wakes this long after the hot copy stops (one-pipe law); also the heir takeover bar
    L30_BEAT: 4,                 // L30.4: a Section-1 seat in small mode beats its rook every this many ticks (2 s) instead of 8: 25 seats on 8 links each is a small load, and news crosses the two hops in half the time
    L30_DISC_DEAD: 170,          // L30.2: in a Section-1-only room the page's disconnected-persist lands this long after a silent cut (the pc reads disconnected at 12-16, then 78 s): 20 ticks past the longest freeze the chaos laws grant (150), 26 sooner than the big room's 196
    L30_ENTER: 64,               // L30.1: a Section-1 seat enters small mode after sitting this long (eight beats) with no sign of a row below Section 1
    L30_FRESH: 12,               // L30.5: a seat judges a silent mate only while it heard some other mate this recently (one big beat and its delivery); one that heard none is the one cut off and judges nobody until every mate had a whole silence window after it hears again
    L30_QUIET: 240,              // L30.1: hysteresis: after the last sign of a row below Section 1 a seat stays out of small mode this long (2 min), so a room at 25-26 seats changes mode at most once each way per window
    L30_SILENT: 24,              // L30.5: in small mode a rook mate unheard first-hand this long (12 s: six small beats, three big ones, with a tick or two of delivery and pacing each) is a transport loss to probe across the rook; a seat that hears none of its mates judges nobody
    L31_ACK_WAIT: 8,             // L31.4: a small room's direct placement waits this long (4 s, two dials) for the assent of the cell's designated admitter; without it the newcomer takes the parent's path, so a silently dead admitter keeps its ring hold
    L31_COMMIT: 2,               // L31.4: a direct placement in a small room is a proposal for this long (1 s: a record crosses Section 1 in at most two hops) before it commits, so two greeters that picked one free cell see each other first
    L31_REC_HOLD: 20,            // L31.4: a rook seat that accepted a greeter's placement record for a free cell holds that cell for its seeker this long (10 s, past the slowest mobile dial) against any later record, so the earlier placement stands
    L4_ENTRY_N: 2,               // L4.6: this many different seekers on my FINDs inside L4_ENTRY_T read as a mass entry
    L4_ENTRY_T: 16,              // L4.6: the window of the mass-entry sense, and so how long it outlasts the last seeker
    L4_HOPS: 5,                  // L4.2: tier and NAT hops a FIND takes (to a row-mate's child row) looking for a cell that suits its seeker before it takes the one in hand
    L4_LEAD: 10,                 // L4.3: the head sets the exchange tick this far ahead, past the pair's greeting round trip (a dial of up to 10 ticks)
    L4_PERIOD: 16,               // L4.3: min ticks from one tier swap of a row to the next order for it
    L4_QUIET: 16,                // L4.3: a row with no arrival, departure or move for this long is quiet enough for a tier swap
    L50_HOPS: 60,                // L50.2: hops an ask may spend, as every routed call: its own row hands it on once, every other seat passes it one hop toward the named cell
    L5_PERIOD: 8,                // L9.11: and again every beat while a home cell is free; the home row head seats one probe per free cell, no period
    L5_SETTLE: 16,               // L9.11: in a room of at most 25, a deep seat probes for a home cell once its neighbourhood has been quiet this long (two beats), not COMPACT_SETTLE
    L7_HOLD: 24,                 // L7.5: an admitter holds a seeker's FIND it cannot serve yet (its frontier row settling, a row ledger on its way) this long, serving it the tick the cell opens; past it the seeker is told NOROOM
    L9_ACK_WAIT: 6,              // L9.3: a headless row's arbiter waits at most this long after the head left for its E2 ack (one round trip: the ack carries the owner's death)
    L9_KID_WAIT: 12,             // L9.3: a head cell whose goodbye named a down-child is the vertical healer's while that child row's E2 source beats its backup owner this recently (a beat and a half)
    L9_LONE: 16,                 // L50.1: a seat that sat this long without hearing its anchor (head, or owner) asks for its link up over every link it holds (two beats: a beat, and the longest dial)
    L9_PULL: 8,                  // L9.12: a home row head pulls deep leaves into its row's free home cells once per this many ticks (a beat: the home sync that names the kidful cells runs at it)
    L9_RETRY: 16,                // L9.3: a headless row's arbiter names the head cell's filler again after this long when the cell is still empty
    LEASE_ARM: 16,               // L3.2: an owned-link occupant silent this long is leased: it keeps its cell until LEASE_T, never a hole
    LEASE_T: 220,                // L3.4: the lease: a leased occupant unheard on every path this long is a hole for its one mover. Defined from the page's quiet horizon: disconnected-persist lands 196 ticks after a silent cut (measured 97-101 s), the re-dial it starts carries its queued frame within a dial (up to 10) and a delivery (2); with the beat before the cut (8) that is 216, inside the parent's ring window 220, so RING_HOLD and LEASE_T are one horizon
    LEASE_TTL: 40,               // law T: the forwarding tombstone's life after a confirmed move
    LEDGER_GRACE: 100,           // V7b: a new head's row ledger is generation 0 for this long
    LONE_GREET_AFTER: 16,        // two silent beats before a lone Section-1 seat greets the door
    NBR_GAP: 60,                 // S5: a neighbour silence this long resets freshness on return
    NOTMINE_ECHO: 240,           // L8.4: a Section-1 cell held only second-hand that no owner reported this long is held by nobody of my island
    NOTMINE_WAIT: 48,            // L8.4: an occupant of my owned link whose link has stayed none this long, dialled and never heard, is not of my island
    ORPHAN_T: 60,                // D6c: a seat no link carries, whose door names another greeter, leaves after this long; its goodbye goes by the door (D6c.4)
    OWNER_SILENT: 40,            // up-edge D5: unanswered phone beats this long register a transport-loss observation of the owner
    PEND_Y: 40,                  // a YIELD waits this long for its arbiter's hearing PONG or proof verdict
    PLACE_REPLAY: 12,            // an admitter replays an unconfirmed PLACE once after this long
    PROBLVL: 3,                  // Q2: a compaction probe climbs at most this many levels
    RC_RESEND: 4,                // L3.11.2: a returner whose routed RECLAIM drew no answer this long sends it again through another greeter (one routed hop and back is 2 to 4 ticks)
    RC_RESEND_N: 2,              // L3.11.2: at most this many resends of a routed RECLAIM per return (then the ordinary roster round and the newcomer path)
    RC_WAIT: 20,                 // L3.10.4: a returner holds a hand-back of its old cell this long (CONFIRM_TTL + 4) before taking it, in case the hole's mover answers that it healed the cell; the mover then offers the seat it left, once its own move confirms
    REACH_PROBE: 5,              // L4.1.1: ticks after a page starts at which its network probe gives up waiting for a reflexive address and calls the network blocked (the page: REACH_PROBE_MS). Depends on: the STUN client's fourth send and one round trip
    REDIAL_GAP: 8,               // L3.8: at most one re-dial of an owned link per this many ticks, the first gap
    REDIAL_MAX: 64,              // L3.8: the re-dial gap doubles up to this
    RELAY_BUDGET: 3,             // door relay: hand-offs per seeker per RELAY_SEEN window
    RELAY_CAP: 72,               // max greeter entries the door holds
    RELAY_SEEN: 4,               // door relay: hand-off window per seeker (ticks)
    RELAY_TTL: 500,              // greeter entry lifetime at the door (ticks)
    RELOAD_MARK_T: 40,           // L3.11: a goodbye marked reload makes the closes that follow it from the same seat a lease (quiet), not a hard loss, for this many ticks (a close lags the goodbye by a link delay or a relay beat)
    SIT_PING_WAIT: 15,           // V4: a silent vouch is freed only after a SITPING went unanswered this long
    SIT_RECHECK: 25,             // admitter re-check cadence for a sitting-down mark
    SIT_TTL: 90,                 // soft sitting-down mark backstop
    SPREAD: true,                // T7: spread after an explicit NOROOM
    SPREAD_MINDEPTH: 4,          // T7: a NOROOM counts as spread evidence only from depth >= this
    STAGE_CAP_PER_C: 1,          // L6.2: the stage holds at most this many seats (one row's width): the pinned first, then the talkers
    STRAND_TTL: 500,             // R6: a newcomer that reaches no greeter this long re-checks (take over an empty room, else stranded)
    TALK_HOLD: 10,               // L6.2: a talker who stops keeps its place on the stage this long (a restart inside it is no flicker)
    TALK_ON: 4,                  // L6.2: a seat talks this long before it enters the stage set
    TENURE: 40,                  // S2: a seat heard at its cell this long is its incumbent
    TURN_BASE_BYTES: 3000,       // TURN: bytes per tick and direction of everything except video on a TURN link (voices, data, roster, chat, transcript; about 48 kbps)
    TURN_DIAL: 6,                // TURN: ticks from a TURN link ask to an open path. Depends on: one credential round trip, the offer and answer over the relay, ICE through the server
    TURN_FREE_CLAMP: 6000,       // TURN: bytes per tick and direction the free pool lets one allocation carry (the server limit, 12000 bytes/s); everything except video fits, video does not
    TURN_FREE_LINKS: 6,          // TURN.10: TURN link credential names a room has in the free pool (and as many standby names); with one allocation per name this is the room's hard limit
    TURN_KEEP_BYTES: 50,         // TURN.9: bytes per tick and direction of an idle standby (keep-alives only)
    TURN_RETRY: 60,              // TURN.10: a refused or failed TURN link ask is repeated after this long (30 s). Depends on: how fast a busy pool frees a place; no mesh timing reads it
    TURN_RETRY_MAX_X: 8,         // TURN.10: an ask refused again and again waits twice as long each time, up to this many TURN_RETRYs (4 min), while its page sees nothing change; a change it sees puts the wait back to TURN_RETRY
    TURN_VIDEO_BYTES: 225000,    // TURN: bytes per tick and direction of the video on a vouched TURN link (about 3.6 Mbps)
    TURN_VIDEO_MIN_BYTES: 12500, // TURN.13: the lowest video step on a TURN link, bytes per tick and direction (about 200 kbps); a throttled link that cannot carry this much pauses video and keeps everything else
    TURN_VOUCH_GRACE: 20,        // TURN.12: a TURN link that loses its vouch keeps video this long (10 s) before it falls back to no video. Depends on: the time another subscriber's spare vouch needs to reach the link's two ends (one credential round trip)
    TURN_VOUCH_ROOM20: 3,        // TURN.11: video TURN links one Room 20 subscriber present in the meeting vouches for
    TURN_VOUCH_STREAMER: 20,     // TURN.11: video TURN links one Streamer subscriber present in the meeting vouches for
    TURN_VOUCH_UNLIMITED: 6,     // TURN.11: video TURN links one Room unlimited subscriber present in the meeting vouches for
    TURN_WAIT: 17,               // TURN.4: a head asks for a TURN link only after its own probe and the friends it asked at once (TURN.3) have failed for this long in a row. Depends on: the direct verdict (FHOP_RELAY_ASK) or one friend probe (the ask, the offer and answer over the relay, LINK_DIAL_ICE), whichever is longer, plus one sweep; the two run side by side, so not their sum
    TURN_WEB_WAIT: 6,            // TURN.18: ticks a TURN client end's connection looks for a path to its relay server before the link takes the web path (a WebSocket to the same server). Depends on: a TURN allocation over TCP or TLS on a slow link; shorter, a slow but open network would be sent to the web path
    UNPROVEN_HOLD: 60,           // H6: an unproven pairing past this age lives only on probe answers
  });
})(typeof window !== 'undefined' ? window : globalThis);
