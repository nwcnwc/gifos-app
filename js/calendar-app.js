/*
 * calendar-app.js — builds the seeded Calendar from its own files.
 * Copyright (c) 2026 Crowd Concepts, Inc. All rights reserved.
 *
 * The page asks for the two documents. The calendar library is written into
 * the marker, so the app and its widgets each stay one file and do not fetch
 * anything themselves. If these files cannot be read, Calendar is left out
 * and the other apps still seed.
 */
(function (root) {
  'use strict';
  var GifOS = root.GifOS = root.GifOS || {};

  function text(url) {
    return fetch(url, { cache: 'force-cache' }).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.text();
    });
  }

  function files() {
    return Promise.all([
      text('js/calendar/ical.js'),
      text('js/calendar/app.html'),
      text('js/calendar/widget.html')
    ]).then(function (parts) {
      var lib = parts[0], app = parts[1], widget = parts[2];
      if (!lib || app.indexOf('/*@ical*/') < 0 || widget.indexOf('/*@ical*/') < 0) return null;
      return {
        'index.html': app.split('/*@ical*/').join(lib),
        'widget/index.html': widget.split('/*@ical*/').join(lib)
      };
    }).catch(function () { return null; });
  }

  GifOS.calendarApp = { files: files };
})(typeof window !== 'undefined' ? window : globalThis);
