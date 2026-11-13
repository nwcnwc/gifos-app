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
 *   tips   tip price points in US cents -> product; a tip is a number of these
 *   tipMaxCents     the largest tip
 *   tipMaxQuantity  how many of one tip product one purchase may hold when
 *                   the APP sets the quantity (App Store: 10). 1 where the
 *                   buyer, not the app, picks a quantity (Google Play); that
 *                   store therefore carries a price point for each amount
 *                   the Tip app offers, so each is one purchase sheet.
 */
(function (root) {
  'use strict';
  const GifOS = (root.GifOS = root.GifOS || {});
  GifOS.storeSkus = {
    payee: 'gifos.app',
    tipMaxCents: 20000,
    play: {
      subs: {
        room20: { product: 'gifos_room20', monthly: 'monthly', yearly: 'yearly' },
        unlimited: { product: 'gifos_unlimited', monthly: 'monthly', yearly: 'yearly' }
      },
      pass: 'gifos_pass4h',
      tips: { '100': 'gifos_tip_1', '300': 'gifos_tip_3', '500': 'gifos_tip_5', '1000': 'gifos_tip_10', '2000': 'gifos_tip_20', '2500': 'gifos_tip_25', '10000': 'gifos_tip_100' },
      tipMaxQuantity: 1
    },
    appstore: {
      subs: {
        room20: { monthly: 'app.gifos.meet.room20.monthly', yearly: 'app.gifos.meet.room20.yearly' },
        unlimited: { monthly: 'app.gifos.meet.unlimited.monthly', yearly: 'app.gifos.meet.unlimited.yearly' }
      },
      pass: 'app.gifos.meet.pass4h',
      tips: { '100': 'app.gifos.meet.tip.1', '500': 'app.gifos.meet.tip.5', '2000': 'app.gifos.meet.tip.20', '10000': 'app.gifos.meet.tip.100' },
      tipMaxQuantity: 10
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
