/*
 * ports/vp8.js: the picture half of the Node media port. Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * A host with no canvas still runs the page's packer (mesh-media.js createPacker). The packer speaks only to a surface:
 * resize, fill, stroke, blit, pixelate, glyph, letter, present, track. This file is that surface over I420, plus the
 * one VP8 encoder that turns each presented frame into RTP on a single werift video track. Geometry matches the canvas
 * surface (same rectangles, same order). Pixels are a YUV approximation of the same paints, not a canvas screenshot.
 *
 * THE CODEC is wasm (opts.libav: the path of the VP8 build). The encoder runs in a worker so a slow frame cannot stall
 * the participant. The participant sandbox loads no native code. Decode of a remote track stays in this realm, one
 * decoder per track, shared by every reader, freed when the last reader leaves.
 *
 * Usage: const vp8 = require('./ports/vp8.js').port({ libav, werift, timings, Worker }); then vp8.surface({ fps }).
 */
(function (root) {
  'use strict';

  // 5x7 Latin bitmap, one glyph per 35 bits, rows of 5. Lower case uses the capital: the bar is a measured run of
  // these cells, and a name that does not fit shrinks the same way the canvas bar does. A non-Latin string is drawn
  // as its Latin initials (one capital per word), so a face from another script still gets a short bar, never a gap.
  const FONT_ORDER = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-?';
  const FONT_BITS = (
    '00000000000000000000000000000000000' + // space
    '01110100011000111111100011000110001' + // A
    '11110100011111010001100011111010001' + // B
    '01110100011000010000100011000101110' + // C
    '11110100011000110001100011111010000' + // D
    '11111100001111010000100001111110000' + // E
    '11111100001111010000100001000010000' + // F
    '01110100011000010111100011000101110' + // G
    '10001100011111110001100011000110001' + // H
    '01110001000010000100001000010001110' + // I
    '00111000100001000010100101001001110' + // J (35)
    '10001100101110010010100101000110001' + // K
    '10000100001000010000100001111111111' + // L
    '10001110111010110001100011000110001' + // M
    '10001110011010110011100011000110001' + // N
    '01110100011000110001100011000101110' + // O
    '11110100011000111110100001000010000' + // P
    '01110100011000110001101011001001101' + // Q
    '11110100011000111110100101000110001' + // R
    '01111100000111000001000011111011110' + // S
    '11111001000010000100001000010000100' + // T
    '10001100011000110001100011000101110' + // U
    '10001100011000110001010100101000100' + // V
    '10001100011000110101101011010110001' + // W
    '10001010100010000100010101000110001' + // X
    '10001010100010000100001000010000100' + // Y
    '11111000010001000100010001000011111' + // Z
    '01110100011000110001100011000101110' + // 0
    '00100011000010000100001000010001110' + // 1
    '01110100010000100110010001000011111' + // 2
    '11110000010111000001000011000101110' + // 3
    '00100001100010101000111110001000010' + // 4
    '11111100001111000001000011000101110' + // 5
    '01110100001111010001100011000101110' + // 6
    '11111000010001000100001000010000100' + // 7
    '01110100010111010001100011000101110' + // 8
    '01110100011000101111000011000101110' + // 9
    '00000000000000000000000001100000000' + // .
    '00000000000011111000000000000000000' + // -
    '01110100010000100100001000000000100'   // ?
  );

  function glyphRows(ch) {
    if (ch === '…') return ['00000', '00000', '00000', '00000', '00000', '10101', '00000'];
    const u = String(ch).toUpperCase();
    const i = FONT_ORDER.indexOf(u);
    if (i < 0) return null;
    const s = FONT_BITS.slice(i * 35, i * 35 + 35);
    const rows = [];
    for (let r = 0; r < 7; r++) rows.push(s.slice(r * 5, r * 5 + 5));
    return rows;
  }

  function shownText(text) {
    const s = String(text);
    if (!/[^\u0000-\u007f]/.test(s)) return s;
    let ini = '';
    const words = s.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const m = /[A-Za-z]/.exec(words[i]);
      if (m) ini += m[0].toUpperCase();
    }
    return ini || '?';
  }

  function clamp8(n) { return n < 0 ? 0 : n > 255 ? 255 : n | 0; }

  // BT.601 limited. The packer names CSS colours; the planes store the same paint as Y, U, V.
  function yuvOf(r, g, b, a) {
    const y = 16 + (219 / 255) * (0.299 * r + 0.587 * g + 0.114 * b);
    const u = 128 + (224 / 255) * (-0.168736 * r - 0.331264 * g + 0.5 * b);
    const v = 128 + (224 / 255) * (0.5 * r - 0.418688 * g - 0.081312 * b);
    return { y: clamp8(Math.round(y)), u: clamp8(Math.round(u)), v: clamp8(Math.round(v)), a: a };
  }

  function parseColor(s) {
    if (s == null) return null;
    const str = String(s).trim();
    let m = /^#([0-9a-f]{3})$/i.exec(str);
    if (m) {
      const h = m[1];
      return yuvOf(parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), 1);
    }
    m = /^#([0-9a-f]{6})$/i.exec(str);
    if (m) {
      const h = m[1];
      return yuvOf(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1);
    }
    m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+)\s*)?\)$/i.exec(str);
    if (m) return yuvOf(+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]);
    return null;
  }

  function mix8(dst, src, a) { return clamp8(Math.round(dst + (src - dst) * a)); }

  function packedSize(w, h) { return (w * h * 3) >> 1; }
  function planeOffsets(w, h) {
    const ySize = w * h, cSize = (w * h) >> 2;
    return { ySize: ySize, cSize: cSize, uOff: ySize, vOff: ySize + cSize, cW: w >> 1, cH: h >> 1 };
  }
  function allocI420(w, h) {
    const data = new Uint8Array(packedSize(w, h));
    const ySize = w * h;
    data.fill(16, 0, ySize);
    data.fill(128, ySize);
    return { data: data, w: w, h: h };
  }

  // Even height, width a multiple of 16: I420 needs even sides, and a receiver that over-reads a
  // macroblock stride needs the width the packer already aligns. Pad the right and the bottom only,
  // so a tile's centre does not move.
  function alignSize(w, h) {
    let W = Math.max(16, w | 0), H = Math.max(2, h | 0);
    if (W & 1) W++;
    if (H & 1) H++;
    if (W % 16) W += 16 - (W % 16);
    return { w: W, h: H };
  }

  function scaleCrop(src, srcW, srcH, sx, sy, sw, sh, dstW, dstH) {
    const dst = allocI420(dstW, dstH);
    const s = planeOffsets(srcW, srcH);
    const d = planeOffsets(dstW, dstH);
    const sw0 = sw > 0 ? sw : 1, sh0 = sh > 0 ? sh : 1;
    for (let row = 0; row < dstH; row++) {
      const sy0 = Math.min(srcH - 1, Math.max(0, Math.floor(sy + (row + 0.5) * sh0 / dstH)));
      const srcRow = sy0 * srcW;
      const dstRow = row * dstW;
      for (let col = 0; col < dstW; col++) {
        const sx0 = Math.min(srcW - 1, Math.max(0, Math.floor(sx + (col + 0.5) * sw0 / dstW)));
        dst.data[dstRow + col] = src[srcRow + sx0];
      }
    }
    const sxC = sx / 2, syC = sy / 2, swC = sw0 / 2, shC = sh0 / 2;
    for (let row = 0; row < d.cH; row++) {
      const sy0 = Math.min(s.cH - 1, Math.max(0, Math.floor(syC + (row + 0.5) * shC / d.cH)));
      for (let col = 0; col < d.cW; col++) {
        const sx0 = Math.min(s.cW - 1, Math.max(0, Math.floor(sxC + (col + 0.5) * swC / d.cW)));
        dst.data[d.uOff + row * d.cW + col] = src[s.uOff + sy0 * s.cW + sx0];
        dst.data[d.vOff + row * d.cW + col] = src[s.vOff + sy0 * s.cW + sx0];
      }
    }
    return dst;
  }

  // Box average into q x q, the shrink half of a moderator blur. Nearest up is the caller's job.
  function boxDown(src, srcW, srcH, sx, sy, sw, sh, q) {
    const dst = allocI420(q, q);
    const s = planeOffsets(srcW, srcH);
    const d = planeOffsets(q, q);
    const sw0 = sw > 0 ? sw : 1, sh0 = sh > 0 ? sh : 1;
    for (let row = 0; row < q; row++) {
      const y0 = sy + row * sh0 / q, y1 = sy + (row + 1) * sh0 / q;
      const r0 = Math.min(srcH - 1, Math.max(0, Math.floor(y0)));
      const r1 = Math.min(srcH, Math.max(r0 + 1, Math.ceil(y1)));
      for (let col = 0; col < q; col++) {
        const x0 = sx + col * sw0 / q, x1 = sx + (col + 1) * sw0 / q;
        const c0 = Math.min(srcW - 1, Math.max(0, Math.floor(x0)));
        const c1 = Math.min(srcW, Math.max(c0 + 1, Math.ceil(x1)));
        let sum = 0, n = 0;
        for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) { sum += src[r * srcW + c]; n++; }
        dst.data[row * q + col] = n ? clamp8(Math.round(sum / n)) : 16;
      }
    }
    const sxC = sx / 2, syC = sy / 2, swC = sw0 / 2, shC = sh0 / 2;
    for (let row = 0; row < d.cH; row++) {
      const y0 = syC + row * shC / d.cH, y1 = syC + (row + 1) * shC / d.cH;
      const r0 = Math.min(s.cH - 1, Math.max(0, Math.floor(y0)));
      const r1 = Math.min(s.cH, Math.max(r0 + 1, Math.ceil(y1)));
      for (let col = 0; col < d.cW; col++) {
        const x0 = sxC + col * swC / d.cW, x1 = sxC + (col + 1) * swC / d.cW;
        const c0 = Math.min(s.cW - 1, Math.max(0, Math.floor(x0)));
        const c1 = Math.min(s.cW, Math.max(c0 + 1, Math.ceil(x1)));
        let su = 0, sv = 0, n = 0;
        for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) {
          su += src[s.uOff + r * s.cW + c];
          sv += src[s.vOff + r * s.cW + c];
          n++;
        }
        dst.data[d.uOff + row * d.cW + col] = n ? clamp8(Math.round(su / n)) : 128;
        dst.data[d.vOff + row * d.cW + col] = n ? clamp8(Math.round(sv / n)) : 128;
      }
    }
    return dst;
  }

  function blitI420(dst, dstW, dstH, dx, dy, src, srcW, srcH) {
    const s = planeOffsets(srcW, srcH);
    const d = planeOffsets(dstW, dstH);
    const x0 = dx | 0, y0 = dy | 0;
    for (let row = 0; row < srcH; row++) {
      const dy0 = y0 + row;
      if (dy0 < 0 || dy0 >= dstH) continue;
      let cs = 0, cd = 0, n = srcW;
      if (x0 < 0) { cs = -x0; n -= cs; cd = 0; } else cd = x0;
      if (cd + n > dstW) n = dstW - cd;
      if (n > 0) dst.set(src.subarray(row * srcW + cs, row * srcW + cs + n), dy0 * dstW + cd);
    }
    const dxc = x0 >> 1, dyc = y0 >> 1;
    for (let row = 0; row < s.cH; row++) {
      const dy0 = dyc + row;
      if (dy0 < 0 || dy0 >= d.cH) continue;
      let cs = 0, cd = dxc, n = s.cW;
      if (cd < 0) { cs = -cd; n -= cs; cd = 0; }
      if (cd + n > d.cW) n = d.cW - cd;
      if (n > 0) {
        dst.set(src.subarray(s.uOff + row * s.cW + cs, s.uOff + row * s.cW + cs + n), d.uOff + dy0 * d.cW + cd);
        dst.set(src.subarray(s.vOff + row * s.cW + cs, s.vOff + row * s.cW + cs + n), d.vOff + dy0 * d.cW + cd);
      }
    }
  }

  function latestI420(src) {
    const raw = src && src.raw;
    const frame = raw && typeof raw.latest === 'function' ? raw.latest() : null;
    if (!frame || !frame.data || !(frame.w > 0) || !(frame.h > 0)) return null;
    return frame;
  }

  function randU32() {
    try { return require('crypto').randomBytes(4).readUInt32BE(0) >>> 0; } catch (e) { return (Math.random() * 0x100000000) >>> 0; }
  }

  // RFC 7741 descriptor, the 4-octet form (X=1, I=1, M=1). S marks the first packet of the frame.
  // Payload including the descriptor stays at or under 1100 bytes, so a relay never splits it again.
  const VP8_CHUNK = 1100 - 4;
  function vp8Descriptor(start, pictureId) {
    const pid = pictureId & 0x7fff;
    return Buffer.from([0x80 | (start ? 0x10 : 0), 0x80, 0x80 | (pid >> 8), pid & 0xff]);
  }
  function parseVp8(buf, Vp8) {
    if (Vp8 && typeof Vp8.deSerialize === 'function') {
      const p = Vp8.deSerialize(buf);
      return {
        start: p.sBit === 1,
        key: !!(p.payloadHeaderExist && p.isKeyframe),
        payload: p.payload,
        pictureId: p.pictureId,
      };
    }
    let o = 0;
    if (!buf || buf.length < 1) return null;
    const b0 = buf[o++];
    const x = (b0 >> 7) & 1, s = (b0 >> 4) & 1, pid = b0 & 7;
    let iBit = 0, lBit = 0, tBit = 0, kBit = 0, pictureId = 0;
    if (x) {
      if (o >= buf.length) return null;
      const b1 = buf[o++];
      iBit = (b1 >> 7) & 1; lBit = (b1 >> 6) & 1; tBit = (b1 >> 5) & 1; kBit = (b1 >> 4) & 1;
    }
    if (iBit) {
      if (o >= buf.length) return null;
      const ext = (buf[o] >> 7) & 1;
      if (ext) {
        if (o + 1 >= buf.length) return null;
        pictureId = ((buf[o] & 0x7f) << 8) | buf[o + 1];
        o += 2;
      } else pictureId = buf[o++] & 0x7f;
    }
    if (lBit) o++;
    if (tBit || kBit) o++;
    if (o > buf.length) return null;
    const payload = buf.subarray(o);
    const header = s === 1 && pid === 0 && payload.length > 0;
    return { start: s === 1, key: header && (payload[0] & 1) === 0, payload: payload, pictureId: pictureId };
  }

  function workerCtor(opts) {
    if (opts && typeof opts.Worker === 'function') return opts.Worker;
    try { return require('worker_threads').Worker; } catch (e) { return null; }
  }

  // The encoder lives in the worker. libav is wasm; this thread only packetizes what comes back.
  function workerMain() {
    'use strict';
    const { parentPort, workerData } = require('worker_threads');
    const LibAV = require(workerData.libav);
    const OPTS = { deadline: 'realtime', 'cpu-used': '16', 'error-resilient': '1', 'lag-in-frames': '0', 'auto-alt-ref': '0' };
    let enc = null, ew = 0, eh = 0, efps = 0;
    function frameFromPacked(data, w, h, pts, forceKey) {
      const ySize = w * h, cSize = (w * h) >> 2;
      return {
        data: data, format: 0, width: w, height: h, pts: pts, ptshi: 0,
        key_frame: forceKey ? 1 : 0, pict_type: forceKey ? 1 : 0,
        layout: [
          { offset: 0, stride: w },
          { offset: ySize, stride: w >> 1 },
          { offset: ySize + cSize, stride: w >> 1 },
        ],
      };
    }
    async function openEnc(libav, w, h, fps, forceNew) {
      // A new encoder's first frame is a key. Size changes and key requests both reopen, so a
      // picture-loss request cannot be ignored by an encoder that keeps its own GOP.
      if (enc && !forceNew && ew === w && eh === h && efps === fps) return;
      if (enc) { try { await libav.ff_free_encoder(enc.c, enc.frame, enc.pkt); } catch (e) {} enc = null; }
      const opened = await libav.ff_init_encoder('libvpx', {
        ctx: {
          bit_rate: Math.max(800000, w * h * 6),
          pix_fmt: libav.AV_PIX_FMT_YUV420P,
          width: w, height: h, gop_size: 10000, max_b_frames: 0,
          framerate_num: fps, framerate_den: 1,
        },
        time_base: [1, fps],
        options: OPTS,
      });
      await libav.AVCodecContext_time_base_s(opened[1], 1, fps);
      await libav.AVCodecContext_max_b_frames_s(opened[1], 0);
      enc = { c: opened[1], frame: opened[2], pkt: opened[3] };
      ew = w; eh = h; efps = fps;
    }
    const ready = LibAV.LibAV({ noworker: true, nothreads: true }).then(async function (libav) {
      // First open pays for the wasm compile. The timed frame must not.
      const warm = await libav.ff_init_encoder('libvpx', {
        ctx: { bit_rate: 100000, pix_fmt: libav.AV_PIX_FMT_YUV420P, width: 16, height: 16, gop_size: 10000, max_b_frames: 0, framerate_num: 10, framerate_den: 1 },
        time_base: [1, 10], options: OPTS,
      });
      await libav.ff_free_encoder(warm[1], warm[2], warm[3]);
      parentPort.postMessage({ type: 'up' });
      return libav;
    }).catch(function (e) {
      try { parentPort.postMessage({ type: 'err', msg: String((e && e.stack) || e) }); } catch (e2) {}
      throw e;
    });
    let chain = Promise.resolve();
    parentPort.on('message', function (msg) {
      if (!msg || msg.type === 'close') return;
      if (msg.type !== 'frame') return;
      chain = chain.then(async function () {
        const libav = await ready;
        await openEnc(libav, msg.w, msg.h, msg.fps, !!msg.key);
        const t0 = Date.now();
        const copy = new Uint8Array(msg.data);
        const fr = frameFromPacked(copy, msg.w, msg.h, msg.pts | 0, !!msg.key);
        const pkts = await libav.ff_encode_multi(enc.c, enc.frame, enc.pkt, [fr], false);
        const dt = Date.now() - t0;
        const out = [];
        for (let i = 0; i < (pkts ? pkts.length : 0); i++) {
          const p = pkts[i];
          if (!p || !p.data || !p.data.length) continue;
          out.push({ data: new Uint8Array(p.data), flags: p.flags | 0 });
        }
        parentPort.postMessage({ type: 'pkt', id: msg.id, dt: dt, w: msg.w, h: msg.h, pkts: out });
      }).catch(function (e) {
        try { parentPort.postMessage({ type: 'err', msg: String((e && e.stack) || e) }); } catch (e2) {}
      });
    });
  }

  const pliOf = new WeakMap();
  const rxOf = new WeakMap();
  const hookedSenders = new WeakSet();
  const watchedPc = new WeakSet();
  const pcs = new Set();

  // A PLI or FIR names this sender's own SSRC and stops there. werift does not walk it to the
  // track's source. An encoder track answers from pliOf (one key per VP8_PLI_GAP_MS). A forwarded
  // track has no encoder here: ask the upstream receiver, so the request reaches the encoder.
  // Read the track at the event. replaceTrack swaps it after this sender was hooked, and a
  // forwarded track is not in pliOf at hook time, which used to skip the subscribe entirely.
  function hookSender(sender) {
    if (!sender || hookedSenders.has(sender)) return;
    const loss = sender.onPictureLossIndication;
    const fir = sender.onKeyFrameRequest;
    const canLoss = loss && typeof loss.subscribe === 'function';
    const canFir = fir && typeof fir.subscribe === 'function';
    if (!canLoss && !canFir) return;
    hookedSenders.add(sender);
    let at = 0;
    const onNeed = function () {
      const now = Date.now();
      // One RTCP PLI fires both events in the same turn. One relay is enough.
      if (now === at) return;
      at = now;
      const tr = sender.track;
      if (!tr || tr.kind === 'audio') return;
      const f = pliOf.get(tr);
      if (typeof f === 'function') { f(); return; }
      askKey(tr);
    };
    if (canLoss) loss.subscribe(onNeed);
    if (canFir) fir.subscribe(onNeed);
  }
  function scanPc(pc) {
    if (!pc) return;
    pcs.add(pc);
    let senders = [];
    try { senders = pc.getSenders ? pc.getSenders() : []; } catch (e) { senders = []; }
    for (let i = 0; i < senders.length; i++) hookSender(senders[i]);
    let txs = [];
    try { txs = pc.getTransceivers ? pc.getTransceivers() : []; } catch (e) { txs = []; }
    for (let i = 0; i < txs.length; i++) {
      const rx = txs[i] && txs[i].receiver;
      const tr = rx && rx.track;
      if (tr && rx) rxOf.set(tr, rx);
      if (txs[i] && txs[i].sender) hookSender(txs[i].sender);
    }
  }
  function watchPeerConnection(PC) {
    if (!PC || !PC.prototype || watchedPc.has(PC.prototype)) return;
    watchedPc.add(PC.prototype);
    const origAdd = PC.prototype.addTrack;
    if (typeof origAdd === 'function') {
      PC.prototype.addTrack = function (track) {
        const args = [track];
        for (let i = 1; i < arguments.length; i++) args.push(arguments[i]);
        const sender = origAdd.apply(this, args);
        scanPc(this);
        hookSender(sender);
        return sender;
      };
    }
    const origRemote = PC.prototype.setRemoteDescription;
    if (typeof origRemote === 'function') {
      PC.prototype.setRemoteDescription = function () {
        const self = this, args = arguments;
        const p = origRemote.apply(self, args);
        const scan = function () { try { scanPc(self); } catch (e) {} };
        if (p && typeof p.then === 'function') return p.then(function (v) { scan(); return v; }, function (e) { scan(); throw e; });
        scan();
        return p;
      };
    }
    // Aux ships open a transceiver, not addTrack. Hook that sender now: the next
    // setRemoteDescription may be the answer, after the first PLI has already passed.
    const origTx = PC.prototype.addTransceiver;
    if (typeof origTx === 'function') {
      PC.prototype.addTransceiver = function () {
        const tx = origTx.apply(this, arguments);
        try { scanPc(this); if (tx && tx.sender) hookSender(tx.sender); } catch (e) {}
        return tx;
      };
    }
  }

  function receiverFor(track) {
    if (!track) return null;
    const hit = rxOf.get(track);
    if (hit && hit.track === track) return hit;
    let bySsrc = null;
    for (const pc of pcs) {
      try {
        const txs = pc.getTransceivers ? pc.getTransceivers() : [];
        for (let i = 0; i < txs.length; i++) {
          const rx = txs[i] && txs[i].receiver;
          if (!rx) continue;
          const rt = rx.track;
          if (rt === track) { rxOf.set(track, rx); return rx; }
          // The claim stream can hold a different object than the transceiver track
          // for the same SSRC. The PLI still has to leave on that receiver.
          if (bySsrc == null && track.ssrc != null && rt && rt.ssrc === track.ssrc) bySsrc = rx;
        }
      } catch (e) {}
    }
    if (bySsrc) { rxOf.set(track, bySsrc); return bySsrc; }
    return null;
  }
  function askKey(track) {
    // A track this port encodes has no receiver. The local decoder asks the encoder it belongs to.
    const local = pliOf.get(track);
    if (typeof local === 'function') { local(); return; }
    const rx = receiverFor(track);
    if (!rx || typeof rx.sendRtcpPLI !== 'function') return;
    let ssrc = track && track.ssrc;
    if (ssrc == null && rx.track && rx.track.ssrc != null) ssrc = rx.track.ssrc;
    if (ssrc == null && typeof rx.fallbackSsrc === 'number') ssrc = rx.fallbackSsrc;
    if (ssrc == null) return;
    try {
      const neg = typeof rx.pliNegotiation === 'function' ? rx.pliNegotiation(ssrc) : null;
      if (neg && neg.allowed === false) return;
      const p = rx.sendRtcpPLI(ssrc);
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (e) {}
  }
  // VP8 frame tag: 3 bytes, then 7 more for a key, then the first partition.
  // A shorter buffer is a truncated frame. Feeding it wedges libvpx until the decoder is freed.
  function vp8Complete(parts, isKey) {
    const head = parts && parts[0];
    if (!head || head.length < 3) return false;
    const part0 = ((head[0] & 0xe0) >> 5) | (head[1] << 3) | (head[2] << 11);
    let got = 0;
    for (let i = 0; i < parts.length; i++) got += parts[i].length;
    return got >= 3 + (isKey ? 7 : 0) + part0;
  }

  function port(opts) {
    opts = opts || {};
    // One picture-loss request per VP8_PLI_GAP_MS, from any sender of this track. A size change
    // is not limited: the new dimensions are undecodable until a keyframe, so the next presented frame is one.
    const PLI_GAP_MS = opts.timings && +opts.timings.VP8_PLI_GAP_MS;
    if (!(PLI_GAP_MS > 0)) throw new Error('vp8 port: opts.timings.VP8_PLI_GAP_MS is required');
    // One ask per PLI gap per tap. A decode error used to ask on every failed frame.
    function askSlot(slot, track) {
      const now = Date.now();
      if (slot && slot.askedAt && now - slot.askedAt < PLI_GAP_MS) return;
      if (slot) slot.askedAt = now;
      askKey(track || (slot && slot.track));
    }
    const libavPath = opts.libav;
    if (typeof libavPath !== 'string' || !libavPath) throw new Error('vp8 port: opts.libav (the path of the VP8 wasm build) is required');
    const portW = opts.werift;
    if (!portW || typeof portW.MediaStreamTrack !== 'function' || typeof portW.RtpPacket !== 'function' || typeof portW.RtpHeader !== 'function') throw new Error('vp8 port: opts.werift with MediaStreamTrack, RtpPacket and RtpHeader is required');
    const Worker = workerCtor(opts);
    if (typeof Worker !== 'function') throw new Error('vp8 port: a Worker constructor is required');
    watchPeerConnection(portW.RTCPeerConnection);
    const Vp8 = portW.Vp8RtpPayload || null;

    const decoders = new WeakMap();
    let libavP = null;
    function libavFactory() {
      let mod = opts.LibAV || null;
      if (!mod) {
        try { mod = require(libavPath); } catch (e) { mod = null; }
      }
      if (mod && typeof mod.LibAV === 'function') return mod.LibAV;
      if (typeof mod === 'function') return mod;
      return null;
    }
    function libav() {
      if (!libavP) {
        const factory = libavFactory();
        if (!factory) libavP = Promise.reject(new Error('vp8 port: the VP8 wasm build did not load'));
        else libavP = factory({ noworker: true, nothreads: true });
      }
      return libavP;
    }
    let decChain = Promise.resolve();

    function decodeTap(track) {
      if (!track) throw new Error('vp8 port: decodeTap needs a video track');
      let slot = decoders.get(track);
      if (!slot) {
        slot = {
          readers: 0, latest: null, needKey: true, parts: [], key: false, dead: false,
          dec: null, unsub: null, chain: Promise.resolve(), track: track,
          seen: 0, assembled: 0, decoded: 0, dropped: 0, err: '',
          started: false, pic: null,
        };
        decoders.set(track, slot);
        // Ask again while non-keys are dropped, no faster than the encoder's own gap.
        // The first ask often lands before the remote SSRC is learned, and a tap
        // opened mid-GOP then dropped every later delta without asking a second time.
        function askSoon() { askSlot(slot, track); }
        askSoon();
        const onPkt = function (rtp) {
          if (slot.dead || !rtp || !rtp.payload) return;
          slot.seen++;
          let parsed = null;
          try { parsed = parseVp8(rtp.payload, Vp8); } catch (e) { slot.err = String((e && e.message) || e).slice(0, 180); parsed = null; }
          if (!parsed) { if (!slot.err) slot.err = 'unparsed'; return; }
          if (parsed.start) {
            slot.parts = [Uint8Array.from(parsed.payload)];
            slot.key = parsed.key;
            slot.pic = parsed.pictureId;
            slot.started = true;
          } else {
            // A continuation with no start, or of another picture, is not a frame.
            if (!slot.started) return;
            if (slot.pic != null && parsed.pictureId != null && parsed.pictureId !== slot.pic) {
              slot.started = false;
              slot.parts = [];
              return;
            }
            slot.parts.push(Uint8Array.from(parsed.payload));
          }
          if (!(rtp.header && rtp.header.marker)) return;
          const parts = slot.parts; slot.parts = [];
          const isKey = slot.key;
          const started = slot.started;
          slot.started = false;
          slot.assembled++;
          if (!started || (slot.needKey && !isKey) || !vp8Complete(parts, isKey)) {
            slot.needKey = true;
            slot.dropped++;
            askSoon();
            return;
          }
          let n = 0;
          for (let i = 0; i < parts.length; i++) n += parts[i].length;
          const bytes = new Uint8Array(n);
          let at = 0;
          for (let i = 0; i < parts.length; i++) { bytes.set(parts[i], at); at += parts[i].length; }
          const ts = rtp.header ? rtp.header.timestamp : 0;
          slot.chain = slot.chain.then(function () { return decodeFrame(slot, bytes, ts, isKey); }).catch(function () { slot.needKey = true; askSlot(slot, track); });
        };
        if (track.onReceiveRtp && typeof track.onReceiveRtp.subscribe === 'function') {
          const sub = track.onReceiveRtp.subscribe(onPkt);
          slot.unsub = sub && (sub.unSubscribe || sub.unsubscribe);
        }
        slot.free = function () {
          if (slot.dead) return;
          slot.dead = true;
          try { if (typeof slot.unsub === 'function') slot.unsub(); } catch (e) {}
          const dec = slot.dec;
          slot.dec = null;
          if (dec) decChain = decChain.then(function () { return dec.libav.ff_free_decoder(dec.c, dec.pkt, dec.frame); }).catch(function () {});
        };
      }
      slot.readers++;
      let gone = false;
      return {
        latest: function () { return slot.latest; },
        info: function () { return { seen: slot.seen, assembled: slot.assembled, decoded: slot.decoded, dropped: slot.dropped, needKey: slot.needKey, err: slot.err }; },
        close: function () {
          if (gone) return;
          gone = true;
          slot.readers--;
          if (slot.readers <= 0) { slot.free(); decoders.delete(track); }
        },
      };
    }

    function decodeFrame(slot, bytes, ts, isKey) {
      return decChain = decChain.then(async function () {
        if (slot.dead) return;
        const av = await libav();
        if (!slot.dec) {
          // This wasm build registers the VP8 decoder under the same name as the encoder.
          const opened = await av.ff_init_decoder('libvpx');
          slot.dec = { libav: av, c: opened[1], pkt: opened[2], frame: opened[3] };
        }
        const frames = await av.ff_decode_multi(slot.dec.c, slot.dec.pkt, slot.dec.frame, [{ data: bytes }], { copyoutFrame: 'video_packed' });
        if (slot.dead) return;
        if (!frames || !frames.length) {
          // An empty key did not start a GOP. Keep waiting and ask again.
          if (isKey) { slot.needKey = true; askSlot(slot, slot.track); }
          return;
        }
        const last = frames[frames.length - 1];
        slot.latest = packedFrom(last, ts);
        slot.decoded++;
        slot.needKey = false;
        const waiters = slot.waiters || [];
        slot.waiters = [];
        for (let i = 0; i < waiters.length; i++) { try { waiters[i](); } catch (e) {} }
      }).catch(function (e) {
        slot.needKey = true;
        slot.err = String((e && e.message) || e).slice(0, 180);
        // A truncated frame leaves libvpx unable to take the next key. Drop this decoder.
        const dec = slot.dec;
        slot.dec = null;
        if (dec) decChain = decChain.then(function () { return dec.libav.ff_free_decoder(dec.c, dec.pkt, dec.frame); }).catch(function () {});
        askSlot(slot, slot.track);
      });
    }

    function packedFrom(frame, ts) {
      const w = frame.width | 0, h = frame.height | 0;
      if (!frame.layout) {
        const data = new Uint8Array(packedSize(w, h));
        const src = frame.data || new Uint8Array(0);
        data.set(src.subarray(0, Math.min(data.length, src.length)));
        return { w: w, h: h, data: data, ts: ts };
      }
      const out = new Uint8Array(packedSize(w, h));
      const o = planeOffsets(w, h);
      const src = frame.data;
      const yL = frame.layout[0], uL = frame.layout[1], vL = frame.layout[2];
      for (let row = 0; row < h; row++) out.set(src.subarray(yL.offset + row * yL.stride, yL.offset + row * yL.stride + w), row * w);
      for (let row = 0; row < o.cH; row++) {
        out.set(src.subarray(uL.offset + row * uL.stride, uL.offset + row * uL.stride + o.cW), o.uOff + row * o.cW);
        out.set(src.subarray(vL.offset + row * vL.stride, vL.offset + row * vL.stride + o.cW), o.vOff + row * o.cW);
      }
      return { w: w, h: h, data: out, ts: ts };
    }

    function source(track) {
      const tap = decodeTap(track);
      const slot = decoders.get(track);
      return {
        size: function () { const f = tap.latest(); return { w: f ? f.w : 0, h: f ? f.h : 0 }; },
        // One-shot, like requestVideoFrameCallback: the packer re-arms from inside the callback.
        onFrame: function (fn) { if (typeof fn === 'function') (slot.waiters = slot.waiters || []).push(fn); },
        raw: { latest: function () { return tap.latest(); } },
        close: function () { tap.close(); },
      };
    }

    function surface(cfg) {
      cfg = cfg || {};
      const fps = Math.max(1, Math.min(60, Math.round(cfg.fps || 12)));
      let W = 0, H = 0, buf = null;
      let track = null, cap = null, closed = false;
      let forceKey = true, lastKeyReq = 0, pts = 0, seq = randU32() & 0xffff, pictureId = randU32() & 0x7fff;
      let clock0 = null, lastRtp = 0, haveRtp = false, frameId = 0;
      let busy = false, pending = null, up = false, lastPresent = 0;
      const keys = [], costs = [], captures = new Map();
      function pushCap(arr, v) { arr.push(v); if (arr.length > 200) arr.splice(0, arr.length - 200); }
      let worker = null, readyResolve, readyReject;
      const ready = new Promise(function (res, rej) { readyResolve = res; readyReject = rej; });

      function ensure(w, h) {
        const n = alignSize(w, h);
        if (buf && n.w === W && n.h === H) return false;
        const changed = W !== 0 || H !== 0;
        W = n.w; H = n.h;
        buf = allocI420(W, H);
        if (changed) forceKey = true;
        return changed;
      }
      function clip(x, y, w, h) {
        const x0 = Math.max(0, Math.min(W, Math.round(x)));
        const y0 = Math.max(0, Math.min(H, Math.round(y)));
        const x1 = Math.max(x0, Math.min(W, Math.round(x + w)));
        const y1 = Math.max(y0, Math.min(H, Math.round(y + h)));
        return { x0: x0, y0: y0, x1: x1, y1: y1 };
      }
      function put(x, y, c) {
        if (!buf || x < 0 || y < 0 || x >= W || y >= H || !c || !(c.a > 0)) return;
        const o = planeOffsets(W, H);
        const yi = y * W + x;
        if (c.a >= 1) buf.data[yi] = c.y;
        else buf.data[yi] = mix8(buf.data[yi], c.y, c.a);
        if ((x & 1) || (y & 1)) return;
        const ci = (y >> 1) * o.cW + (x >> 1);
        if (c.a >= 1) { buf.data[o.uOff + ci] = c.u; buf.data[o.vOff + ci] = c.v; }
        else {
          buf.data[o.uOff + ci] = mix8(buf.data[o.uOff + ci], c.u, c.a);
          buf.data[o.vOff + ci] = mix8(buf.data[o.vOff + ci], c.v, c.a);
        }
      }
      function fill(color, x, y, w, h) {
        if (!buf) return;
        const c = parseColor(color);
        if (!c || !(c.a > 0)) return;
        const b = clip(x, y, w, h);
        if (c.a >= 1 && b.x0 === 0 && b.y0 === 0 && b.x1 === W && b.y1 === H) {
          buf.data.fill(c.y, 0, W * H);
          buf.data.fill(c.u, W * H, W * H + ((W * H) >> 2));
          buf.data.fill(c.v, W * H + ((W * H) >> 2));
          return;
        }
        for (let row = b.y0; row < b.y1; row++) {
          if (c.a >= 1) buf.data.fill(c.y, row * W + b.x0, row * W + b.x1);
          else for (let col = b.x0; col < b.x1; col++) buf.data[row * W + col] = mix8(buf.data[row * W + col], c.y, c.a);
        }
        const o = planeOffsets(W, H);
        const cx0 = b.x0 >> 1, cy0 = b.y0 >> 1, cx1 = b.x1 >> 1, cy1 = b.y1 >> 1;
        for (let row = cy0; row < cy1; row++) {
          for (let col = cx0; col < cx1; col++) {
            const i = o.uOff + row * o.cW + col, j = o.vOff + row * o.cW + col;
            if (c.a >= 1) { buf.data[i] = c.u; buf.data[j] = c.v; }
            else { buf.data[i] = mix8(buf.data[i], c.u, c.a); buf.data[j] = mix8(buf.data[j], c.v, c.a); }
          }
        }
      }
      function blit(src, sx, sy, sw, sh, dx, dy, dw, dh) {
        if (!buf) return;
        const frame = latestI420(src);
        // No plane to read: the cell stays the dark empty colour. Never leave the previous face.
        if (!frame) { fill('#07090c', dx, dy, dw, dh); return; }
        const dw0 = Math.max(2, Math.round(dw)), dh0 = Math.max(2, Math.round(dh));
        const evenW = dw0 + (dw0 & 1), evenH = dh0 + (dh0 & 1);
        const scaled = scaleCrop(frame.data, frame.w, frame.h, sx, sy, sw, sh, evenW, evenH);
        blitI420(buf.data, W, H, Math.round(dx), Math.round(dy), scaled.data, evenW, evenH);
      }
      function pixelate(src, sx, sy, sw, sh, q, dx, dy, dw, dh) {
        if (!buf) return;
        const frame = latestI420(src);
        if (!frame) { fill('#07090c', dx, dy, dw, dh); return; }
        let qq = Math.max(1, q | 0);
        if (qq & 1) qq++;
        if (qq < 2) qq = 2;
        const tiny = boxDown(frame.data, frame.w, frame.h, sx, sy, sw, sh, qq);
        const dw0 = Math.max(2, Math.round(dw)), dh0 = Math.max(2, Math.round(dh));
        const evenW = dw0 + (dw0 & 1), evenH = dh0 + (dh0 & 1);
        const up = scaleCrop(tiny.data, qq, qq, 0, 0, qq, qq, evenW, evenH);
        blitI420(buf.data, W, H, Math.round(dx), Math.round(dy), up.data, evenW, evenH);
      }
      function drawGlyph(ch, x, y, scale, color) {
        const rows = glyphRows(ch);
        const c = parseColor(color);
        if (!rows || !c) return;
        for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++) if (rows[r][col] === '1') {
          for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) put((x + col * scale + dx) | 0, (y + r * scale + dy) | 0, c);
        }
      }
      function glyph(ch, x, y, size, color) {
        if (!buf) return;
        const col = color || '#eef';   // the packer's marks are light; a seat's avatar letter names its own colour
        // A hand or a reaction is a mark, not a typed glyph: one filled square of the requested size.
        const s = Math.max(2, size | 0);
        if (ch === '✋' || /[^\u0000-\u007f]/.test(String(ch))) { fill(col, x, y, s, s); return; }
        const scale = Math.max(1, Math.round(s / 7));
        const str = shownText(ch);
        let tx = Math.round(x);
        for (let i = 0; i < str.length; i++) { drawGlyph(str[i], tx, Math.round(y), scale, col); tx += 6 * scale; }
      }
      // A seat's initial, centred in its square cell (the canvas surface draws it bold at ~half the cell).
      function letter(ch, x, y, cell, color) {
        if (!buf) return;
        const scale = Math.max(1, Math.round(Math.round(cell * 0.47) / 7));
        const c = shownText(ch).charAt(0);
        if (c) drawGlyph(c, Math.round(x + (cell - 5 * scale) / 2), Math.round(y + (cell - 7 * scale) / 2), scale, color);
      }
      function stroke(color, lw, x, y, w, h) {
        const t = Math.max(1, Math.round(lw));
        fill(color, x, y, w, t);
        fill(color, x, y + h - t, w, t);
        fill(color, x, y, t, h);
        fill(color, x + w - t, y, t, h);
      }

      function requestKey() {
        const now = Date.now();
        if (now - lastKeyReq < PLI_GAP_MS) return;
        lastKeyReq = now;
        forceKey = true;
        // A KEY REQUEST IS ANSWERED AT ONCE. A packer whose sources did not move presents only every STILL_MAX_MS, and an
        // avatar presents once per STILL_MAX_MS, so a new receiver's picture-loss request would wait up to that long for
        // the next present (and once more at each hop down a pack chain). The buffer still holds the last painted frame:
        // present it again now, as the key. For a surface that presents at its own pace that is one extra frame per
        // request, and requests are already held to one per PLI_GAP_MS. Nothing is painted before the first present.
        if (up && buf && !busy && !pending && lastPresent) present();
      }

      function pump() {
        if (closed || busy || !pending || !worker) return;
        const job = pending;
        pending = null;
        busy = true;
        try { worker.postMessage(job, [job.data.buffer]); } catch (e) { busy = false; }
      }
      function present() {
        if (closed || !buf || !worker) return;
        const copy = new Uint8Array(buf.data);
        const key = forceKey;
        if (key) { forceKey = false; lastKeyReq = Date.now(); }
        const id = ++frameId;
        const capture = Date.now();
        lastPresent = capture;
        captures.set(id, capture);
        if (captures.size > 32) captures.delete(captures.keys().next().value);
        const job = { type: 'frame', id: id, w: W, h: H, fps: fps, pts: pts++, key: key, data: copy };
        if (pending && pending.key) job.key = true;
        pending = job;
        pump();
      }
      function onWorker(msg) {
        if (!msg) return;
        if (msg.type === 'up') { up = true; if (readyResolve) readyResolve(); return; }
        if (msg.type === 'err') {
          forceKey = true;
          busy = false;
          if (!up) {
            if (readyReject) { readyReject(new Error(msg.msg || 'vp8 encoder failed')); readyReject = null; }
            return;
          }
          pump();
          return;
        }
        if (msg.type !== 'pkt') return;
        busy = false;
        if (typeof msg.dt === 'number') pushCap(costs, msg.dt);
        if (!closed && track && !track.stopped) writeFrame(msg);
        pump();
      }
      function writeFrame(msg) {
        const pkts = msg.pkts || [];
        if (!pkts.length) { forceKey = true; return; }
        let key = false;
        const capture = captures.has(msg.id) ? captures.get(msg.id) : Date.now();
        captures.delete(msg.id);
        if (clock0 == null) clock0 = capture;
        let rtpTs = Math.round((capture - clock0) * 90) >>> 0;
        if (haveRtp && rtpTs <= lastRtp) rtpTs = (lastRtp + 90) >>> 0;
        for (let i = 0; i < pkts.length; i++) {
          const raw = pkts[i].data;
          if (!raw || !raw.length) continue;
          if ((raw[0] & 1) === 0) key = true;
          if (pkts[i].flags & 1) key = true;
          const pid = pictureId;
          pictureId = (pictureId + 1) & 0x7fff;
          const ts = (rtpTs + i * 90) >>> 0;
          const chunks = Math.max(1, Math.ceil(raw.length / VP8_CHUNK));
          for (let c = 0; c < chunks; c++) {
            const start = c * VP8_CHUNK;
            const slice = raw.subarray(start, Math.min(raw.length, start + VP8_CHUNK));
            const desc = vp8Descriptor(c === 0, pid);
            const payload = Buffer.concat([desc, Buffer.from(slice)]);
            const header = new portW.RtpHeader({
              payloadType: (track.codec && track.codec.payloadType) || 96,
              sequenceNumber: seq & 0xffff,
              timestamp: ts,
              marker: c === chunks - 1,
              ssrc: track.ssrc,
            });
            seq = (seq + 1) & 0xffff;
            try { track.writeRtp(new portW.RtpPacket(header, payload)); } catch (e) {}
          }
          lastRtp = ts;
          haveRtp = true;
        }
        if (key) pushCap(keys, { at: Date.now(), w: msg.w, h: msg.h });
      }

      worker = new Worker('(' + workerMain.toString() + ')()', { eval: true, workerData: { libav: libavPath } });
      worker.on('message', onWorker);
      worker.on('error', function (e) { if (readyReject) { readyReject(e); readyReject = null; } });

      function close() {
        if (closed) return;
        closed = true;
        pending = null;
        try { worker.terminate(); } catch (e) {}
        try { if (track && !track.stopped) track.stop(); } catch (e) {}
      }
      function makeTrack() {
        if (track) return track;
        track = new portW.MediaStreamTrack({ kind: 'video', ssrc: randU32() || 1, muted: false });
        pliOf.set(track, requestKey);
        try { track.addEventListener('ended', function () { close(); }); } catch (e) {}
        if (typeof portW.MediaStream === 'function') cap = new portW.MediaStream([track]);
        api.stream = cap;
        return track;
      }

      const api = {
        resize: function (w, h) { ensure(w, h); },
        size: function () { return { w: W, h: H }; },
        fill: fill,
        stroke: stroke,
        blit: blit,
        pixelate: pixelate,
        glyph: glyph,
        letter: letter,
        present: present,
        track: makeTrack,
        stream: null,
        ready: ready,
        keys: keys,
        costs: costs,
        close: close,
      };
      return api;
    }

    return { decodeTap: decodeTap, source: source, surface: surface };
  }

  const api = { port: port };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { const GifOS = root.GifOS = root.GifOS || {}; GifOS.vp8Port = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
