/*
 * meet-progress.js — true progress while a person waits to get into a meeting.
 *
 * Every wait on the way in (and back in) reads "Step X of Y: <what is happening>".
 * The rule:
 *   - Y is the most steps the flow could take, given every unknown (a password,
 *     a waiting room, a network that blocks direct calls). It need not be exact.
 *   - X goes up by one each time ANY step completes, in whatever order. It never
 *     goes back: a step once done stays done, even when the page has to knock again.
 *   - Ending early is fine: "Step 5 of 10" may well be the last step.
 *
 * The page never decides a step by itself: judge(flow, facts, seen) reads the
 * page's real state (the relay socket, the seat's state, the door's list, the
 * network verdict, the TURN link) and says which steps are done and which one
 * is current. It is pure, so a test can run it again on the facts a DEBUG page
 * wrote in its trace and check that the page showed what the facts say.
 *
 * Flows and their steps, in the order they normally happen:
 *   join       net, server, door, password, admit, knock, seat, relay, web, merge, people
 *   reconnect  server, door, knock, seat, relay, web, people
 *   load       part1..part4 (a missing script of the page loaded again, js run.html unitsGate)
 *   update     save, reload, then the join's steps (a new GifOS version: the page saves your place,
 *              reloads into the new version and comes back in; X carries across the reload)
 *
 * Facts (all optional; a missing fact reads as "not yet"):
 *   dp        this network's direct-path verdict: 'pending' | 'ok' | 'strict' | 'blocked' | 'unknown'
 *   relay     the relay socket is up
 *   list      the door's list has come back at least once in this flow (a fresh greeter list)
 *   greeters  how many people that list names other than me
 *   pw        the room password prompt is up
 *   wait      the page is in the waiting room
 *   doorUp    a door connection (to someone at the door) is open
 *   st        the seat's state: 0 asking for the list, 1 knocked, 2 asked for a seat, 3 seated
 *   coord     the seat holds a cell
 *   turn      the relayed link's state: '' none | 'ask' | 'dial' | 'web' (the relay protocol found no way out of this
 *             network and the link is being made as a web connection) | 'up'
 *   web       the relayed link that is up runs as a web connection
 *   n         people in the meeting as this page counts them (me included)
 *   live      people I have a working connection with (not counting door-only pairs)
 *   tries     load: tries done so far;  loaded  load: every part is in
 *   saved     update: the page wrote down your place;  reloaded  update: this page is the new version
 */
