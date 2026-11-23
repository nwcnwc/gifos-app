/*
 * meet-power.js — the meeting's power level, and every dial each level sets. No DOM.
 *
 * One level, three values:
 *   full  a computer on power (or a browser that cannot say: no Battery API and not a phone)
 *   save  any phone, plugged in or not (a phone's meeting load is close to what a USB charger
 *         gives, so it saves even on its charger), or a computer on battery
 *   low   a battery at or under POWER_LOW_PCT, a charger that is losing (plugged in, level
 *         falling), or a parked phone (nobody has touched it or spoken for IDLE_MS)
 *
 * The dials are what the page spends: the camera rung it sends (ladder steps down from the
 * room-size rung; each rung carries its own frame rate), the composites it paints for others, and the Stage strip.
 * Sound is never on a dial: every level hears and speaks the same. The screen is not a
 * power dial either: it follows presence (a parked phone lets it rest, whatever the level). The values live in GifOS.timings (source: gifos timings.json).
 */
(function (root) {
  const GifOS = root.GifOS = root.GifOS || {};
  const LEVELS = ['full', 'save', 'low'];

  // A phone or tablet. iPadOS Safari sends a Macintosh UA with no userAgentData,
  // so touch points on a Mac name it; a Mac with no touch points is a computer.
  function mobileDevice(nav) {
    nav = nav || {};
    return !!((nav.userAgentData && nav.userAgentData.mobile)
      || /Android|iPhone|iPad|Mobi/i.test(nav.userAgent || '')
      || ((nav.maxTouchPoints || 0) > 1 && /Mac/.test(nav.platform || '')));
  }

  // A CHARGER THAT IS LOSING: plugged in, and the level falls on two readings in a row
  // (one 1% wobble from adaptive charging is not a loss). It clears only once the level
  // rises past the reading that tripped it. Returns true on the reading that trips it.
  function drainStep(st, charging, level) {
    let tripped = false;
    if (charging && st.last !== null && st.last !== undefined) {
      if (level < st.last) {
        st.falls = (st.falls || 0) + 1;
        if (st.falls >= 2 && !st.losing) { st.losing = true; st.trip = level; tripped = true; }
      } else if (level > st.last) {
        st.falls = 0;
        if (st.losing && st.trip !== null && level > st.trip) { st.losing = false; st.trip = null; }
      }
    } else if (!charging) {
      st.losing = false; st.falls = 0; st.trip = null;
    }
    st.last = level;
    return tripped;
  }

  // s = { mobile, battery: null | { charging, level 0..1 }, losing, parked }
  // Returns { level, why }: why names the input that decided it.
  function level(s, T) {
    T = T || GifOS.timings || {};
    s = s || {};
    const b = s.battery;
    const onBattery = !!(b && !b.charging);
    if (s.parked) return { level: 'low', why: 'parked' };
    if (s.losing) return { level: 'low', why: 'losing' };
    if (onBattery && b.level * 100 <= T.POWER_LOW_PCT) return { level: 'low', why: 'battery-low' };
    if (s.mobile) return { level: 'save', why: 'phone' };
    if (onBattery) return { level: 'save', why: 'battery' };
    return { level: 'full', why: b ? 'charging' : 'unknown' };
  }

  // Every dial, per level. A dial a level does not move reads as the full value.
  //   rungShift   ladder steps below the room-size rung for my camera
  //   compFps     composite (mosaic/stadium) paint rate, as a fraction of SCALE.COMP_FPS
  //   compFpsMin  the composite floor in frames per second
  //   stageCell   Stage strip cell size, as a fraction of the room type's cell
  //   stageFps    Stage strip paint rate, as a fraction of STAGE_FPS
  //   stageKbps   the Stage and screen-share send budgets, as a fraction of their ceilings
  function dials(lv, T) {
    T = T || GifOS.timings || {};
    const pct = (k) => (T[k] == null ? 100 : T[k]) / 100;
    if (lv === 'low') return { level: 'low', rungShift: T.POWER_LOW_RUNG_SHIFT, compFps: pct('POWER_LOW_COMP_PCT'), compFpsMin: T.POWER_LOW_COMP_FPS_MIN, stageCell: pct('POWER_LOW_STAGE_CELL_PCT'), stageFps: pct('POWER_LOW_STAGE_FPS_PCT'), stageKbps: pct('POWER_LOW_STAGE_KBPS_PCT') };
    if (lv === 'save') return { level: 'save', rungShift: T.POWER_SAVE_RUNG_SHIFT, compFps: 1, compFpsMin: 0, stageCell: 1, stageFps: pct('POWER_SAVE_STAGE_FPS_PCT'), stageKbps: 1 };
    return { level: 'full', rungShift: 0, compFps: 1, compFpsMin: 0, stageCell: 1, stageFps: 1, stageKbps: 1 };
  }

  GifOS.meetPower = { LEVELS, mobileDevice, drainStep, level, dials };
})(typeof window !== 'undefined' ? window : globalThis);
