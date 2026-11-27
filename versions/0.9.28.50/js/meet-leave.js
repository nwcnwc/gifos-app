/*
 * meet-leave.js — hold and restore outgoing media while "Leave the meeting?"
 * is up. replaceTrack(null) stops the peer's frames without renegotiation;
 * track.enabled = false blacks the local preview and any composite that
 * draws it. Cancel puts back exactly the tracks and enabled flags that were
 * live, and never turns on a mic, camera, or share that was off.
 */
(function (root) {
  const GifOS = root.GifOS = root.GifOS || {};

  function callReplace(sender, track) {
    if (!sender || typeof sender.replaceTrack !== 'function') return;
    try {
      const r = sender.replaceTrack(track);
      if (r && typeof r.catch === 'function') r.catch(function () {});
    } catch (e) {}
  }

  function holdOutgoing(ctx) {
    ctx = ctx || {};
    const prev = {
      mic: !!ctx.mic,
      cam: !!ctx.cam,
      screen: !!ctx.screen,
      senders: [],
      tracks: [],
    };
    const senders = ctx.senders || [];
    for (let i = 0; i < senders.length; i++) {
      const s = senders[i];
      if (!s) continue;
      const track = s.track || null;
      const kind = s.kind || (track && track.kind) || '';
      prev.senders.push({ sender: s, kind: kind, track: track });
      if (kind === 'audio' || kind === 'video' || kind === '') callReplace(s, null);
    }
    const tracks = ctx.tracks || [];
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      if (!t) continue;
      prev.tracks.push({ track: t, enabled: !!t.enabled });
      try { t.enabled = false; } catch (e) {}
    }
    return prev;
  }

  // prev is the snapshot holdOutgoing returned. ctx.senders is ignored:
  // the snapshot holds the sender objects themselves, so a sender that
  // disappeared is simply skipped and one that was added is left alone.
  function releaseOutgoing(ctx, prev) {
    prev = prev || { mic: false, cam: false, screen: false, senders: [], tracks: [] };
    const dropped = [];
    const senders = prev.senders || [];
    for (let i = 0; i < senders.length; i++) {
      const s = senders[i];
      if (!s || !s.sender) continue;
      if (!s.track) continue; // was already off — stays off
      if (s.track.readyState === 'ended') { dropped.push(s.kind || 'track'); continue; }
      callReplace(s.sender, s.track);
    }
    const tracks = prev.tracks || [];
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      if (!t || !t.track) continue;
      if (t.track.readyState === 'ended') {
        try { t.track.enabled = false; } catch (e) {}
        dropped.push(t.track.kind || 'track');
        continue;
      }
      try { t.track.enabled = !!t.enabled; } catch (e) {}
    }
    return { mic: !!prev.mic, cam: !!prev.cam, screen: !!prev.screen, dropped: dropped };
  }

  const api = { holdOutgoing: holdOutgoing, releaseOutgoing: releaseOutgoing };
  GifOS.meetLeave = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
