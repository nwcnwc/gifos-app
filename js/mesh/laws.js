/*
 * laws.js: the mesh's shared constants (ticks unless noted).
 * GENERATED from the constants source: do not edit by hand.
 * A *_PER_C entry is multiplied by C, the seats per row.
 */
(function (root) {
  'use strict';
  const GifOS = root.GifOS = root.GifOS || {};
  GifOS.meshLaws = Object.freeze({
    CHAN_UP: 32,             // a channel counts as up only while its proof is this fresh
    CHILD_LEDGER_H: 300,     // no child-row ledger this long means an unheard child cell is an echo
    COMPACT_PERIOD: 90,      // Q2: min ticks between one leaf's compaction probes
    COMPACT_SETTLE: 300,     // Q2: quiet window before compaction stirs the tree
    COMPACT_TTL: 30,         // Q2: hop budget for a compaction probe
    CONFIRM_TTL: 16,         // law T: a mover's claim window before it confirms
    DARK_ASK_FRESH: 60,      // ...while the latest ask to it is at most this old
    DARK_LEAVE: 60,          // D6: no owned link carrying a channel this long, a seat vacates and re-joins
    DARK_WAIT: 6,            // a greeter asked WHOHOME that has not answered this long is dark (FIND's dark list)
    DIG_HOLD_LEVEL: 16,      // G: handover hold, two pulse periods per tree level
    DIG_LOSS_H: 300,         // G3: the fail-closed blur horizon (spans RING_HOLD)
    DIG_TTL: 60,             // G3: a digest report older than this is stale
    E3_PERIOD: 200,          // Section-1 re-knock cadence; below RELAY_TTL so live seats stay listed
    EARLY_HOLD: 12,          // D5: settle window a transport-death probe gets before the death is confirmed
    FIND_ACK_WAIT: 12,       // a seeker re-asks when its FIND has no FINDACK after this long
    FIND_TTL: 200,           // an honest seeker's FIND hop budget; every FIND is clamped to it
    FRESH: 60,               // S5: a seat is fresh this long after it took its cell or regained its neighbours
    HEAD_HEIR_WAIT: 40,      // a row-mate past column 1 leaves a confirmed-dead head to its own healer this long (H2 backstop)
    HELD_BEATS: 24,          // three rook beats: the occupant is answering right now
    HELLO_BACK: 20,          // ticks between HELLOs answering one unheard greeter
    KNOCK_FRESH: 40,         // a FIND from x within this long means x is knocking (split-off guard)
    K_APP: 3,                // digest list cap: apps
    K_HAND: 8,               // digest list cap: raised hands
    K_STAGE_PER_C: 2,        // digest list cap: stage entries, two per seat in a row
    K_VOTE: 16,              // digest list cap: votes
    LEASE_TTL: 40,           // law T: the forwarding tombstone's life after a confirmed move
    LEDGER_GRACE: 100,       // V7b: a new head's row ledger is generation 0 for this long
    LONE_GREET_AFTER: 16,    // two silent beats before a lone Section-1 seat greets the door
    NBR_GAP: 60,             // S5: a neighbour silence this long resets freshness on return
    OWNER_SILENT: 40,        // up-edge D5: unanswered phone beats this long register a transport-loss observation of the owner
    PEND_Y: 40,              // a YIELD waits this long for its arbiter's hearing PONG or proof verdict
    PLACE_REPLAY: 12,        // an admitter replays an unconfirmed PLACE once after this long
    PROBLVL: 3,              // Q2: a compaction probe climbs at most this many levels
    RELAY_BUDGET: 3,         // door relay: hand-offs per seeker per RELAY_SEEN window
    RELAY_CAP: 72,           // max greeter entries the door holds
    RELAY_SEEN: 4,           // door relay: hand-off window per seeker (ticks)
    RELAY_TTL: 500,          // greeter entry lifetime at the door (ticks)
    RING_HOLD: 220,          // H1-S1: a Section-1 cell is refilled only after its occupant is unreachable on every rook path this long
    SIT_PING_WAIT: 15,       // V4: a silent vouch is freed only after a SITPING went unanswered this long
    SIT_RECHECK: 25,         // admitter re-check cadence for a sitting-down mark
    SIT_TTL: 90,             // soft sitting-down mark backstop
    SPREAD: true,            // T7: spread after an explicit NOROOM
    SPREAD_MINDEPTH: 4,      // T7: a NOROOM counts as spread evidence only from depth >= this
    STRAND_TTL: 500,         // R6: a newcomer that reaches no greeter this long re-checks (take over an empty room, else stranded)
    TENURE: 40,              // S2: a seat heard at its cell this long is its incumbent
    UNPROVEN_HOLD: 60,       // H6: an unproven pairing past this age lives only on probe answers
    UNP_SIGN: 16,            // G10: after two unproven beats from a peer, digest frames to it are signed
  });
})(typeof window !== 'undefined' ? window : globalThis);
