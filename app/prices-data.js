/* Fit Hard own-currency prices (Tranche B, item 7).
   GENERATED FILE. Do not edit by hand; regenerate with
   hidden_files/gen_prices.cjs.
   Provenance: the priced lines below were extracted on
   2026-10-17 from the Finance desk's country build of record:
   GLOBAL-PRICING.md (the Fit Hard schedule table; the AU
   anchors locked in PLAN-fit-hard.md, approved 15 Oct 2026).
   One anchor economy prices each band in that build (A USD,
   B EUR, C JPY, D BRL, E PHP, F INR) beside the A$ anchor for
   Australia. The A$ worth of a band price is the AU anchor
   times the band factor (Finance's reading rule in the same
   file). A country with no priced line is NOT in the map:
   the app falls back to the A$ line and never invents a
   price. */
"use strict";
(function () {
  var FACTORS = {"A":1,"B":0.9,"C":0.75,"D":0.6,"E":0.45,"F":0.35};
  var ANCHORS = {"monthly":7.99,"yearly":59.99,"forever":149};
  var LINES = [
  {
    "key": "AU",
    "country": "Australia",
    "band": "A",
    "prices": {
      "monthly": "A$7.99",
      "yearly": "A$59.99",
      "forever": "A$149"
    }
  },
  {
    "key": "US",
    "country": "United States",
    "band": "A",
    "prices": {
      "monthly": "$5.99",
      "yearly": "$38.99",
      "forever": "$96.99"
    }
  },
  {
    "key": "EU",
    "country": "Euro area",
    "band": "B",
    "prices": {
      "monthly": "€4.99",
      "yearly": "€30.99",
      "forever": "€75.99"
    }
  },
  {
    "key": "JP",
    "country": "Japan",
    "band": "C",
    "prices": {
      "monthly": "¥590",
      "yearly": "¥4,500",
      "forever": "¥11,100"
    }
  },
  {
    "key": "BR",
    "country": "Brazil",
    "band": "D",
    "prices": {
      "monthly": "R$16.90",
      "yearly": "R$126.90",
      "forever": "R$313.90"
    }
  },
  {
    "key": "PH",
    "country": "Philippines",
    "band": "E",
    "prices": {
      "monthly": "₱129",
      "yearly": "₱1,019",
      "forever": "₱2,539"
    }
  },
  {
    "key": "IN",
    "country": "India",
    "band": "F",
    "prices": {
      "monthly": "₹149",
      "yearly": "₹1,199",
      "forever": "₹2,999"
    }
  }
];
  var BY_KEY = {};
  LINES.forEach(function (l) { BY_KEY[l.key] = l; });
  var COUNTRIES = {"AU":"AU","US":"US","JP":"JP","BR":"BR","PH":"PH","IN":"IN","AT":"EU","BE":"EU","CY":"EU","DE":"EU","EE":"EU","ES":"EU","FI":"EU","FR":"EU","GR":"EU","HR":"EU","IE":"EU","IT":"EU","LT":"EU","LU":"EU","LV":"EU","MC":"EU","MT":"EU","NL":"EU","PT":"EU","SI":"EU","SK":"EU","AD":"EU","SM":"EU","ME":"EU"};
  function fmtA(n) { return "A$" + n.toFixed(2); }
  /* worth of one product on one line, in A$ (Finance's rule:
     AU anchor x band factor). The home line's worth is its
     own price, so callers show no separate worth for it. */
  function worthOf(line, product) {
    if (!line || line.key === "AU") return null;
    return fmtA(ANCHORS[product] * FACTORS[line.band]);
  }
  function lineFor(countryCode) {
    var cc = String(countryCode || "").toUpperCase();
    var key = COUNTRIES[cc];
    return key ? BY_KEY[key] : null;
  }
  /* priceFor(cc, product) -> { text, worth, line } or null
     when the country has no priced line (the caller then
     uses the A$ home line). product: monthly|yearly|forever. */
  function priceFor(countryCode, product) {
    var line = lineFor(countryCode);
    if (!line) return null;
    return { text: line.prices[product], worth: worthOf(line, product), line: line.key };
  }
  function homePrice(product) { return BY_KEY.AU.prices[product]; }
  var api = { FACTORS: FACTORS, ANCHORS: ANCHORS, LINES: LINES, COUNTRIES: COUNTRIES,
              lineFor: lineFor, priceFor: priceFor, worthOf: worthOf, homePrice: homePrice };
  if (typeof window !== "undefined") window.FitPrices = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
