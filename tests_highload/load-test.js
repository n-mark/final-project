
// ============================================================================
// k6 Load Test: Final Project - Internet-сервис по размещению объявлений
// ============================================================================
//
// Usage:
//   k6 run tests_highload/load-test.js
//
// Environment variables:
//   DAU_SCENARIO     - DAU scenario: "1k" (default), "100k", "1m"
//   TEST_DURATION - test duration in seconds (default: 300)
//   BASE_URL   - base URL (default: http://finalproj.local)
//   DAILY_PATTERN   - enable daily pattern: "true"/"false" (default: false)
//
// Examples:
//   DAU_SCENARIO=100k k6 run tests_highload/load-test.js
//   DAU_SCENARIO=1m TEST_DURATION=600 k6 run tests_highload/load-test.js
//   DAILY_PATTERN=true DAU_SCENARIO=100k k6 run tests_highload/load-test.js
// ============================================================================

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://finalproj.local";
const DAU = (__ENV.DAU_SCENARIO || "1k").toLowerCase();
const DURATION = parseInt(__ENV.TEST_DURATION || "300");
const DAILY = (__ENV.DAILY_PATTERN || "false") === "true";

const PEAK_RPS = {
  "1k":   { search: 2.30, view: 1.20, create: 0.0060, order: 0.00060, bff: 0.50 },
  "100k": { search: 231,  view: 116,  create: 0.58,   order: 0.058,   bff: 50   },
  "1m":   { search: 2300, view: 1160, create: 5.80,   order: 0.580,  bff: 500  },
};

const SLO_TARGETS = {
  "1k":   { search95: 1000, view95: 500,  bff95: 500,  avail: 0.99  },
  "100k": { search95: 300,  view95: 200,  bff95: 150,  avail: 0.995 },
  "1m":   { search95: 200,  view95: 100,  bff95: 100,  avail: 0.999 },
};

const tgt = PEAK_RPS[DAU] || PEAK_RPS["1k"];
const slo = SLO_TARGETS[DAU] || SLO_TARGETS["1k"];

const DAILY_DIST = [
  { h:6,  pct:10.0 }, { h:7,  pct:58.9 }, { h:8,  pct:66.8 },
  { h:9,  pct:76.9 }, { h:10, pct:88.5 }, { h:11, pct:93.9 },
  { h:12, pct:96.6 }, { h:13, pct:100.0}, { h:14, pct:99.2 },
  { h:15, pct:97.5 }, { h:16, pct:96.2 }, { h:17, pct:93.5 },
  { h:18, pct:90.6 }, { h:19, pct:86.4 }, { h:20, pct:81.3 },
  { h:21, pct:74.4 }, { h:22, pct:65.6 }, { h:23, pct:51.4 },
  { h:0,  pct:31.1 }, { h:1,  pct:16.1 }, { h:2,  pct:8.1  },
  { h:3,  pct:4.0  }, { h:4,  pct:2.5  }, { h:5,  pct:3.5  },
];

// Custom metrics
const searchDur = new Trend("search_dur_ms", true);
const viewDur   = new Trend("view_dur_ms", true);
const bffDur    = new Trend("bff_dur_ms", true);
const createDur = new Trend("create_dur_ms", true);
const orderDur  = new Trend("order_dur_ms", true);

const searchErr = new Rate("search_err");
const viewErr   = new Rate("view_err");
const bffErr    = new Rate("bff_err");
const createErr = new Rate("create_err");
const orderErr  = new Rate("order_err");

const searchCnt = new Counter("search_total");
const viewCnt   = new Counter("view_total");
const createCnt = new Counter("create_total");
const orderCnt  = new Counter("order_total");

function makeDailyStages(peak, sec) {
  var spH = Math.max(1, sec / 24);
  var stages = [];
  for (var i = 0; i < DAILY_DIST.length; i++) {
    var cur = DAILY_DIST[i];
    var r = Math.max(0, Math.round(peak * cur.pct / 100));
    stages.push({ duration: String(Math.max(1, Math.round(spH))) + "s", target: r });
  }
  return stages;
}

