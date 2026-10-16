/* FitAnim: the exercise animation rig.
   One figure, three skins (girl / boy / non-binary), posed by
   per-exercise tracks in anim-data.js (window.FIT_ANIM).
   The look of record: the picked sample, 15 Oct 2026 —
   flat outlined figure, Burrow Cream ground, ink outlines,
   sage kit, machines drawn simply and clearly.
   Wally in the player is the art of record itself
   (assets/wally-welcome.webp) — never redrawn here. */
(function () {
  "use strict";
  var INK = "#3E2F26", CREAM = "#FAEED6", SAGE = "#52695A", MIST = "#A9BFA5",
      TINT = "#DCE7D8", TAUPE = "#AC9278", SKIN = "#F2C49B", HAIR = "#7A5C43";
  var NS = "http://www.w3.org/2000/svg";
  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function lerp(a, b, f) { return a + (b - a) * f; }
  function lerpPt(a, b, f) { return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)]; }
  function ease(f) { return f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2; }

  /* ---- pose maths ---- */
  function poseAt(track, t) {
    var tm = track.t || [0.95, 1.45, 2.6], loop = tm[2];
    var tt = ((t % loop) + loop) % loop, A = track.keys[0], B = track.keys[1], f, out = {}, k;
    if (tt < tm[0]) f = ease(tt / tm[0]);
    else if (tt < tm[1]) f = 1;
    else f = 1 - ease((tt - tm[1]) / (loop - tm[1]));
    for (k in A) out[k] = (B && B[k]) ? lerpPt(A[k], B[k], f) : A[k];
    out._f = f;
    return out;
  }
  function phaseAt(track, t) {
    var tm = track.t || [0.95, 1.45, 2.6], loop = tm[2];
    var tt = ((t % loop) + loop) % loop;
    return tt < tm[0] ? 0 : (tt < tm[1] ? 1 : 2);
  }
  function keyPose(track, idx) { /* 0 start, 1 effort, 2 return (= start) */
    return idx === 1 ? track.keys[1] : track.keys[0];
  }

  /* ---- figure ---- */
  function limb(parent, wCol, wInk) {
    var g = el("g", {}, parent);
    var under = el("polyline", { fill: "none", stroke: INK, "stroke-width": wInk, "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
    var over = el("polyline", { fill: "none", stroke: wCol, "stroke-width": wCol === SKIN ? wInk - 4.5 : wInk - 4.5, "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
    return { under: under, over: over };
  }
  function pts(arr) { return arr.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" "); }
  function buildFigure(svg, view) {
    var g = el("g", { "data-figure": "1" }, svg);
    var F = { g: g, view: view };
    if (view === "front") {
      F.torso = el("path", { fill: SAGE, stroke: INK, "stroke-width": 2.5, "stroke-linejoin": "round" }, g);
      F.legL = limb(g, SKIN, 14); F.legR = limb(g, SKIN, 14);
      F.shorts = el("path", { fill: INK }, g);
      F.armL = limb(g, SKIN, 13); F.armR = limb(g, SKIN, 13);
      F.sleeveL = limb(g, SAGE, 15); F.sleeveR = limb(g, SAGE, 15);
    } else {
      F.legB = limb(g, SKIN, 14.5); F.armB = limb(g, SKIN, 12.5);
      F.torso = limb(g, SAGE, 21);
      F.legA = limb(g, SKIN, 15); F.armA = limb(g, SKIN, 13);
      F.sleeveA = limb(g, SAGE, 15); F.sleeveB = limb(g, SAGE, 14);
      F.shortsA = limb(g, INK, 17); F.shortsB = limb(g, INK, 16);
      F.shoeA = el("ellipse", { fill: SAGE, stroke: INK, "stroke-width": 2 }, g);
      F.shoeB = el("ellipse", { fill: SAGE, stroke: INK, "stroke-width": 2 }, g);
    }
    F.head = el("circle", { r: 12.5, fill: SKIN, stroke: INK, "stroke-width": 2.5 }, g);
    F.hair = el("path", { fill: HAIR, stroke: INK, "stroke-width": 2, "stroke-linejoin": "round" }, g);
    F.bun = el("circle", { r: 5.5, fill: HAIR, stroke: INK, "stroke-width": 2 }, g);
    return F;
  }
  function hairPath(skin, hd, view) {
    var x = hd[0], y = hd[1];
    if (view === "front") {
      if (skin === "boy") return "M " + (x - 12) + " " + (y - 2) + " A 12.5 12.5 0 0 1 " + (x + 12) + " " + (y - 2) + " L " + (x + 12) + " " + (y - 7) + " A 12.5 12.5 0 0 0 " + (x - 12) + " " + (y - 7) + " Z";
      if (skin === "nb") return "M " + (x - 13) + " " + (y + 10) + " L " + (x - 13) + " " + (y - 4) + " A 13 13 0 0 1 " + (x + 13) + " " + (y - 4) + " L " + (x + 13) + " " + (y + 10) + " L " + (x + 8) + " " + (y + 2) + " A 12.5 12.5 0 0 0 " + (x - 8) + " " + (y + 2) + " Z";
      return "M " + (x - 12) + " " + (y - 2) + " A 12.5 12.5 0 0 1 " + (x + 12) + " " + (y - 2) + " L " + (x + 12) + " " + (y - 6) + " A 12.5 12.5 0 0 0 " + (x - 12) + " " + (y - 6) + " Z";
    }
    /* side view: hair caps the back of the head */
    if (skin === "boy") return "M " + (x - 11) + " " + (y + 6) + " A 12.5 12.5 0 0 1 " + (x + 11) + " " + (y - 2) + " L " + (x + 6) + " " + (y - 6) + " A 10.5 10.5 0 0 0 " + (x - 6) + " " + (y + 1) + " Z";
    if (skin === "nb") return "M " + (x - 4) + " " + (y - 12) + " A 12.5 12.5 0 0 0 " + (x - 12) + " " + (y + 4) + " L " + (x - 12) + " " + (y + 13) + " L " + (x - 4) + " " + (y + 10) + " A 11 11 0 0 1 " + (x + 2) + " " + (y - 8) + " Z";
    return "M " + (x - 4) + " " + (y - 12) + " A 12.5 12.5 0 0 0 " + (x - 11) + " " + (y + 6) + " L " + (x - 5) + " " + (y + 1) + " A 10 10 0 0 1 " + (x + 2) + " " + (y - 8) + " Z";
  }
  function mid(a, b, f) { return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)]; }
  function applyPose(F, P, skin) {
    var view = F.view;
    F.head.setAttribute("cx", P.hd[0]); F.head.setAttribute("cy", P.hd[1]);
    F.hair.setAttribute("d", hairPath(skin, P.hd, view));
    if (skin === "girl") {
      F.bun.setAttribute("cx", view === "front" ? P.hd[0] : P.hd[0] - 10);
      F.bun.setAttribute("cy", P.hd[1] - 12);
      F.bun.style.display = "";
    } else F.bun.style.display = "none";
    if (view === "front") {
      var shL = [P.sh[0] - 17, P.sh[1]], shR = [P.sh[0] + 17, P.sh[1]];
      var hipL = [P.hip[0] - 10, P.hip[1]], hipR = [P.hip[0] + 10, P.hip[1]];
      F.torso.setAttribute("d", "M " + (shL[0] - 4) + " " + shL[1] + " L " + (shR[0] + 4) + " " + shR[1] +
        " L " + (hipR[0] + 5) + " " + (P.hip[1] + 4) + " L " + (hipL[0] - 5) + " " + (P.hip[1] + 4) + " Z");
      F.shorts.setAttribute("d", "M " + (hipL[0] - 6) + " " + P.hip[1] + " L " + (hipR[0] + 6) + " " + P.hip[1] +
        " L " + (P.kneR[0] + 3) + " " + mid(hipR, P.kneR, 0.45)[1] + " L " + (P.kneL[0] - 3) + " " + mid(hipL, P.kneL, 0.45)[1] + " Z");
      setLimb(F.legL, [hipL, P.kneL, P.ankL]); setLimb(F.legR, [hipR, P.kneR, P.ankR]);
      setLimb(F.sleeveL, [shL, mid(shL, P.elL, 0.55)]); setLimb(F.sleeveR, [shR, mid(shR, P.elR, 0.55)]);
      setLimb(F.armL, [shL, P.elL, P.haL]); setLimb(F.armR, [shR, P.elR, P.haR]);
      return;
    }
    var kneB = P.kne2 || [P.kne[0] + 7, P.kne[1] + 5], ankB = P.ank2 || [P.ank[0] + 7, P.ank[1] + 5];
    var elB = P.el2 || [P.el[0] - 5, P.el[1] + 6], haB = P.ha2 || [P.ha[0] - 5, P.ha[1] + 6];
    setLimb(F.legB, [P.hip, kneB, ankB]);
    setLimb(F.shortsB, [P.hip, mid(P.hip, kneB, 0.52)]);
    setShoe(F.shoeB, ankB, kneB);
    setLimb(F.armB, [P.sh, elB, haB]);
    setLimb(F.sleeveB, [P.sh, mid(P.sh, elB, 0.55)]);
    setLimb(F.torso, [P.hip, P.sh]);
    setLimb(F.legA, [P.hip, P.kne, P.ank]);
    setLimb(F.shortsA, [P.hip, mid(P.hip, P.kne, 0.52)]);
    setShoe(F.shoeA, P.ank, P.kne);
    setLimb(F.armA, [P.sh, P.el, P.ha]);
    setLimb(F.sleeveA, [P.sh, mid(P.sh, P.el, 0.55)]);
  }
  function setLimb(L, points) { var s = pts(points); L.under.setAttribute("points", s); L.over.setAttribute("points", s); }
  function setShoe(shoe, ank, kne) {
    var ang = Math.atan2(ank[1] - kne[1], ank[0] - kne[0]) * 180 / Math.PI;
    shoe.setAttribute("cx", ank[0] + 3); shoe.setAttribute("cy", ank[1] + 2);
    shoe.setAttribute("rx", 10); shoe.setAttribute("ry", 5.5);
    shoe.setAttribute("transform", "rotate(" + (ang * 0.35).toFixed(1) + " " + ank[0] + " " + ank[1] + ")");
  }

  /* ---- equipment scenes (static art, drawn behind the figure) ---- */
  var SCENES = {
    "none": '<path d="M56 240 L304 240" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>',
    "legpress":
      '<rect x="52" y="118" width="24" height="98" rx="4" fill="' + CREAM + '" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M58 132 h12 M58 146 h12 M58 160 h12 M58 174 h12 M58 188 h12" stroke="' + SAGE + '" stroke-width="4"/>' +
      '<path d="M52 222 L306 222" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M146 216 L292 158" stroke="' + MIST + '" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M96 200 L116 102 L134 106 L114 204 Z" fill="' + SAGE + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M112 192 L176 186 L176 200 L114 206 Z" fill="' + SAGE + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>',
    "legext":
      '<path d="M84 222 L268 222" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M140 182 L142 116 L158 116 L158 182 Z" fill="' + SAGE + '" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M146 172 L214 172 L214 186 L146 186 Z" fill="' + SAGE + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M214 186 L222 222 M150 186 L146 222" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>',
    "legcurl":
      '<path d="M84 222 L268 222" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M140 182 L142 116 L158 116 L158 182 Z" fill="' + SAGE + '" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M146 172 L214 172 L214 186 L146 186 Z" fill="' + SAGE + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M214 186 L222 222 M150 186 L146 222" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>',
    "pecdeck":
      '<path d="M52 226 L308 226" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>' +
      '<rect x="58" y="58" width="16" height="164" rx="5" fill="' + CREAM + '" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<rect x="286" y="58" width="16" height="164" rx="5" fill="' + CREAM + '" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M140 190 L220 190 L220 202 L140 202 Z" fill="' + SAGE + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M176 140 L184 140 L184 192 L176 192 Z" fill="' + SAGE + '" stroke="' + INK + '" stroke-width="2.5"/>',
    "smith":
      '<path d="M84 226 L292 226" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M104 226 L104 44 M256 226 L256 44" stroke="' + MIST + '" stroke-width="8" stroke-linecap="round"/>' +
      '<path d="M96 44 L264 44" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>',
    "latpd":
      '<path d="M96 226 L264 226" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M110 226 L110 40 M250 226 L250 40 M96 40 L264 40" stroke="' + INK + '" stroke-width="5" stroke-linecap="round" fill="none"/>' +
      '<path d="M146 196 L214 196 L214 208 L146 208 Z" fill="' + SAGE + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M158 168 L202 168 L202 180 L158 180 Z" fill="' + SAGE + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>',
    "cable":
      '<path d="M286 226 L340 226" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>' +
      '<rect x="306" y="30" width="20" height="196" rx="5" fill="' + CREAM + '" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M312 48 h8 M312 62 h8 M312 76 h8" stroke="' + SAGE + '" stroke-width="4"/><path d="M282 168 L294 168 L294 206 L282 206 Z" fill="' + MIST + '" stroke="' + INK + '" stroke-width="2.5"/>',
    "bench":
      '<path d="M70 226 L300 226" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M96 186 L268 186 L268 198 L96 198 Z" fill="' + SAGE + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M116 198 L110 226 M248 198 L254 226" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>',
    "hyper":
      '<path d="M70 226 L310 226" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M96 176 L216 156 L220 170 L100 190 Z" fill="' + SAGE + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M120 190 L112 226 M206 172 L214 226" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M58 152 L84 152 L84 168 L58 168 Z" fill="' + MIST + '" stroke="' + INK + '" stroke-width="2.5"/>',
    "bicep":
      '<path d="M84 222 L276 222" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M138 178 L140 122 L156 122 L156 178 Z" fill="' + SAGE + '" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M144 172 L206 172 L206 184 L144 184 Z" fill="' + SAGE + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M190 148 L222 164 L218 174 L188 160 Z" fill="' + MIST + '" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>',
    "calfstep":
      '<path d="M60 226 L320 226" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>' +
      '<rect x="140" y="206" width="110" height="20" rx="3" fill="' + MIST + '" stroke="' + INK + '" stroke-width="2.5"/>',
    "mat":
      '<rect x="52" y="212" width="256" height="13" rx="5" fill="' + TINT + '" stroke="' + INK + '" stroke-width="2.5"/>'
  };
  /* ---- movers (props that travel with a joint) ---- */
  function moverArt(kind) {
    if (kind === "plate") return '<rect x="-7" y="-30" width="14" height="60" rx="6" fill="' + SAGE + '" stroke="' + INK + '" stroke-width="2.5"/>';
    if (kind === "pad") return '<rect x="-16" y="-8" width="32" height="16" rx="7" fill="' + SAGE + '" stroke="' + INK + '" stroke-width="2.5"/>';
    if (kind === "db") return '<rect x="-13" y="-4" width="26" height="8" rx="3" fill="' + INK + '"/><rect x="-16" y="-9" width="7" height="18" rx="2.5" fill="' + INK + '"/><rect x="9" y="-9" width="7" height="18" rx="2.5" fill="' + INK + '"/>';
    if (kind === "disc") return '<circle r="17" fill="' + INK + '"/><circle r="6.5" fill="' + MIST + '"/>';
    if (kind === "handle") return '<path d="M-11 -7 L0 6 L11 -7" fill="none" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>';
    if (kind === "barwide") return '<path d="M-52 0 L52 0" stroke="' + INK + '" stroke-width="6" stroke-linecap="round"/><path d="M-52 0 L-58 8 M52 0 L58 8" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>';
    return "";
  }
  function buildStage(svg, track, skin) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var scene = el("g", {}, svg);
    scene.innerHTML = SCENES[track.scene || "none"] || "";
    var cables = [];
    (track.cables || []).forEach(function (c) {
      cables.push({ line: el("line", { x1: c.from[0], y1: c.from[1], x2: c.from[0], y2: c.from[1], stroke: c.color || INK, "stroke-width": c.w || 2.5, "stroke-linecap": "round" }, svg), joint: c.joint });
    });
    var F = buildFigure(svg, track.view || "side");
    var movers = [];
    (track.movers || []).forEach(function (m) {
      var g = el("g", {}, svg); g.innerHTML = moverArt(m.kind);
      movers.push({ g: g, joint: m.joint, dx: m.dx || 0, dy: m.dy || 0, rot: m.rot || 0 });
    });
    var barLine = null;
    if (track.barBetween) barLine = el("line", { stroke: INK, "stroke-width": 6, "stroke-linecap": "round" }, svg);
    return {
      apply: function (P) {
        applyPose(F, P, skin);
        cables.forEach(function (c) { var p = P[c.joint]; if (p) { c.line.setAttribute("x2", p[0]); c.line.setAttribute("y2", p[1]); } });
        movers.forEach(function (m) {
          var p = P[m.joint]; if (!p) return;
          m.g.setAttribute("transform", "translate(" + (p[0] + m.dx) + " " + (p[1] + m.dy) + ")" + (m.rot ? " rotate(" + m.rot + ")" : ""));
        });
        if (barLine && P[track.barBetween[0]] && P[track.barBetween[1]]) {
          barLine.setAttribute("x1", P[track.barBetween[0]][0]); barLine.setAttribute("y1", P[track.barBetween[0]][1]);
          barLine.setAttribute("x2", P[track.barBetween[1]][0]); barLine.setAttribute("y2", P[track.barBetween[1]][1]);
        }
      }
    };
  }

  /* ---- the player ---- */
  var PHASE_NAMES = ["setup", "push", "return"];
  function trackOf(id) {
    var T = window.FIT_ANIM || {};
    var tr = T[id];
    if (!tr || !tr.keys || !tr.keys[0] || !tr.keys[0].hip || !tr.keys[1]) return null;
    return tr;
  }
  /* The language layer, when it is on the page: a bubble
     resolves from the layer, else the track's own words
     (the English of record) show. */
  function animTr(key, fallback) {
    try {
      if (window.Lang && window.Lang.t) {
        var s = window.Lang.t(key);
        if (s && s !== key) return s;
      }
    } catch (e) {}
    return fallback;
  }
  function svgEl(cls) {
    var s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", "0 0 360 270");
    s.setAttribute("class", cls || "animSvg");
    s.setAttribute("role", "img");
    return s;
  }
  function mount(container, exId, opts) {
    opts = opts || {};
    var skin = opts.skin || "girl";
    var track = trackOf(exId);
    var dead = false, raf = 0, obs = null;
    container.innerHTML = "";
    var card = document.createElement("div");
    card.className = "animCard";
    container.appendChild(card);
    if (!track) {
      /* Poison leg (QA pin 8): calm placeholder, session continues. */
      card.className = "animCard animMissing";
      card.innerHTML = '<p class="hint">' + animTr("anim.missing", "The moving picture for this one is still being drawn. Your sets still count, exactly the same.") + '</p>';
      return { stop: function () {}, setFrozen: function () {}, setSkin: function () {}, setBubbles: function () {}, missing: true };
    }
    var stageDiv = document.createElement("div");
    stageDiv.className = "animStage";
    stageDiv.setAttribute("data-exercise", exId);
    stageDiv.setAttribute("data-phase", "setup");
    card.appendChild(stageDiv);

    var guide = document.createElement("div");
    guide.className = "animGuide";
    guide.innerHTML = '<img class="animWally" src="assets/wally-welcome.webp" alt="' + animTr("anim.wallyAlt", "Wally, your guide") + '">' +
      '<div class="animBubble"><span class="animBubbleText"></span>' +
      '<button type="button" class="animRestBtn">' + animTr("anim.restTips", "Rest the tips") + '</button></div>';
    card.appendChild(guide);
    /* Wally's seats of record (Lab sheet, declared
       derivatives of the art of record): he OPENS each
       exercise (hello-wave), WATCHES beside the loop
       (the profile view; counting rides it too), and
       RESTS with the frozen loop (rest2). The files are
       byte copies of the sheet's finals, never redrawn. */
    var SEAT_SRC = {
      hello: "assets/wally-hello.webp",
      profile: "assets/wally-profile.webp",
      rest: "assets/wally-rest.webp"
    };
    var wallyImgEl = guide.querySelector(".animWally");
    var seatNow = "";
    function setSeat(name) {
      if (!wallyImgEl || seatNow === name || !SEAT_SRC[name]) return;
      seatNow = name;
      wallyImgEl.src = SEAT_SRC[name];
    }
    /* A fresh mount opens the exercise; a mount carrying
       a startAt is a resume (rest hand-over) and goes
       straight to the watch seat. */
    setSeat(opts.startAt ? "profile" : "hello");
    var bubbleText = guide.querySelector(".animBubbleText");
    var bubblesOn = opts.bubbles !== false;
    guide.style.display = bubblesOn ? "" : "none";
    guide.querySelector(".animRestBtn").addEventListener("click", function () {
      if (opts.onRest) opts.onRest();
    });
    function setBubble(i) {
      var b = (track.bubbles || [])[i];
      if (b) b = animTr("bub." + exId + "." + i, b);
      if (b && bubbleText.textContent !== b) bubbleText.textContent = b;
      stageDiv.setAttribute("data-phase", PHASE_NAMES[i] || "setup");
    }

    if (opts.stills) {
      /* Reduced motion: the three teaching frames, tap to step.
         Bubble i rides frame i (QA delta pin a). */
      var strip = document.createElement("div");
      strip.className = "animStills";
      stageDiv.appendChild(strip);
      var frames = [], sel = 0;
      [0, 1, 2].forEach(function (ki) {
        var holder = document.createElement("button");
        holder.type = "button";
        holder.className = "animStill" + (ki === 0 ? " sel" : "");
        var s = svgEl("animSvgStill");
        holder.appendChild(s);
        strip.appendChild(holder);
        var st = buildStage(s, track, skin);
        st.apply(ki === 1 ? track.keys[1] : track.keys[0]);
        frames.push(holder);
        holder.addEventListener("click", function () {
          sel = ki;
          frames.forEach(function (f, j) { f.className = "animStill" + (j === sel ? " sel" : ""); });
          setBubble(sel);
          setSeat("profile");
        });
      });
      setBubble(0);
      return {
        stop: function () { dead = true; },
        setFrozen: function (f) { setSeat(f ? "rest" : "profile"); },
        setSkin: function (sk) {
          skin = sk;
          frames.forEach(function (holder, ki) {
            var s = holder.querySelector("svg");
            var st = buildStage(s, track, skin);
            st.apply(ki === 1 ? track.keys[1] : track.keys[0]);
          });
        },
        setBubbles: function (on) { guide.style.display = on ? "" : "none"; },
        missing: false
      };
    }

    var svg = svgEl("animSvg");
    stageDiv.appendChild(svg);
    var stage = buildStage(svg, track, skin);
    var acc = (opts.startAt || 0) * 1000, last = 0, frozen = false, visible = true, curPhase = -1;
    function frame(now) {
      if (dead) return;
      if (last && !frozen && visible && !document.hidden) acc += now - last;
      last = now;
      var t = acc / 1000;
      stage.apply(poseAt(track, t));
      var ph = phaseAt(track, t);
      if (ph !== curPhase) { curPhase = ph; if (ph > 0 && !frozen) setSeat("profile"); if (bubblesOn) setBubble(ph); }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    if (typeof IntersectionObserver !== "undefined") {
      obs = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.05 });
      obs.observe(card);
    }
    return {
      stop: function () { dead = true; cancelAnimationFrame(raf); if (obs) obs.disconnect(); },
      setFrozen: function (f) { frozen = !!f; setSeat(frozen ? "rest" : "profile"); },
      setSkin: function (sk) {
        skin = sk;
        stage = buildStage(svg, track, skin);
        stage.apply(poseAt(track, acc / 1000));
      },
      setBubbles: function (on) { bubblesOn = !!on; guide.style.display = bubblesOn ? "" : "none"; if (bubblesOn && curPhase >= 0) setBubble(curPhase); },
      time: function () { return acc / 1000; },
      missing: false
    };
  }
  function renderAt(svg, exId, skin, tSec) {
    var track = trackOf(exId);
    if (!track) return false;
    var st = buildStage(svg, track, skin || "girl");
    st.apply(poseAt(track, tSec));
    svg.setAttribute("data-exercise", exId);
    svg.setAttribute("data-phase", PHASE_NAMES[phaseAt(track, tSec)]);
    return true;
  }
  window.FitAnim = { mount: mount, renderAt: renderAt, poseAt: poseAt, phaseAt: phaseAt, trackOf: trackOf, PHASE_NAMES: PHASE_NAMES };
})();
