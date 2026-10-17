// Shared by rebroadcast specs: viewers spread across fleet machines, and a
// count of every byte the page's peer connections send.
import { chromium } from '@playwright/test';

// BC_VIEW_WS lists remote `npx playwright run-server` endpoints (comma
// separated). Viewer i runs on endpoint i mod n; with none, on this machine.
export async function viewerBrowsers(local) {
  const eps = (process.env.BC_VIEW_WS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const remotes = [];
  for (const ws of eps) remotes.push(await chromium.connect(ws, { exposeNetwork: '<loopback>' }));
  return { pick: (i) => (remotes.length ? remotes[i % remotes.length] : local), remote: remotes.length > 0, close: async () => { for (const r of remotes) await r.close(); } };
}

// Every RTCPeerConnection the page makes, so a test can sum outbound-rtp.
export const PC_TAP = () => {
  const Orig = window.RTCPeerConnection;
  const all = [];
  window.__pcs = all;
  window.RTCPeerConnection = function (...a) { const pc = new Orig(...a); all.push(pc); return pc; };
  window.RTCPeerConnection.prototype = Orig.prototype;
  Object.setPrototypeOf(window.RTCPeerConnection, Orig);
  window.__txBytes = async () => {
    let n = 0;
    for (const pc of all) {
      if (pc.connectionState === 'closed') continue;
      try { (await pc.getStats()).forEach((s) => { if (s.type === 'outbound-rtp') n += s.bytesSent || 0; }); } catch (e) {}
    }
    return n;
  };
};

// The page's upload in bytes per second over ms.
export async function upRate(page, ms) {
  const a = await page.evaluate(() => window.__txBytes());
  const t0 = Date.now();
  await page.waitForTimeout(ms);
  const b = await page.evaluate(() => window.__txBytes());
  return Math.round((b - a) * 1000 / (Date.now() - t0));
}