function makePeakStages(peak, sec) {
  var wu = Math.max(1, Math.min(60, Math.floor(sec * 0.1)));
  var ru = Math.max(1, Math.min(60, Math.floor(sec * 0.15)));
  var su = Math.max(1, sec - wu - ru * 2);
  var cd = Math.max(1, Math.min(60, Math.floor(sec * 0.1)));
  return [
    { duration: String(wu) + "s", target: 0 },
    { duration: String(ru) + "s", target: Math.max(1, Math.round(peak)) },
    { duration: String(su) + "s", target: Math.max(1, Math.round(peak)) },
    { duration: String(cd) + "s", target: 0 },
  ];
}

var browsingPeak = tgt.search + tgt.view + tgt.bff;
var sellersPeak  = tgt.create + tgt.order;

var browsingStages = DAILY ? makeDailyStages(browsingPeak, DURATION) : makePeakStages(browsingPeak, DURATION);
var sellersStages  = DAILY ? makeDailyStages(sellersPeak, DURATION) : makePeakStages(sellersPeak, DURATION);

var browsingVUs = Math.max(20, Math.ceil(browsingPeak * 1.5));
var sellersVUs  = Math.max(5, Math.ceil(sellersPeak * 2));

export let options = {
  scenarios: {
    browsing: {
      executor: "ramping-arrival-rate",
      startRate: 0,
      timeUnit: "1s",
      preAllocatedVUs: browsingVUs,
      maxVUs: Math.max(50, browsingVUs * 2),
      stages: browsingStages,
      exec: "browsingScenario",
      gracefulStop: "30s",
    },
    sellers: {
      executor: "ramping-arrival-rate",
      startRate: 0,
      timeUnit: "1s",
      preAllocatedVUs: sellersVUs,
      maxVUs: Math.max(10, sellersVUs * 2),
      stages: sellersStages,
      exec: "sellerScenario",
      gracefulStop: "30s",
    },
  },
  thresholds: {
    "search_dur_ms": ["p(95)<" + String(slo.search95), "p(99)<" + String(slo.search95 * 2)],
    "view_dur_ms":   ["p(95)<" + String(slo.view95),   "p(99)<" + String(slo.view95 * 2)],
    "bff_dur_ms":    ["p(95)<" + String(slo.bff95),    "p(99)<" + String(slo.bff95 * 2)],
    "search_err":    ["rate<" + String(1 - slo.avail)],
    "view_err":      ["rate<" + String(1 - slo.avail)],
    "bff_err":       ["rate<" + String(1 - slo.avail)],
    "create_err":    ["rate<" + String(1 - slo.avail)],
    "order_err":     ["rate<" + String(1 - slo.avail)],
  },
};

function randUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function randSearchQuery() {
  var qs = ["jacket","shoes","dress","shirt","pants","bag","watch","hat","scarf","boots","sneakers","coat","t-shirt","jeans","skirt","sweater","hoodie","shorts","sandals","gloves"];
  return qs[Math.floor(Math.random() * qs.length)];
}

function randBrand() {
  var ids = [
    "4804dea0-64c2-4a3e-97cf-1037bf11163d",
    "9e971d15-44c1-4bb6-80ad-1dae2c235782",
    "3308d810-a31b-474f-9712-2a79719816c0",
    "fe8f7917-edd9-4cc2-9080-40f06164f974",
  ];
  return ids[Math.floor(Math.random() * ids.length)];
}

function randGender() { return Math.random() > 0.5 ? "MALE" : "FEMALE"; }
function randSize()   { var s = ["XS","S","M","L","XL","XXL"]; return s[Math.floor(Math.random() * s.length)]; }
function randPrice()  { return Math.floor(Math.random() * 50000) + 500; }
function randCond()   { return Math.floor(Math.random() * 5) + 1; }


