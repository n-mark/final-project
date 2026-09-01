// ============================================================================
// k6 Load Test: Browsers — Search + Advert Views
// ============================================================================
//
// Usage:
//   k6 run tests_highload/load-test-browsers.js
//
// Env:
//   DAU_SCENARIO  - "1k" (default), "10k", "50k", "100k" or "1m"
//   TEST_DURATION - seconds (default: 60)
//   BASE_URL      - default: http://finalproj.local
//
// Examples:
//   DAU_SCENARIO=1k   k6 run tests_highload/load-test-browsers.js
//   DAU_SCENARIO=10k  k6 run tests_highload/load-test-browsers.js
//   DAU_SCENARIO=50k  k6 run tests_highload/load-test-browsers.js
//   DAU_SCENARIO=100k k6 run tests_highload/load-test-browsers.js
//   DAU_SCENARIO=1m   k6 run tests_highload/load-test-browsers.js
// ============================================================================

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://finalproj.local";
const DAU = (__ENV.DAU_SCENARIO || "1k").toLowerCase();
const DURATION = parseInt(__ENV.TEST_DURATION || "60");

const PEAK_RPS = {
  "1k":   { search: 2.30,  view: 1.20 },
  "10k":  { search: 23,    view: 12    },
  "50k":  { search: 115,   view: 58    },
  "100k": { search: 231,   view: 116   },
  "1m":   { search: 2300,  view: 1160  },
};
const tgt = PEAK_RPS[DAU] || PEAK_RPS["1k"];

const SLO = {
  "1k":   { s95: 1000, v95: 500,  avail: 0.99    },
  "10k":  { s95: 900,  v95: 450,  avail: 0.99    },
  "50k":  { s95: 650,  v95: 350,  avail: 0.9925  },
  "100k": { s95: 300,  v95: 200,  avail: 0.995   },
  "1m":   { s95: 200,  v95: 100,  avail: 0.999   },
}[DAU] || { s95: 1000, v95: 500, avail: 0.99 };

const searchDur = new Trend("search_dur_ms", true);
const viewDur   = new Trend("view_dur_ms", true);
const searchErr = new Rate("search_err");
const viewErr   = new Rate("view_err");
const searchCnt = new Counter("search_total");
const viewCnt   = new Counter("view_total");

var totalPeak = Math.max(1, Math.round(tgt.search * 0.67 + tgt.view * 0.33));

function peakStages(peak, sec) {
  var wu = Math.max(1, Math.min(60, Math.floor(sec * 0.1)));
  var ru = Math.max(1, Math.min(60, Math.floor(sec * 0.15)));
  var su = Math.max(1, sec - wu - ru * 2);
  var cd = Math.max(1, Math.min(60, Math.floor(sec * 0.1)));
  var p = Math.max(1, Math.round(peak));
  return [
    { duration: String(wu) + "s", target: 0 },
    { duration: String(ru) + "s", target: p },
    { duration: String(su) + "s", target: p },
    { duration: String(cd) + "s", target: 0 },
  ];
}

export let options = {
  scenarios: {
    browsing: {
      executor: "ramping-arrival-rate",
      startRate: 0,
      timeUnit: "1s",
      preAllocatedVUs: Math.max(10, totalPeak * 2),
      maxVUs: Math.max(20, totalPeak * 4),
      stages: peakStages(totalPeak, DURATION),
      exec: "browsingScenario",
      gracefulStop: "30s",
    },
  },
  thresholds: {
    "search_dur_ms": ["p(95)<" + String(SLO.s95), "p(99)<" + String(SLO.s95 * 2)],
    "view_dur_ms":   ["p(95)<" + String(SLO.v95), "p(99)<" + String(SLO.v95 * 2)],
    "search_err":    ["rate<" + String(1 - SLO.avail)],
    "view_err":      ["rate<" + String(1 - SLO.avail)],
  },
};

function randUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function randQuery() {
  var qs = ["jacket","shoes","dress","shirt","pants","bag","watch","hat",
            "scarf","boots","sneakers","coat","t-shirt","jeans","skirt",
            "sweater","hoodie","shorts","sandals","gloves"];
  return qs[Math.floor(Math.random() * qs.length)];
}

export function browsingScenario() {
  group("browsing", function() {
    var u = randUUID();
    var hdrs = { "X-User-Id": u };

    var q = randQuery();
    var r = http.get(BASE_URL + "/api/v1/search?q=" + encodeURIComponent(q), {
      headers: hdrs,
    });
    searchCnt.add(1);
    searchDur.add(r.timings.duration);

    var ok = check(r, {
      "search 200": function(rr) { return rr.status === 200; },
    });
    searchErr.add(!ok);

    if (ok) {
      try {
        var body = JSON.parse(r.body);
        var items = body.items || body.results || body;
        if (Array.isArray(items) && items.length > 0) {
          var aid = items[0].id || items[0].advert_id;
          if (aid) {
            var vr = http.get(BASE_URL + "/api/v1/adverts/" + aid, {
              headers: hdrs,
            });
            viewCnt.add(1);
            viewDur.add(vr.timings.duration);

            var vok = check(vr, {
              "view 200": function(rr) { return rr.status === 200; },
            });
            viewErr.add(!vok);
          }
        }
      } catch(e) {}
    }

    sleep(Math.random() * 3 + 0.5);
  });
}
