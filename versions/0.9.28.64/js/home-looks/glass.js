/*
 * home-looks/glass.js — the Glass look of the Home Screen. Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * A LOOK IS ONE FILE: its name, its slots, how it draws, and its own CSS. It is listed once, in LOOK_IDS (js/home-view.js).
 * Glass: calm glass cards over a slow drifting light. Built in: the frame, the light, the greeting and the dock. Everything else is a widget in a slot, so a person can swap, remove, add and reorder it.
 */
(function (root) {
  'use strict';
  const HV = root.GifOS && root.GifOS.homeView; if (!HV) return;
  HV.look({
    id: 'glass', name: 'Glass', flavor: 'calm',
    sub: 'Calm and clear. A big clock, meeting first, your people next, apps in a dock.',
    // Two slots: beside the clock, and the wider column. On a phone they follow each other in one column.
    slots: {
      top: { sizes: ['wide', 'medium', 'small'], start: ['clock/now'] },
      first: { sizes: ['medium', 'wide', 'small'], start: ['rooms/missed', 'meet/join', 'rooms/people'] },
      main: { sizes: ['medium', 'small', 'wide', 'large'], grid: true, start: ['meet/recent', 'broadcast/live', 'calendar/today', 'calendar/month'] },
    },
    paint(el, d, api) {
      el.innerHTML = '<div class="hv-scroll"><div class="g-col"><div class="g-side">' +
        '<header class="g-head">' + api.slot('top') + '<div class="g-hello">' + api.esc(api.hello(d)) + '</div></header>' +
        api.slot('first') + '</div><div class="g-side">' + api.slot('main') +
        '<p class="hv-quiet g-foot">' + api.esc(api.words.honest) + '</p></div></div></div>' +
        '<nav class="g-dock" aria-label="' + api.esc(api.words.apps) + '"></nav>';
      const dock = el.querySelector('.g-dock');
      api.shortApps(api.width(el) < 560 ? 4 : 7).forEach((it) => dock.appendChild(api.appTile(it, 'dock')));
      dock.appendChild(api.allApps('dock all'));
    },
    css: `
.hv.hv-glass, .hv-skin-glass, body[data-hv="glass"] .menubar {
  --h-bg: #eef1fb; --h-ink: #16182b; --h-dim: #5d6282; --h-card: rgba(255,255,255,.62); --h-solid: #ffffff; --h-line: rgba(255,255,255,.85);
  --h-acc: #5b5bf0; --h-acc2: #ff7ab8; --h-on: #ffffff; --h-shadow: 0 .6rem 2rem rgba(60,60,130,.14); }
@media (prefers-color-scheme: dark) {
  .hv.hv-glass, .hv-skin-glass, body[data-hv="glass"] .menubar {
    --h-bg: #0d0f1f; --h-ink: #f1f2ff; --h-dim: #a3a8cf; --h-card: rgba(40,44,84,.5); --h-solid: #1a1d38; --h-line: rgba(255,255,255,.14);
    --h-acc: #8a8aff; --h-acc2: #ff7ab8; --h-on: #0d0f1f; --h-shadow: 0 .6rem 2rem rgba(0,0,0,.4); }
  body[data-hv="glass"] .menubar .pin-head-t { color: #ffb37a; }
  body[data-hv="glass"] #gifos-build-float { color: #fff; }
  body[data-hv="glass"] .menubar .brand { -webkit-text-fill-color: #fff; } }
.hv-glass::before, .hv-glass::after { content: ''; position: absolute; width: 70cqmax; height: 70cqmax; border-radius: 50%; filter: blur(5rem); opacity: .75; pointer-events: none; }
.hv-glass::before { left: -20cqmax; top: -30cqmax; background: radial-gradient(circle, #b9b4ff, transparent 65%); animation: hv-drift 26s ease-in-out infinite alternate; }
.hv-glass::after { right: -25cqmax; bottom: -30cqmax; background: radial-gradient(circle, #ffc2dc, #ffe6b8 40%, transparent 68%); animation: hv-drift 32s ease-in-out infinite alternate-reverse; }
@media (prefers-color-scheme: dark) {
  .hv-glass::before { background: radial-gradient(circle, #4338ca, transparent 65%); opacity: .6; }
  .hv-glass::after { background: radial-gradient(circle, #be185d, #7c2d12 45%, transparent 68%); opacity: .5; } }
.g-col { position: relative; z-index: 1; max-width: 40rem; margin: 0 auto; padding: 0 1rem; display: flex; flex-direction: column; gap: 1.1rem; }
.g-side { display: flex; flex-direction: column; gap: 1.1rem; min-width: 0; }
.hv-glass .hv-slot { gap: 1.1rem; }
.g-head, .hv-glass .hv-w { animation: hv-rise .6s cubic-bezier(.2,.9,.3,1) both; }
.hv-glass .hv-w:nth-child(2) { animation-delay: .06s; } .hv-glass .hv-w:nth-child(3) { animation-delay: .12s; } .hv-glass .hv-w:nth-child(n+4) { animation-delay: .18s; }
.g-head { text-align: center; padding: .6rem 0 .2rem; }
.g-hello { margin-top: .1rem; font-size: 1rem; font-weight: 600; color: var(--h-dim); }
.hv-glass .hv-w:not(.bare) { padding: 1.1rem; border-radius: 1.7rem; background: var(--h-card); border: 1px solid var(--h-line); box-shadow: var(--h-shadow); backdrop-filter: blur(1.6rem) saturate(1.6); -webkit-backdrop-filter: blur(1.6rem) saturate(1.6); }
.hv-glass .hv-w[data-w="meet/join"] { padding: 1.3rem; }
.hv-glass .w-join h1 { font-size: 1.7rem; letter-spacing: -.03em; }
.g-foot { text-align: center; }
.g-dock { position: absolute; left: 50%; bottom: 1rem; transform: translateX(-50%); z-index: 2; display: flex; gap: .1rem; padding: .55rem .5rem .4rem; border-radius: 1.8rem; max-width: calc(100% - 1.2rem);
  background: color-mix(in srgb, var(--h-solid) 90%, transparent); border: 1px solid var(--h-line); box-shadow: var(--h-shadow); backdrop-filter: blur(1.6rem) saturate(1.6); -webkit-backdrop-filter: blur(1.6rem) saturate(1.6); animation: hv-up .6s .2s cubic-bezier(.2,1.1,.3,1) both; }
#home-view .hv-app.dock, .hv-prev .hv-app.dock { width: 4.1rem; }
.hv-app.dock .hv-app-pic { width: 3rem; height: 3rem; background: var(--h-solid); }
.hv-app.dock .hv-app-n { font-size: .62rem; -webkit-line-clamp: 1; }
.hv-app.all .hv-app-pic { color: var(--h-acc); font-size: 1.4rem; }
@container hv (min-width: 1000px) {
  .hv-glass .g-col { max-width: 70rem; flex-direction: row; align-items: flex-start; gap: 1.6rem; padding-top: 1.5rem; }
  .hv-glass .g-side { flex: 1 1 0; min-width: 0; }
  .hv-glass .g-side + .g-side { flex: 1.25 1 0; }
  .hv-glass .g-head { text-align: left; padding-left: .4rem; }
  .hv-glass .hv-strip { flex-wrap: wrap; }
}
`,
  });
})(typeof window !== 'undefined' ? window : globalThis);
