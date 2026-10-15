"use strict";
/* WALLY the Wombat — Fit Hard guide companion.
   Art: the Innovation Lab's simple-flat make — the art of
   record, ruled by the Lab 14 Oct 2026: WELCOME =
   wally-simple-flat, REST = wally-simple-rest2, ROUGH DAY
   = wally-rough (the three frames on approved board v2).
   Flat shapes, white ground, ONE Wally in every state. His shape never changes; he never gets
   thinner, bigger or fitter. The friend does not change, so
   the user never has to earn him.
   HARD RULES (audience research + Lab pack direction):
   never sad at the user, never disappointed, never a coach;
   rest is his favourite state. Bubbles are short (max 6
   words a line), kind, and carry no dashes. The full Lab
   design pack (more poses + the naming spec) swaps in here
   when it lands; states below map onto the art of record. */
(function () {
  var ART = {
    welcome: "assets/wally-welcome.webp",
    rest: "assets/wally-rest.webp",
    rough: "assets/wally-rough.webp"
  };
  /* Pose = which piece of the art of record shows. The rest
     state is the burrow state: rough days and celebrations
     alike, he stays himself. */
  /* Three poses of record (Lab pack): WELCOME, REST and
     ROUGH DAY (blanket shawl + warm mug; staying in is a
     good day, shown proudly, never as consolation). */
  var POSES = {
    welcome: "welcome",
    bright: "welcome",
    celebrate: "welcome",
    soft: "rough",
    rough: "rough",
    rest: "rest"
  };
  function wallyImg(pose, size) {
    var src = ART[POSES[pose] || "welcome"];
    var px = size || 72;
    return '<img class="wallyImg" src="' + src + '" alt="" width="' + px + '" height="' + px + '">';
  }
  /* The pack's bubble list, verbatim (guide voice, max 6
     words a line, no dashes, no guilt shapes). Keys name
     the moment, not a mood. */
  var BUBBLES = {
    welcome: "You showed up. Noted.",
    bright: "Small counts.",
    soft: "Burrow day counts too.",
    rest: "Rest is training too.",
    tea: "Tea first. Then, maybe.",
    celebrateFirst: "Small counts.",
    celebrateWeek: "You showed up. Noted.",
    tomorrow: "Tomorrow is also a day."
  };
  window.Wally = { img: wallyImg, BUBBLES: BUBBLES, POSES: Object.keys(POSES) };
})();
