// ============================================================================
// k6 Load Test: Sellers — Registration + Advert Creation
// ============================================================================
//
// Usage:
//   k6 run tests_highload/load-test-sellers.js
//
// Env:
//   DAU_SCENARIO  - "1k" (default), "50k", "100k" or "1m"
//   TEST_DURATION - seconds (default: 300)
//   BASE_URL      - default: http://finalproj.local
//
// Examples:
//   DAU_SCENARIO=1k   k6 run tests_highload/load-test-sellers.js
//   DAU_SCENARIO=50k  k6 run tests_highload/load-test-sellers.js
//   DAU_SCENARIO=100k k6 run tests_highload/load-test-sellers.js
//   DAU_SCENARIO=1m   k6 run tests_highload/load-test-sellers.js
// ============================================================================

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://finalproj.local";
const DAU = (__ENV.DAU_SCENARIO || "1k").toLowerCase();
const DURATION = parseInt(__ENV.TEST_DURATION || "300");

// Peak rates from ARCHITECTURE.md 2.6 (New Adverts peak, events/s)
// 1k DAU -> 0.006/s ; 50k DAU -> 0.29/s ; 100k DAU -> 0.58/s ; 1M DAU -> 5.8/s
// Для короткого теста ускоряем до практических минимумов (k6 не умеет < 1 итер/с)
var peakCreate = 1;
if (DAU === "100k") { peakCreate = 2; }
if (DAU === "1m")   { peakCreate = 6; }

// SLO availability (ARCHITECTURE.md 2.7)
const SLO_AVAIL = { "1k": 0.99, "50k": 0.9925, "100k": 0.995, "1m": 0.999 }[DAU] || 0.99;

// Metrics
const regDur     = new Trend("register_dur_ms", true);
const loginDur   = new Trend("login_dur_ms", true);
const createDur  = new Trend("create_dur_ms", true);
const inboxDur   = new Trend("inbox_poll_dur_ms", true);
const confirmDur = new Trend("confirm_dur_ms", true);

const regErr     = new Rate("register_err");
const loginErr   = new Rate("login_err");
const createErr  = new Rate("create_err");
const confirmErr = new Rate("confirm_err");

const regCnt     = new Counter("register_total");
const loginCnt   = new Counter("login_total");
const createCnt  = new Counter("create_total");
const confirmCnt = new Counter("confirm_total");

// Stages: ramp-up -> peak -> cooldown
function peakStages(peak, sec) {
  var wu = Math.max(1, Math.min(60, Math.floor(sec * 0.1)));
  var ru = Math.max(1, Math.min(60, Math.floor(sec * 0.2)));
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
    sellers: {
      executor: "ramping-arrival-rate",
      startRate: 0,
      timeUnit: "1s",
      preAllocatedVUs: Math.max(5, peakCreate * 5),
      maxVUs: Math.max(10, peakCreate * 10),
      stages: peakStages(peakCreate, DURATION),
      exec: "sellerFlow",
      gracefulStop: "60s",
    },
  },
  thresholds: {
    "create_dur_ms": ["p(95)<2000"],
    "register_err":  ["rate<" + String(1 - SLO_AVAIL)],
    "login_err":     ["rate<" + String(1 - SLO_AVAIL)],
    "create_err":    ["rate<" + String(1 - SLO_AVAIL)],
  },
};

function randBrand() {
  var ids = [
    "4804dea0-64c2-4a3e-97cf-1037bf11163d",
    "9e971d15-44c1-4bb6-80ad-1dae2c235782",
    "3308d810-a31b-474f-9712-2a79719816c0",
    "fe8f7917-edd9-4cc2-9080-40f06164f974",
  ];
  return ids[Math.floor(Math.random() * ids.length)];
}
function randPrice()  { return Math.floor(Math.random() * 50000) + 500; }
function randCond()   { return Math.floor(Math.random() * 5) + 1; }
function randGender() { return Math.random() > 0.5 ? "MALE" : "FEMALE"; }
function randSize()   { var s = ["XS","S","M","L","XL","XXL"]; return s[Math.floor(Math.random() * s.length)]; }

