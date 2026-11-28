/*
 * home-looks/pulse.js — the Pulse look of the Home Screen. Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * Bold and quick, like a social app: black, big type, tabs under your thumb. Built in: the frame, the tab bar with the
 * round Meet button, and the People, Live and Apps tabs (each is a full list, not a card). The Home tab is all widgets.
 */
(function (root) {
  'use strict';
  const HV = root.GifOS && root.GifOS.homeView; if (!HV) return;
  HV.look({
    id: 'pulse', name: 'Pulse', flavor: 'bold',
    sub: 'Bold and quick. Your people on top, big cards, tabs under your thumb.',
    slots: {
      top: { sizes: ['wide', 'medium', 'small'], start: ['clock/now', 'rooms/missed', 'rooms/people'] },
      hero: { sizes: ['large', 'wide', 'medium'], start: ['meet/join'] },
      feed: { sizes: ['wide', 'medium', 'small', 'large'], start: ['meet/recent', 'broadcast/live', 'appstore/apps', 'calendar/today'] },
    },
    paint(el, d, api) {
      const tab = api.state.tab || 'home', W = api.words, esc = api.esc, svg = api.svg;
      const row = (act, ic, b, s, cls) => '<button type="button" class="hv-row" data-act="' + act + '"><span class="hv-row-ic ' + (cls || '') + '">' + svg(ic) + '</span><span class="hv-row-t"><b>' + esc(b) + '</b><span>' + esc(s) + '</span></span><span class="hv-row-go">' + svg('arrow') + '</span></button>';
      const panels = {
        home: () => api.slot('top') + api.slot('hero') + api.slot('feed') + '<p class="hv-quiet">' + esc(W.honest) + '</p>',
        people: () => '<h1 class="p-title">' + esc(W.people) + '</h1>' + api.missedChip(d.ppl) + api.peopleRows(d.ppl) +
          '<div class="hv-rows">' + row('myroom', 'home', d.ppl.mine ? W.myRoom : W.makeMyRoom, d.ppl.mine ? d.ppl.mine.room : W.myRoomSub) + row('rooms', 'people', W.addSomeone, W.addSomeoneSub) + '</div>',
        live: () => '<h1 class="p-title">' + esc(W.live) + '</h1>' + api.liveCard() + api.tvStrip(12) +
          (d.casts.length ? '<div class="hv-sec-h"><h2>' + esc(W.watchedBefore) + '</h2></div><div class="hv-rows">' + d.casts.map((r, i) => api.roomRow(r, i, 'cast')).join('') + '</div>' : '') +
          '<div class="hv-rows">' + row('golive', 'tv', W.goLive, W.goLiveSub, 'live') + '</div>',
        apps: () => '<h1 class="p-title">' + esc(W.apps) + '</h1><div class="hv-appgrid p-allapps"></div><div class="hv-sheet-foot"><button type="button" class="hv-pill hot" data-act="store">' + svg('bag') + esc(W.appStore) + '</button><button type="button" class="hv-pill" data-act="add">' + svg('plus') + esc(W.add) + '</button></div>',
      };
      const tabBtn = (id, ic, name) => '<button type="button" class="p-tab' + (tab === id ? ' on' : '') + '" data-act="tab:' + id + '" aria-current="' + (tab === id ? 'page' : 'false') + '">' + svg(ic) + '<span>' + esc(name) + '</span></button>';
      el.innerHTML = '<div class="hv-scroll"><div class="p-col p-' + tab + '">' + (panels[tab] || panels.home)() + '</div></div>' +
        '<nav class="p-tabs" aria-label="' + esc(W.home) + '">' + tabBtn('home', 'home', W.home) + tabBtn('people', 'people', W.people) +
          '<button type="button" class="p-plus" data-act="start" title="' + esc(W.startTitle) + '" aria-label="' + esc(W.startTitle) + '">' + svg('video') + '</button>' +
          tabBtn('live', 'tv', W.live) + tabBtn('apps', 'grid', W.apps) + '</nav>';
      const all = el.querySelector('.p-allapps'); if (all) api.apps(null).forEach((it) => all.appendChild(api.appTile(it)));
    },
    css: `
.hv.hv-pulse, .hv-skin-pulse, body[data-hv="pulse"] .menubar {
  --h-bg: #000000; --h-ink: #ffffff; --h-dim: #a0a0a8; --h-card: #16161a; --h-solid: #16161a; --h-line: #2a2a31;
  --h-acc: #ff3d81; --h-acc2: #ff9d2e; --h-on: #ffffff; --h-shadow: 0 .6rem 2rem rgba(0,0,0,.6); color-scheme: dark; }
body[data-hv="pulse"] .menubar .pin-head-t { color: #ffb37a; }
body[data-hv="pulse"] #gifos-build-float { color: #fff; opacity: .6 !important; }
body[data-hv="pulse"] .menubar .brand { -webkit-text-fill-color: #fff; }
.hv-pulse { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; }
.p-col { max-width: 38rem; margin: 0 auto; padding: 0 1rem; display: flex; flex-direction: column; gap: 1.1rem; }
.p-col > *, .hv-pulse .hv-w { animation: hv-rise .45s cubic-bezier(.2,.9,.3,1) both; }
.hv-pulse .hv-slot { gap: 1.1rem; }
.hv-pulse .hv-sec-h { margin: .3rem 0 .5rem; } .hv-pulse .hv-sec-h h2 { font-size: 1.25rem; font-weight: 800; letter-spacing: -.03em; }
.p-title { font-size: 2.2rem; font-weight: 900; letter-spacing: -.05em; padding-top: .3rem; }
.hv-pulse .hv-w:not(.bare) { padding: 1rem; border-radius: 1.6rem; background: #16161a; }
.hv-pulse .w-people .hv-ring { padding: .2rem; background: conic-gradient(from 210deg, #ff3d81, #ff9d2e, #b14dff, #ff3d81); }
.hv-pulse .w-people .hv-av { box-shadow: 0 0 0 .18rem #000; }
.hv-pulse .w-people .hv-person.add .hv-ring { background: none; }
.hv-pulse .w-people .hv-callbadge { border-color: #000; }
.p-hero { position: relative; overflow: hidden; padding: 1.4rem 1.2rem 1.2rem; border-radius: 2rem; display: flex; flex-direction: column; gap: .9rem;
  background: linear-gradient(125deg, #ff3d81, #b14dff 55%, #5b5bf0); background-size: 180% 180%; animation: hv-sheen 9s ease-in-out infinite alternate; }
.p-hero h1 { font-size: clamp(1.7rem, 7.4cqw, 2.4rem); font-weight: 900; letter-spacing: -.045em; line-height: 1.05; }
.p-hero .hv-quiet { color: rgba(255,255,255,.85); }
.p-hero .hv-join { background: #fff; border-color: transparent; } .p-hero .hv-join input { color: #111; } .p-hero .hv-join input::placeholder { color: #777; }
.hv-pulse .p-hero .hv-go { background: #000; color: #fff; }
.p-hero .hv-pill { background: rgba(0,0,0,.28); border-color: transparent; }
.p-cards { display: flex; gap: .7rem; overflow-x: auto; scroll-snap-type: x proximity; scroll-padding-left: 1rem; scrollbar-width: none; margin: 0 -1rem; padding: 0 1rem; }
.p-cards::-webkit-scrollbar { display: none; }
.hv-pulse .p-card { position: relative; flex: 0 0 auto; width: 10.5rem; height: 12.5rem; padding: .9rem; border-radius: 1.6rem; scroll-snap-align: start; text-align: left; display: flex; flex-direction: column; gap: .2rem; color: #fff;
  background: linear-gradient(160deg, hsl(var(--h) 85% 55%), hsl(calc(var(--h) + 70) 80% 38%)); transition: transform .2s cubic-bezier(.3,1.6,.5,1); }
.p-card:hover { transform: translateY(-.3rem) rotate(-1deg); } .p-card:active { transform: scale(.95); }
.p-card-k { font-size: .66rem; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; opacity: .85; }
.p-card b { font-size: 1.35rem; font-weight: 900; letter-spacing: -.03em; line-height: 1.08; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.p-card-s { font-size: .76rem; opacity: .85; }
.p-card-go { margin-top: auto; align-self: flex-start; display: inline-flex; align-items: center; gap: .35rem; padding: .4rem .8rem; border-radius: 99rem; background: rgba(0,0,0,.35); font-size: .8rem; font-weight: 700; }
.hv-pulse .p-live { position: relative; overflow: hidden; display: flex; flex-direction: column; gap: .25rem; align-items: flex-start; width: 100%; padding: 1.1rem 1.2rem; border-radius: 1.6rem; text-align: left;
  background: radial-gradient(120% 140% at 100% 0%, #ff9d2e 0%, #ff3d5e 35%, #2a0a18 80%); transition: transform .2s ease; }
.p-live:active { transform: scale(.97); }
.p-live b { font-size: 1.3rem; font-weight: 900; letter-spacing: -.03em; } .p-live > span:last-child { font-size: .8rem; opacity: .85; }
.p-live-tag { display: inline-flex; align-items: center; gap: .4rem; padding: .25rem .6rem; border-radius: 99rem; background: rgba(0,0,0,.4); font-size: .7rem; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
.p-live-tag .hv-dot { background: #fff; }
.hv-pulse .w-apps .hv-approw { margin: 0 -1rem; padding: 0 1rem; }
.hv-pulse .hv-app-pic { background: #16161a; border-radius: 1.1rem; }
.hv-pulse .p-col > .hv-rows, .hv-pulse .p-people .hv-rows, .hv-pulse .p-live ~ .hv-rows { background: #16161a; border-radius: 1.4rem; padding: .35rem; }
.p-tabs { position: absolute; left: 50%; bottom: .8rem; transform: translateX(-50%); z-index: 3; display: flex; align-items: center; gap: .1rem; padding: .35rem .5rem; border-radius: 99rem;
  background: rgba(22,22,26,.96); border: 1px solid #2a2a31; backdrop-filter: blur(1.2rem); -webkit-backdrop-filter: blur(1.2rem); box-shadow: 0 .8rem 2rem rgba(0,0,0,.6); }
.hv-pulse .p-tab { display: flex; flex-direction: column; align-items: center; gap: .1rem; width: 3.7rem; padding: .35rem 0; border-radius: 99rem; font-size: .62rem; font-weight: 700; color: #8a8a93; transition: color .15s ease; }
.p-tab .hv-i { width: 1.35rem; height: 1.35rem; }
.hv-pulse .p-tab.on { color: #fff; }
.hv-pulse .p-plus { width: 3.5rem; height: 3.5rem; margin: -.9rem .3rem; border-radius: 50%; display: grid; place-items: center; color: #fff; font-size: 1.3rem;
  background: linear-gradient(135deg, #ff3d81, #ff9d2e); box-shadow: 0 .4rem 1.4rem rgba(255,61,129,.55); transition: transform .2s cubic-bezier(.3,1.6,.5,1); }
.p-plus:hover { transform: scale(1.08) rotate(-4deg); } .p-plus:active { transform: scale(.9); }
@container hv (min-width: 900px) {
  .hv-pulse .hv-scroll { padding-left: 6.5rem; }
  .p-tabs { left: 1.2rem; top: 50%; bottom: auto; transform: translateY(-50%); flex-direction: column; padding: .6rem .4rem; border-radius: 2rem; }
  .hv-pulse .p-plus { margin: .4rem 0; }
  .p-col { max-width: 62rem; }
  .p-col.p-home { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); column-gap: 1.6rem; align-items: start; }
  .p-home > .hv-slot[data-slot="top"], .p-home > .hv-quiet { grid-column: 1 / -1; }
  .p-home > .hv-slot[data-slot="hero"] { grid-column: 1; } .p-home > .hv-slot[data-slot="feed"] { grid-column: 2; }
  .p-home .p-hero { padding: 2.2rem 1.8rem 1.8rem; } .p-home .p-hero h1 { font-size: 3rem; }
  .p-cards { margin: 0; padding: 0; } .hv-pulse .w-apps .hv-approw { margin: 0; padding: 0; flex-wrap: wrap; }
}
`,
  });
})(typeof window !== 'undefined' ? window : globalThis);