(function (root) {
  'use strict';

  // Each step: the phase text (what the page is waiting for), with its catalog key.
  const STEP = {
    net:      { key: 'pgNet',      en: 'Checking your network' },
    server:   { key: 'pgServer',   en: 'Connecting to GifOS' },
    door:     { key: 'pgDoor',     en: 'Finding your meeting' },
    password: { key: 'pgPassword', en: 'Waiting for the room password' },
    admit:    { key: 'pgAdmit',    en: 'Waiting for the host to let you in' },
    knock:    { key: 'pgKnock',    en: 'Knocking at the door' },
    knockBlocked: { key: 'pgKnockBlocked', en: 'Asking everyone at the door at once' },
    seat:     { key: 'pgSeat',     en: 'Taking your seat' },
    found:    { key: 'pgFound',    en: 'Starting the meeting' },
    relay:    { key: 'pgRelay',    en: 'Connecting through a relay' },
    web:      { key: 'pgWeb',      en: 'Connecting through a web relay' },
    merge:    { key: 'pgMerge',    en: 'Joining the others through the relay' },
    people:   { key: 'pgPeople',   en: 'Connecting to the people in the meeting' },
    serverBack: { key: 'pgServerBack', en: 'Reconnecting to GifOS' },
    seatBack: { key: 'pgSeatBack', en: 'Getting your seat back' },
    part:     { key: 'pgPart',     en: 'Loading a missing part of the page again' },
    save:     { key: 'pgUpdSave',  en: 'Saving your place in the meeting' },
    reload:   { key: 'pgUpdReload', en: 'Opening the new version of GifOS' },
  };

  // Short reasons, shown under the phase where they help.
  const HINT = {
    blocked:   { key: 'pgHintBlocked',  en: 'Your network blocks direct calls, so this goes through a relay.' },
    strict:    { key: 'pgHintStrict',   en: 'Your network makes direct calls hard, so this can take a little longer.' },
    inspect:   { key: 'pgHintInspect',  en: 'Your network inspects web traffic, so the relay is reached as a web connection.' },
    noAnswer:  { key: 'pgHintNoAnswer', en: 'Nobody has answered the door yet. We keep knocking.' },
    first:     { key: 'pgHintFirst',    en: 'Nobody else is here yet.' },
    noServer:  { key: 'pgHintNoServer', en: 'Your internet connection may be down. We keep trying.' },
    password:  { key: 'pgHintPassword', en: 'This room is locked. Type its password to go on.' },
    admit:     { key: 'pgHintAdmit',    en: 'The host sees that you are here.' },
    dropped:   { key: 'pgHintDropped',  en: 'Your connection dropped. You stay in the meeting while we get it back.' },
    unreach:   { key: 'pgHintUnreach',  en: 'Your device could not connect to the people at the door. A firewall, VPN or strict network may be blocking calls. We keep trying.' },
    long:      { key: 'pgHintLong',     en: 'This is taking longer than it should. Check your connection, or reopen the link.' },
  };

  const FLOWS = {
    join:      ['net', 'server', 'door', 'password', 'admit', 'knock', 'seat', 'relay', 'web', 'merge', 'people'],
    reconnect: ['server', 'door', 'knock', 'seat', 'relay', 'web', 'people'],
    load:      ['part1', 'part2', 'part3', 'part4'],
    update:    ['save', 'reload', 'net', 'server', 'door', 'password', 'admit', 'knock', 'seat', 'relay', 'web', 'merge', 'people'],
  };

  const TEMPLATE = { key: 'pgStepOf', en: 'Step {x} of {y}: {what}…' };
  const STEP_ONLY = { key: 'pgStepOnly', en: 'Step {x} of {y}' };
  const SECS = { key: 'pgSecs', en: '{s} s' };

  const seated = (f) => f.st === 3 && !!f.coord;

  // judge(flow, f, seen) → { done: [ids], cur: id, text: step text id, hint: hint id or '' , end: bool }
  // seen: the steps this flow has been current in so far (a Set or array), the
  // only memory judge needs (a password step is done once its prompt was up and is gone).
  function judge(flow, f, seen) {
    f = f || {};
    const was = (id) => !!seen && (typeof seen.has === 'function' ? seen.has(id) : seen.indexOf(id) >= 0);
    const done = [];
    const add = (id, ok) => { if (ok) done.push(id); };
    const blocked = f.dp === 'blocked';
    const turnUp = f.turn === 'up';
    if (flow === 'load') {
      const t = Math.max(0, Math.min(4, f.tries | 0));
      for (let i = 1; i <= t; i++) done.push('part' + i);
      return { done, cur: 'part' + Math.min(4, t + 1), text: 'part', hint: '', end: !!f.loaded };
    }
    const isSeat = seated(f);
    // back in after a drop: the way back starts at the server, so nothing past it counts while the server is gone
    // (a seat the page still holds is not a step completed during this wait)
    if (flow === 'reconnect' && !f.relay) return { done, cur: 'server', text: 'serverBack', hint: 'dropped', end: false };
    add('save', !!f.saved);
    add('reload', !!f.reloaded);
    // before the reload the old page counts only its own two steps: the way back in is the new page's to count
    if (flow === 'update' && !f.reloaded) {
      return { done, cur: f.saved ? 'reload' : 'save', text: f.saved ? 'reload' : 'save', hint: '', end: false };
    }
    add('net', !!f.dp && f.dp !== 'pending');
    add('server', !!f.relay || isSeat);
    add('door', !!f.list || isSeat);
    add('password', was('password') && !f.pw);
    add('admit', was('admit') && !f.wait);
    // The door answered me: a door connection opened, or the seat moved on to
    // asking for a seat (FINDACK), or a seat came through someone (not founded alone).
    add('knock', !!f.doorUp || f.st === 2 || (isSeat && (f.greeters | 0) > 0 && (f.live | 0) > 0));
    add('seat', isSeat);
    // the relay step ends when the link is up, or when the relay protocol has been tried and the link moves to the web path
    add('relay', turnUp || f.turn === 'web');
    add('web', turnUp && !!f.web);
    // merged: seated again with more people than this part had before the link
    add('merge', turnUp && isSeat && (f.n | 0) > (f.nAtRelay | 0) && (f.nAtRelay | 0) > 0);
    const alone = isSeat && (f.greeters | 0) === 0 && (f.n | 0) <= 1 && !!f.list;
    add('people', isSeat && ((f.live | 0) > 0 || alone));
    // the current step: what the page is waiting for now
    let cur, text, hint = '';
    const back = flow === 'reconnect';
    if (flow === 'update' && !f.saved) { cur = 'save'; text = 'save'; }
    else if (flow === 'update' && !f.reloaded) { cur = 'reload'; text = 'reload'; }
    else if (f.pw) { cur = 'password'; text = 'password'; hint = 'password'; }
    else if (f.wait) { cur = 'admit'; text = 'admit'; hint = 'admit'; }
    else if (!f.relay && (back || !isSeat)) { cur = 'server'; text = back ? 'serverBack' : 'server'; hint = back ? 'dropped' : (f.offline ? 'noServer' : ''); }
    else if (!f.list && !isSeat) { cur = 'door'; text = 'door'; }
    // a relayed link is up and the seat moves through it into the others' part: that is the merge
    else if (!isSeat && turnUp && done.indexOf('merge') < 0) { cur = 'merge'; text = 'merge'; hint = 'blocked'; }
    else if (!isSeat) {
      if (f.st === 2) { cur = 'seat'; text = back ? 'seatBack' : 'seat'; }
      else if ((f.greeters | 0) === 0) { cur = 'seat'; text = 'found'; hint = 'first'; }
      else { cur = 'knock'; text = blocked ? 'knockBlocked' : 'knock'; hint = blocked ? 'blocked' : (f.dp === 'strict' ? 'strict' : ''); }
    }
    else if (f.turn === 'web') { cur = 'web'; text = 'web'; hint = 'inspect'; }
    else if (f.turn === 'ask' || f.turn === 'dial' || (blocked && (f.live | 0) === 0 && (f.greeters | 0) > 0 && !turnUp)) { cur = 'relay'; text = 'relay'; hint = 'blocked'; }
    else if (turnUp && done.indexOf('merge') < 0 && (f.live | 0) <= 1) { cur = 'merge'; text = 'merge'; hint = 'blocked'; }
    else { cur = 'people'; text = 'people'; }
    // the network verdict (net) runs beside the first steps and is never waited on: it counts when it lands
    // a step this flow does not have (a changed password while reconnecting) waits under the flow's own door step
    if (FLOWS[flow].indexOf(cur) < 0) cur = 'door';
    const end = isSeat && !f.pw && !f.wait && done.indexOf('people') >= 0 && !(f.turn === 'ask' || f.turn === 'dial' || f.turn === 'web')
      && (!back || !!f.relay) && (!was('relay') || done.indexOf('merge') >= 0);
    return { done: done.filter((id) => FLOWS[flow].indexOf(id) >= 0), cur, text, hint, end };
  }

  // A flow's run: the steps done so far only grow; X = done + 1, never above Y.
  function createRun(flow, now) {
    if (!FLOWS[flow]) throw new Error('unknown progress flow ' + flow);
    const steps = FLOWS[flow];
    const done = new Set(), seen = new Set();
    let cur = steps[0], text = cur, hint = '', since = now || 0, ended = false, shownX = 0, first = true;
    const run = {
      flow, y: steps.length, startedAt: now || 0,
      // apply(facts, now) → true when what the line says changed (step, X, or the end)
      apply(f, t) {
        if (ended) return false;
        const j = judge(flow, f, seen);
        const x0 = run.x(), c0 = cur, h0 = hint, tx0 = text;
        for (const id of j.done) done.add(id);
        if (j.cur !== cur) since = t || 0;
        cur = j.cur; text = j.text; hint = j.hint;
        seen.add(cur);
        if (j.end) ended = true;
        shownX = run.x();
        const was1 = first; first = false;
        return was1 || ended || run.x() !== x0 || cur !== c0 || hint !== h0 || text !== tx0;
      },
      // X is the step you are on: completed + 1, or at the end the steps completed; never below what was shown
      x() { return Math.min(steps.length, Math.max(shownX, done.size + (ended ? 0 : 1))); },
      cur: () => cur, text: () => text, hint: () => hint, since: () => since,
      done: () => steps.filter((s) => done.has(s)), seen: () => Array.from(seen), ended: () => ended,
    };
    return run;
  }

  const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v[k] === undefined ? '' : String(v[k])));
  const tr = (o, uiText) => (typeof uiText === 'function' ? (uiText(o.key, o.en) || o.en) : o.en);

  // line(run, now, uiText) → { head, what, secs, hint } words for the page, in its language.
  //   head  "Step 3 of 10: Finding your meeting…"   secs "12 s" (after 3 s on one step)   hint a reason or ''
  function line(run, now, uiText) {
    const st = STEP[run.text()] || STEP[run.cur()] || { key: '', en: run.cur() };
    const what = tr(st, uiText);
    const head = fill(tr(TEMPLATE, uiText), { x: run.x(), y: run.y, what });
    const waited = Math.floor(Math.max(0, (now || 0) - run.since()) / 1000);
    const secs = waited >= 3 ? fill(tr(SECS, uiText), { s: waited }) : '';
    const hint = run.hint() && HINT[run.hint()] ? tr(HINT[run.hint()], uiText) : '';
    return { head, what, secs, hint };
  }

  // stepOnly(run, uiText) → "Step 3 of 10" (the veil and the prompts put the phase under it)
  function stepOnly(run, uiText) { return fill(tr(STEP_ONLY, uiText), { x: run.x(), y: run.y }); }

  // Every catalog key this file can show, with its English (the i18n check reads uiText calls; this lists the rest).
  function keys() {
    const out = {};
    for (const o of [TEMPLATE, STEP_ONLY, SECS].concat(Object.values(STEP), Object.values(HINT))) out[o.key] = o.en;
    return out;
  }

  const api = { FLOWS, STEP, HINT, TEMPLATE, judge, createRun, line, stepOnly, keys };
  if (typeof module === 'object' && module.exports) module.exports = api;
  const GifOS = root.GifOS = root.GifOS || {};
  GifOS.meetProgress = api;
})(typeof window !== 'undefined' ? window : globalThis);
