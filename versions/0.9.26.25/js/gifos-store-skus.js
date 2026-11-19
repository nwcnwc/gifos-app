/*
 * gifos-store-skus.js — the products the GifOS Meet apps sell through the
 * store's own purchase sheet (Google Play, App Store). DATA ONLY: one table,
 * read by the apps' store rail and by the payment service, so both name the
 * same products. A request that maps to no row here is refused.
 *
 *   subs   plan -> the store product. Room 20 and Unlimited only: the
 *          $10 Streamer plan is sold only in the Broadcast app on the
 *          web, never in the GifOS Meet apps (Nathan 2026-11-13).
 *          Store (Google: one subscription per plan with
 *          base plans 'monthly' and 'yearly'; App Store: one product per plan
 *          and period, all in one subscription group)
 *   pass   the four-hour pass, a consumable
 *
 * No tips: the apps sell only GifOS's own plans and the pass (Nathan
 * 2026-11-13). Tips stay on the web, through PayPal. An app in a meeting
 * that asks for a payment gets the store rail's "sorry" (gifos-store-rail.js).
 */
(function (root) {
  'use strict';
  const GifOS = (root.GifOS = root.GifOS || {});
  GifOS.storeSkus = {
    payee: 'gifos.app',
    play: {
      subs: {
        room20: { product: 'gifos_room20', monthly: 'monthly', yearly: 'yearly' },
        unlimited: { product: 'gifos_unlimited', monthly: 'monthly', yearly: 'yearly' }
      },
      pass: 'gifos_pass4h'
    },
    appstore: {
      subs: {
        room20: { monthly: 'app.gifos.meet.room20.monthly', yearly: 'app.gifos.meet.room20.yearly' },
        unlimited: { monthly: 'app.gifos.meet.unlimited.monthly', yearly: 'app.gifos.meet.unlimited.yearly' }
      },
      pass: 'app.gifos.meet.pass4h'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