// ────────────────────────────────────────────────────────────────────────────
// Browsing scenario (95% of users: search, view, BFF)
// ────────────────────────────────────────────────────────────────────────────
export function browsingScenario() {
  group("browsing", function() {
    var u = randUUID();
    var hdrs = { "X-User-Id": u };

    // 67% chance: search first
    if (Math.random() < 0.67) {
      var q = randSearchQuery();
      var r = http.get(BASE_URL + "/api/v1/search?q=" + encodeURIComponent(q), { headers: hdrs });
      searchCnt.add(1);
      var ok = check(r, { "search status 200": function(rr) { return rr.status === 200; } });
      searchDur.add(r.timings.duration);
      searchErr.add(!ok);

      // 50% chance to view an ad from search results
      if (ok && Math.random() < 0.5) {
        try {
          var body = JSON.parse(r.body);
          var items = body.items || body.results || body;
          if (Array.isArray(items) && items.length > 0) {
            var aid = items[0].id || items[0].advert_id;
            if (aid) {
              var vr = http.get(BASE_URL + "/api/v1/adverts/" + aid, { headers: hdrs });
              viewCnt.add(1);
              var vok = check(vr, { "view advert 200": function(rr) { return rr.status === 200; } });
              viewDur.add(vr.timings.duration);
              viewErr.add(!vok);
            }
          }
        } catch(e) {}
      }

      // 20% chance to visit BFF cabinet
      if (Math.random() < 0.2) {
        var br = http.get(BASE_URL + "/api/v1/bff/users/" + encodeURIComponent(u) + "/cabinet", { headers: hdrs });
        check(br, { "bff cabinet 200": function(rr) { return rr.status === 200; } });
        bffDur.add(br.timings.duration);
        bffErr.add(br.status !== 200);
      }

    // 33% chance: direct view (no search)
    } else {
      var vr = http.get(BASE_URL + "/api/v1/search/00000000-0000-0000-0000-000000000000", { headers: hdrs });
      viewCnt.add(1);
      var vok = check(vr, { "direct view 404": function(rr) { return rr.status === 404; } });
      viewDur.add(vr.timings.duration);
      viewErr.add(!vok);
    }

    sleep(Math.random() * 3 + 0.5);
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Seller scenario (5% of users: create adverts, orders)
// ────────────────────────────────────────────────────────────────────────────
export function sellerScenario() {
  group("seller", function() {
    var u = randUUID();
    var hdrs = { "Content-Type": "application/json", "X-User-Id": u };
    var suffix = String(__VU) + "-" + String(Date.now());

    var payload = JSON.stringify({
      title: "LoadTest Item " + suffix,
      description: "Load test item created at " + new Date().toISOString(),
      price: randPrice(),
      gender: randGender(),
      condition: randCond(),
      size_letter: randSize(),
      shipping_available: Math.random() > 0.3,
      brand: { id: randBrand() },
      address_attributes: {
        lat: "55.7558", lon: "37.6173",
        country: "Russia", countrycode: "RU",
        city: "Moscow", street: "Tverskaya",
        housenumber: "1", postcode: "101000",
      },
      pictures: [{ url: "https://picsum.photos/seed/" + suffix + "/400/600", picture_order: 1 }],
      colors: [{ color: { id: "black" }, color_order: 1 }],
      categories: [{ id: "000000" }],
    });

    var cr = http.post(BASE_URL + "/api/v1/adverts", payload, { headers: hdrs });
    createCnt.add(1);
    var cok = check(cr, { "create advert 201": function(rr) { return rr.status === 201; } });
    createDur.add(cr.timings.duration);
    createErr.add(!cok);

    // 2% chance to place an order on the created advert
    if (cok && Math.random() < 0.02) {
      try {
        var ca = JSON.parse(cr.body);
        if (ca.id) {
          var bid = randUUID();
          var or = http.post(BASE_URL + "/api/v1/order", JSON.stringify({ advert_id: ca.id }), {
            headers: { "Content-Type": "application/json", "X-User-Id": bid }
          });
          orderCnt.add(1);
          var ook = check(or, { "create order 201": function(rr) { return rr.status === 201; } });
          orderDur.add(or.timings.duration);
          orderErr.add(!ook);
        }
      } catch(e) {}
    }

    sleep(Math.random() * 5 + 2);
  });
}