// ─────────────────────────────────────────────────────────────────────────────
// Seller flow: register → poll inbox → confirm → login → create advert
// ─────────────────────────────────────────────────────────────────────────────
export function sellerFlow() {
  group("seller-flow", function() {
    var userId = "";
    var token = "";
    var suffix = String(__VU) + "-" + String(Date.now()) + "-" + String(Math.floor(Math.random() * 100000));
    var username = "ltseller_" + suffix;
    var email    = "ltseller_" + suffix + "@example.com";
    var phone    = "+79" + suffix.slice(-9);

    // ── 1. Register ──
    var regResp = http.post(BASE_URL + "/api/v1/register", JSON.stringify({
      username: username,
      password: "Password123!",
      email: email,
      phone: phone,
    }), { headers: { "Content-Type": "application/json" } });
    regCnt.add(1);
    regDur.add(regResp.timings.duration);

    var regOk = check(regResp, {
      "register 201": function(r) { return r.status === 201; },
    });
    regErr.add(!regOk);

    if (regOk) {
      try { userId = JSON.parse(regResp.body).id; } catch(e) {}
    }

    // ── 2. Poll inbox_mock for confirmation token (async, до 10 попыток) ──
    var confirmToken = "";
    if (userId) {
      for (var attempt = 0; attempt < 10; attempt++) {
        var inboxResp = http.get(BASE_URL + "/api/v1/notification/inbox_mock/" + userId);
        inboxDur.add(inboxResp.timings.duration);
        if (inboxResp.status === 200) {
          try {
            var notifs = JSON.parse(inboxResp.body);
            if (Array.isArray(notifs) && notifs.length > 0) {
              var msg = notifs[0].message || notifs[0].text || "";
              var m = msg.match(/token=([a-f0-9]+)/);
              if (m) { confirmToken = m[1]; break; }
            }
          } catch(e) {}
        }
        sleep(1);
      }
    }

    // ── 3. Confirm account ──
    if (confirmToken) {
      var confResp = http.get(BASE_URL + "/api/v1/confirm?token=" + confirmToken);
      confirmCnt.add(1);
      confirmDur.add(confResp.timings.duration);
      var confOk = check(confResp, {
        "confirm 200": function(r) { return r.status === 200; },
      });
      confirmErr.add(!confOk);

      // ── 4. Login ──
      if (confOk) {
        var loginResp = http.post(BASE_URL + "/api/v1/login", JSON.stringify({
          username: username,
          password: "Password123!",
        }), { headers: { "Content-Type": "application/json" } });
        loginCnt.add(1);
        loginDur.add(loginResp.timings.duration);

        var logOk = check(loginResp, {
          "login 200": function(r) { return r.status === 200; },
        });
        loginErr.add(!logOk);

        if (logOk) {
          try { token = JSON.parse(loginResp.body).token; } catch(e) {}
        }
      }
    }

    // ── 5. Create advert ──
    if (userId && token) {
      var suffix2 = String(__VU) + "-" + String(Date.now());
      var createResp = http.post(BASE_URL + "/api/v1/adverts", JSON.stringify({
        title: "LoadTest Item " + suffix2,
        description: "Created at " + new Date().toISOString(),
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
        pictures: [{ url: "https://picsum.photos/seed/" + suffix2 + "/400/600", picture_order: 1 }],
        colors: [{ color: { id: "black" }, color_order: 1 }],
        categories: [{ id: "000000" }],
      }), {
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
          "Authorization": "Bearer " + token,
        },
      });
      createCnt.add(1);
      createDur.add(createResp.timings.duration);

      check(createResp, {
        "create advert 201": function(r) { return r.status === 201; },
      });
      createErr.add(createResp.status !== 201);
    }

    sleep(Math.random() * 2 + 1);
  });
}
