/*
 * home-looks/orbit.js — the Orbit look of the Home Screen. Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * You in the middle; your people on the first ring, places on the second, apps on the third. Built in: the sky, the
 * rings and the middle (they ARE the look: a ring is not a card a person could swap), the greeting, and the bar below.
 * Widgets: the clock above the greeting, and two rails (beside the rings on a wide screen, under them on a phone).
 *
 * The stage is laid out, never measured: on a phone it is the room left between the header and the bar in the first
 * screen; on a wide screen it is the column between the rails. So no ring can sit under the header, the bar or a rail.
 */
(function (root) {
  'use strict';
  const HV = root.GifOS && root.GifOS.homeView; if (!HV) return;
  HV.look({
    id: 'orbit', name: 'Orbit', flavor: 'night',
    sub: 'You in the middle. Your people, rooms and apps circle around you.',
    slots: {
      top: { sizes: ['medium', 'small', 'wide'], start: ['clock/now'] },
      side: { sizes: ['small', 'medium'], start: ['rooms/missed', 'calendar/today', 'broadcast/live'] },
      side2: { sizes: ['small', 'medium'], start: ['calendar/month', 'meet/recent'] },
    },
    paint(el, d, api) {
      const doc = el.ownerDocument;
      const ring = (n, items) => '<div class="o-ring r' + n + '">' + items.map((h, i) => '<div class="o-b" style="--a:' + (360 * i / items.length + n * 37).toFixed(1) + 'deg"><div class="o-in">' + h + '</div></div>').join('') + '</div>';
      // Every candidate is drawn; arrange() below then measures the stage and shows only what fits without touching.
      const r1 = d.ppl.list.slice(0, 8).map((p, i) => api.personBubble(p, i, api.isMissed(d.ppl, p)));
      r1.push(api.addBubble());
      const place = (act, ic, name, cls) => '<button type="button" class="o-place ' + (cls || '') + '" data-act="' + act + '"><span class="o-place-ic">' + api.svg(ic) + '</span><span class="o-place-n">' + api.esc(name) + '</span></button>';
      const r2 = [place('myroom', 'home', api.words.myRoom), place('tv', 'tv', 'GifOS TV', 'live')]
        .concat(d.rooms.slice(0, 4).map((r, i) => place('room:' + i, r.v ? 'key' : 'door', r.name)));
      if (r2.length < 5) r2.push(place('lobby', 'key', api.words.host), place('golive', 'tv', api.words.goLive));
      el.innerHTML = '<div class="o-sky" aria-hidden="true"><i></i><i></i><i></i></div>' +
        '<div class="hv-scroll o-scroll"><div class="o-screen">' +
          '<div class="o-top">' + api.slot('top') + '<div class="o-hello"><b>' + api.esc(api.hello(d)) + '</b><span>' + api.esc(api.words.orbitHint) + '</span></div></div>' +
          '<div class="o-stage"><div class="o-orbits" aria-hidden="true"><i></i><i></i><i></i></div>' + ring(1, r1) + ring(2, r2) + '<div class="o-ring r3"></div>' +
            '<button type="button" class="o-core" data-act="start" title="' + api.esc(api.words.startTitle) + '"><span class="o-halo"></span>' + api.myFace('big') + '<span class="o-core-t">' + api.svg('video') + api.esc(api.words.meet) + '</span></button></div>' +
        '</div><div class="o-rail o-rail-a">' + api.slot('side') + '</div><div class="o-rail o-rail-b">' + api.slot('side2') + '</div></div>' +
        '<div class="o-bar">' + api.joinForm('') + '<button type="button" class="hv-pill o-apps" data-act="apps">' + api.svg('grid') + '<span>' + api.esc(api.words.apps) + '</span></button></div>';
      const r3 = el.querySelector('.r3'), list = api.shortApps(9);
      list.forEach((it, i) => {
        const b = doc.createElement('div'); b.className = 'o-b'; b.style.setProperty('--a', (360 * i / Math.max(1, list.length) + 15).toFixed(1) + 'deg');
        const inn = doc.createElement('div'); inn.className = 'o-in'; inn.appendChild(api.appTile(it, 'orb')); b.appendChild(inn); r3.appendChild(b);
      });
    },
    // THE RINGS NEVER CROWD. After the frame is laid out (and whenever the stage changes size) the rings are fitted to
    // the stage as it really is: how many rings there is room for, how far apart, and how many items each can carry so
    // that no icon or name touches another, whichever way the rings have turned. The rest stay one tap away (People,
    // Apps). When the rings are too close to turn past each other freely, they turn together and their items are set
    // in each other's gaps.
    after(el) {
      const stage = el.querySelector('.o-stage'); if (!stage) return;
      const doc = el.ownerDocument, view = doc.defaultView;
      const arrange = () => {
        const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
        const rings = [1, 2, 3].map((n) => stage.querySelector('.o-ring.r' + n)), circles = stage.querySelectorAll('.o-orbits i');
        const rem = parseFloat(view.getComputedStyle(doc.documentElement).fontSize) || 16, is = h <= 300 ? .62 : h <= 420 ? .8 : 1;
        stage.style.setProperty('--is', is);
        // one item's box (picture and name), from the widest and tallest there is
        let iw = 4.6 * rem, ih = 4.4 * rem;
        stage.querySelectorAll('.o-in > *').forEach((n) => { iw = Math.max(iw, n.offsetWidth); ih = Math.max(ih, n.offsetHeight); });
        iw *= is; ih *= is;
        const D = Math.hypot(iw, ih) * .96;                                  // centres this far apart never touch, at any turn
        const core = stage.querySelector('.o-core .hv-av'), coreR = core ? core.offsetWidth / 2 : 2 * rem;
        const R = Math.max(coreR + ih / 2, Math.min(w / 2 - iw / 2, h / 2 - ih / 2) - 2);
        const rmin = coreR + 1.1 * rem * is + Math.hypot(iw, ih) / 2;   // clear of the middle and of the Meet label that hangs under it
        const wantApps = w >= 620 && h >= 480;
        let k = R >= rmin + 2 * ih && wantApps ? 3 : R >= rmin + ih ? 2 : 1;
        const gap = k > 1 ? Math.min(D, (R - rmin) / (k - 1)) : 0, free = k > 1 && gap >= D - .5;
        const radii = []; for (let i = 0; i < k; i++) radii.push(R - (k - 1 - i) * gap);
        const fit = (r) => Math.max(1, Math.floor(Math.PI / Math.asin(Math.min(1, D / (2 * r)))));
        // one ring only (a very small stage): my room and the channel join the people on it
        if (k === 1 && rings[1].children.length) { const add = rings[0].lastElementChild, third = rings[0].children[2] || add; Array.from(rings[1].children).slice(0, 2).forEach((b) => rings[0].insertBefore(b, third)); }
        const lists = rings.map((ring) => Array.from(ring.children));
        const placed = [];   // { x, y } of every item set so far (ring turn 0)
        stage.classList.toggle('o-lock', !free);
        rings.forEach((ring, i) => {
          const on = i < k; ring.style.display = on ? 'block' : 'none'; if (circles[i]) circles[i].style.display = on ? 'block' : 'none';
          if (!on) return;
          const r = radii[i], items = lists[i];
          ring.style.setProperty('--r', r + 'px'); if (circles[i]) circles[i].style.setProperty('--r', r + 'px');
          let n = Math.min(items.length, fit(r)), off = i * 37;
          // the Add circle always keeps its place on the first ring: people give way to it
          const keepLast = i === 0 && items.length > n;
          if (!free && i > 0 && placed.length) {
            for (; n >= 1; n--) {   // the turn of this ring that keeps its items farthest from the ring inside; fewer items until none is too near
              let best = -1, bestOff = 0;
              for (let o = 0; o < 360 / n; o += 2) {
                let m = Infinity;
                for (let j = 0; j < n; j++) { const a = (o + 360 * j / n) * Math.PI / 180, x = r * Math.cos(a), y = r * Math.sin(a); for (const q of placed) m = Math.min(m, Math.hypot(x - q.x, y - q.y)); }
                if (m > best) { best = m; bestOff = o; }
              }
              off = bestOff; if (best >= D || n === 1) break;
            }
          }
          const show = keepLast ? items.slice(0, n - 1).concat(items[items.length - 1]) : items.slice(0, n);
          items.forEach((b) => { b.hidden = show.indexOf(b) < 0; });
          show.forEach((b, j) => { const a = off + 360 * j / show.length; b.style.setProperty('--a', a.toFixed(1) + 'deg'); const t = a * Math.PI / 180; placed.push({ x: r * Math.cos(t), y: r * Math.sin(t) }); });
        });
      };
      arrange();
      if (el._orbitRO) el._orbitRO.disconnect();
      if (view.ResizeObserver) { el._orbitRO = new view.ResizeObserver(arrange); el._orbitRO.observe(stage); }
    },
    css: `
.hv.hv-orbit, .hv-skin-orbit, body[data-hv="orbit"] .menubar {
  --h-bg: #05061a; --h-ink: #eef0ff; --h-dim: #9aa0d0; --h-card: rgba(28,30,70,.72); --h-solid: #12143a; --h-line: rgba(150,160,255,.22);
  --h-acc: #7cf4ff; --h-acc2: #b388ff; --h-on: #05061a; --h-shadow: 0 .6rem 2.4rem rgba(0,0,0,.5); color-scheme: dark; }
body[data-hv="orbit"] .menubar .pin-head-t { color: #ffb37a; }
body[data-hv="orbit"] #gifos-build-float { color: #fff; opacity: .6 !important; }
body[data-hv="orbit"] .menubar .brand { -webkit-text-fill-color: #fff; }
.hv-orbit { background: radial-gradient(120% 90% at 50% 45%, #171a5c 0%, #0a0b2c 45%, #05061a 80%); }
.o-sky i { position: absolute; inset: -20%; pointer-events: none;
  background-image: radial-gradient(1.2px 1.2px at 12% 18%, #fff 50%, transparent), radial-gradient(1px 1px at 68% 12%, #cfd6ff 50%, transparent), radial-gradient(1.4px 1.4px at 84% 62%, #fff 50%, transparent),
    radial-gradient(1px 1px at 32% 78%, #b9c2ff 50%, transparent), radial-gradient(1.2px 1.2px at 52% 42%, #fff 50%, transparent), radial-gradient(1px 1px at 8% 58%, #fff 50%, transparent);
  background-size: 23rem 19rem; opacity: .8; animation: hv-twinkle 6s ease-in-out infinite alternate; }
.o-sky i:nth-child(2) { background-size: 15rem 21rem; opacity: .5; animation-duration: 9s; transform: rotate(40deg); }
.o-sky i:nth-child(3) { background-size: 31rem 27rem; opacity: .9; animation-duration: 4s; transform: rotate(-20deg); }

/* a phone: the first screen is header + rings (the bar floats over its foot); the rails follow below */
.hv-orbit .o-scroll { padding: 0 0 6.2rem; }
.o-screen { height: 100cqh; display: flex; flex-direction: column; padding: 2.9rem 0 5.6rem; box-sizing: border-box; }
.o-top { flex: 0 0 auto; z-index: 4; align-self: center; width: min(26rem, calc(100% - 2rem)); display: flex; flex-direction: column; gap: .3rem; text-align: center; }
.o-hello { display: flex; flex-direction: column; gap: .15rem; } .o-hello b { font-size: 1.1rem; letter-spacing: -.02em; } .o-hello span { font-size: .8rem; color: var(--h-dim); }
.o-stage { position: relative; flex: 1 1 0; min-height: 0; container-type: size; }
.o-rail { padding: 0 1rem; max-width: 30rem; margin: 0 auto 1rem; box-sizing: border-box; }
.hv-orbit .hv-slot { gap: .8rem; }
.hv-orbit .hv-w:not(.bare) { padding: .9rem; border-radius: 1.4rem; background: var(--h-card); border: 1px solid var(--h-line); box-shadow: 0 0 1.6rem rgba(124,244,255,.08); backdrop-filter: blur(1rem); -webkit-backdrop-filter: blur(1rem); }

/* radii, counts and angles are set by after() above from the measured stage; these are only the first frame's values */
.o-orbits i { position: absolute; left: 50%; top: 50%; border-radius: 50%; transform: translate(-50%,-50%); border: 1px dashed rgba(160,170,255,.2); }
.o-stage { --is: 1; }
.o-orbits i, .o-ring { --R: calc(50cqmin - 2.7rem * var(--is)); --r: var(--R); }
.o-orbits i:nth-child(1), .o-ring.r1 { --r: calc(var(--R) * .5); }
.o-in > * { scale: var(--is, 1); }
.o-b[hidden] { display: none; }
.o-orbits i { width: calc(var(--r) * 2); height: calc(var(--r) * 2); }
.o-ring { position: absolute; left: 50%; top: 50%; width: 0; height: 0; animation: hv-spin var(--t, 160s) linear infinite; }
.o-ring.r1 { --t: 150s; } .o-ring.r2 { --t: 230s; animation-direction: reverse; } .o-ring.r3 { --t: 320s; }
.o-b { position: absolute; left: 0; top: 0; width: 0; height: 0; transform: rotate(var(--a)) translateX(var(--r)) rotate(calc(var(--a) * -1)); }
.o-in { position: absolute; left: 0; top: 0; width: 0; height: 0; animation: hv-spin var(--t, 160s) linear infinite reverse; }
.o-ring.r2 .o-in { animation-direction: normal; }
.o-in > * { position: absolute; left: 0; top: 0; translate: -50% -50%; }   /* translate, not transform: it is applied outside the scale above, so a shrunk item stays centred on its ring */
.o-stage:hover .o-ring, .o-stage:hover .o-in, .o-stage:active .o-ring, .o-stage:active .o-in { animation-play-state: paused; }
.hv-orbit .o-stage .hv-person { width: 4.4rem; }
.hv-orbit .o-stage .hv-av { width: 3.1rem; height: 3.1rem; font-size: 1rem; box-shadow: 0 0 1.2rem hsl(var(--h, 250) 90% 60% / .55); }
.hv-orbit .o-stage .hv-person-n { text-shadow: 0 1px 4px #000; }
.hv-orbit .o-place { display: flex; flex-direction: column; align-items: center; gap: .3rem; width: 4.6rem; }
.o-place-ic { width: 2.5rem; height: 2.5rem; border-radius: 50%; display: grid; place-items: center; background: var(--h-card); border: 1px solid var(--h-line); color: var(--h-acc); box-shadow: 0 0 1rem rgba(124,244,255,.18);
  transition: transform .2s cubic-bezier(.3,1.6,.5,1); }
.o-place.live .o-place-ic { color: #ff6b7a; box-shadow: 0 0 1rem rgba(255,77,94,.45); }
.o-place:hover .o-place-ic { transform: scale(1.12); } .o-place:active .o-place-ic { transform: scale(.9); }
.o-place-n { max-width: 100%; font-size: .68rem; font-weight: 600; color: var(--h-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-shadow: 0 1px 4px #000; }
.hv-orbit .hv-app.orb { width: 4.2rem; }
.hv-app.orb .hv-app-pic { width: 2.7rem; height: 2.7rem; border-radius: 50%; background: var(--h-card); border: 1px solid var(--h-line); }
.hv-app.orb .hv-app-pic img { width: 1.9rem; height: 1.9rem; }
.hv-app.orb .hv-app-n { font-size: .62rem; color: var(--h-dim); -webkit-line-clamp: 1; text-shadow: 0 1px 4px #000; }
/* rings too close to pass each other turn together, as one sky */
.o-lock .o-ring { animation-duration: 240s; animation-direction: normal; }
.o-lock .o-ring .o-in { animation-duration: 240s; animation-direction: reverse; }
@container (max-width: 619px) { .o-core .hv-av.big, .o-halo { width: clamp(3.2rem, 18cqmin, 6rem); height: clamp(3.2rem, 18cqmin, 6rem); } .hv-orbit .o-stage .hv-av { width: 2.8rem; height: 2.8rem; } .o-place-n { max-width: 4.2rem; } }
.hv-orbit .o-core { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); display: flex; flex-direction: column; align-items: center; gap: .5rem; z-index: 2; }
.o-core .hv-av.big { width: clamp(4.6rem, 22cqmin, 7rem); height: clamp(4.6rem, 22cqmin, 7rem); box-shadow: 0 0 0 .25rem rgba(124,244,255,.35), 0 0 3rem rgba(124,244,255,.5); transition: transform .25s cubic-bezier(.3,1.6,.5,1); }
.o-core:hover .hv-av.big { transform: scale(1.06); } .o-core:active .hv-av.big { transform: scale(.94); }
.o-halo { position: absolute; left: 50%; top: 0; width: clamp(4.6rem, 22cqmin, 7rem); aspect-ratio: 1; border-radius: 50%; transform: translateX(-50%); border: 2px solid rgba(124,244,255,.6); animation: hv-halo 2.8s ease-out infinite; pointer-events: none; }
.o-core-t { position: absolute; top: 100%; margin-top: -.9rem; display: inline-flex; align-items: center; gap: .35rem; padding: .3rem .8rem; border-radius: 99rem; font-size: .82rem; font-weight: 700; color: var(--h-on);
  background: linear-gradient(135deg, var(--h-acc), var(--h-acc2)); white-space: nowrap; }
.o-bar { position: absolute; left: 50%; bottom: 1.2rem; transform: translateX(-50%); z-index: 3; width: min(32rem, calc(100% - 1.6rem)); display: flex; gap: .5rem; align-items: center; animation: hv-up .6s .15s cubic-bezier(.2,1.1,.3,1) both; }
.o-bar .hv-join { flex: 1 1 0; min-width: 0; }
.hv-orbit .o-apps { min-height: 3.3rem; background: var(--h-solid); }
@container hv (max-width: 420px) { .o-apps span { display: none; } }
@container hv (max-height: 560px) { .o-hello span { display: none; } }
/* a short screen (a phone on its side): the header stands at the left so the rings get the height */
@container hv (max-height: 520px) and (max-width: 899px) { .o-screen { flex-direction: row; padding: 2.7rem .6rem 4.4rem; } .o-top { align-self: flex-start; width: 11.5rem; text-align: left; } }
@container (max-height: 300px) { .o-core .hv-av.big, .o-halo { width: 2.6rem; height: 2.6rem; } .o-core-t { scale: .6; margin-top: -.6rem; } }

/* a wide screen: header and first rail at the left, the rings in the middle column, the bar under the rings, a second rail from 1200px */
@container hv (min-width: 900px) {
  .hv-orbit .o-scroll { display: grid; grid-template-columns: 19rem minmax(0, 1fr); grid-template-rows: auto auto minmax(0, 1fr); column-gap: 1rem; padding: 3rem 1.2rem 1rem; overflow: hidden; box-sizing: border-box; }
  .o-screen { display: contents; }
  .o-top { grid-column: 1; grid-row: 1; align-self: start; width: auto; text-align: left; padding-bottom: .8rem; }
  .o-stage { grid-column: 2; grid-row: 1 / 4; margin-bottom: 5rem; }
  .o-rail { margin: 0; padding: 0 .2rem 0 0; max-width: none; overflow-y: auto; scrollbar-width: none; min-height: 0; }
  .o-rail-a { grid-column: 1; grid-row: 2; overflow: visible; padding-bottom: .8rem; }
  .o-rail-b { grid-column: 1; grid-row: 3; }
  .o-bar { left: calc(20.2rem + (100% - 21.4rem) / 2); width: min(32rem, calc(100% - 23rem)); }
}
@container hv (min-width: 1200px) {
  .hv-orbit .o-scroll { grid-template-columns: 19rem minmax(0, 1fr) 19rem; }
  .hv-orbit .o-scroll { grid-template-rows: auto minmax(0, 1fr); }
  .o-stage { grid-row: 1 / 3; }
  .o-rail-a { overflow-y: auto; }
  .o-rail-b { grid-column: 3; grid-row: 1 / 3; }
  .o-bar { left: 50%; width: min(32rem, calc(100% - 44rem)); }
}
`,
  });
})(typeof window !== 'undefined' ? window : globalThis);
