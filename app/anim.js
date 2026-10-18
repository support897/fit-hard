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

  /* ---- generated frame sets (graphic redo, approved
     17 Oct 2026): three frames per exercise, cut from
     the approved generated art and re-encoded for the
     app. Keyed by trainer figure, then exercise: the
     girl holds all 206 sets; the boy and the non-binary
     figure hold 25 each. Their Barbell Bench Press sets
     are held at the master, so those two resolve to the
     girl set through the fallback below (a fallback,
     never a redraw).
     Expansion Batches A, B, C, D, E, F, G, H, I, J, K,
     L, M, N, O, P and Q (18 Oct 2026) added 180 girl sets for spliced
     library exercises; no boy or non-binary art exists
     for those 180 yet, so both figures resolve the girl
     set through the same fallback. Band Skull Crusher,
     Barbell Incline Shoulder Raise, Bent Over Dumbbell
     Rear Delt Raise With Head On Bench, Cable Crunch and
     Dumbbell Tricep Extension Pronated Grip are held at
     the master and carry no set; Cable Wrist Curl and
     Calf Raises With Bands are held on form at the
     master and carry no set either. External Rotation
     was refused at the master itself, with nothing
     banked, and carries no set. Leverage High Row was
     refused at the master itself too, its corrected
     attempt, with nothing banked, and carries no set.
     Lying Cambered Barbell Row is held on form at the
     master and carries no set either. Lying Supine
     Dumbbell Curl was refused at the master itself,
     with nothing banked, and carries no set.
     One Arm Pronated Dumbbell Triceps Extension was
     refused at the master itself too, its corrected
     attempt, with nothing banked, and carries no set.
     One Arm Supinated Dumbbell Triceps Extension was
     refused at the master itself, with nothing banked,
     and carries no set. Palms-Down Dumbbell Wrist Curl
     Over A Bench and Palms-Up Dumbbell Wrist Curl Over
     A Bench are held on form at the master and carry
     no set either. Palms-Down Wrist Curl Over A Bench
     and Palms-Up Barbell Wrist Curl Over A Bench are
     held on form with nothing banked and carry no set
     either. Preacher Hammer Dumbbell Curl is held on
     form at the master and carries no set either.
     Seated Dumbbell Palms-Down Wrist Curl is held on
     form at the master and carries no set either.
     Seated Bent-Over One-Arm Dumbbell Triceps
     Extension, Seated Dumbbell Palms-Up Wrist Curl,
     Seated One-Arm Dumbbell Palms-Up Wrist Curl,
     Seated Palm-Up Barbell Wrist Curl and Seated
     Palms-Down Barbell Wrist Curl are held on form
     with nothing banked and carry no set either.
     Leg Press rides the station frames already shipped
     for the machine-photo station view: the same art,
     one source. An exercise with no set (Standing Calf
     Raises, parked) keeps the drawn rig below. ---- */
  var FRAMES = {
    girl: {
      "Leg_Press": ["assets/station-leg-press-1.webp", "assets/station-leg-press-2.webp", "assets/station-leg-press-3.webp"],
      "Calf_Press_On_The_Leg_Press_Machine": ["assets/anim-calf_press_on_the_leg_press_machine-1.webp", "assets/anim-calf_press_on_the_leg_press_machine-2.webp", "assets/anim-calf_press_on_the_leg_press_machine-3.webp"],
      "Leg_Extensions": ["assets/anim-leg_extensions-1.webp", "assets/anim-leg_extensions-2.webp", "assets/anim-leg_extensions-3.webp"],
      "Seated_Leg_Curl": ["assets/anim-seated_leg_curl-1.webp", "assets/anim-seated_leg_curl-2.webp", "assets/anim-seated_leg_curl-3.webp"],
      "Barbell_Squat": ["assets/anim-barbell_squat-1.webp", "assets/anim-barbell_squat-2.webp", "assets/anim-barbell_squat-3.webp"],
      "Smith_Machine_Squat": ["assets/anim-smith_machine_squat-1.webp", "assets/anim-smith_machine_squat-2.webp", "assets/anim-smith_machine_squat-3.webp"],
      "Butt_Lift_Bridge": ["assets/anim-butt_lift_bridge-1.webp", "assets/anim-butt_lift_bridge-2.webp", "assets/anim-butt_lift_bridge-3.webp"],
      "Bodyweight_Squat": ["assets/anim-bodyweight_squat-1.webp", "assets/anim-bodyweight_squat-2.webp", "assets/anim-bodyweight_squat-3.webp"],
      "Close-Grip_Front_Lat_Pulldown": ["assets/anim-close-grip_front_lat_pulldown-1.webp", "assets/anim-close-grip_front_lat_pulldown-2.webp", "assets/anim-close-grip_front_lat_pulldown-3.webp"],
      "Seated_Cable_Rows": ["assets/anim-seated_cable_rows-1.webp", "assets/anim-seated_cable_rows-2.webp", "assets/anim-seated_cable_rows-3.webp"],
      "One-Arm_Dumbbell_Row": ["assets/anim-one-arm_dumbbell_row-1.webp", "assets/anim-one-arm_dumbbell_row-2.webp", "assets/anim-one-arm_dumbbell_row-3.webp"],
      "Bent_Over_Barbell_Row": ["assets/anim-bent_over_barbell_row-1.webp", "assets/anim-bent_over_barbell_row-2.webp", "assets/anim-bent_over_barbell_row-3.webp"],
      "Hyperextensions_Back_Extensions": ["assets/anim-hyperextensions_back_extensions-1.webp", "assets/anim-hyperextensions_back_extensions-2.webp", "assets/anim-hyperextensions_back_extensions-3.webp"],
      "Butterfly": ["assets/anim-butterfly-1.webp", "assets/anim-butterfly-2.webp", "assets/anim-butterfly-3.webp"],
      "Cable_Chest_Press": ["assets/anim-cable_chest_press-1.webp", "assets/anim-cable_chest_press-2.webp", "assets/anim-cable_chest_press-3.webp"],
      "Barbell_Bench_Press_-_Medium_Grip": ["assets/anim-barbell_bench_press_-_medium_grip-1.webp", "assets/anim-barbell_bench_press_-_medium_grip-2.webp", "assets/anim-barbell_bench_press_-_medium_grip-3.webp"],
      "Pushups": ["assets/anim-pushups-1.webp", "assets/anim-pushups-2.webp", "assets/anim-pushups-3.webp"],
      "Alternating_Cable_Shoulder_Press": ["assets/anim-alternating_cable_shoulder_press-1.webp", "assets/anim-alternating_cable_shoulder_press-2.webp", "assets/anim-alternating_cable_shoulder_press-3.webp"],
      "Side_Lateral_Raise": ["assets/anim-side_lateral_raise-1.webp", "assets/anim-side_lateral_raise-2.webp", "assets/anim-side_lateral_raise-3.webp"],
      "Dumbbell_Alternate_Bicep_Curl": ["assets/anim-dumbbell_alternate_bicep_curl-1.webp", "assets/anim-dumbbell_alternate_bicep_curl-2.webp", "assets/anim-dumbbell_alternate_bicep_curl-3.webp"],
      "Machine_Bicep_Curl": ["assets/anim-machine_bicep_curl-1.webp", "assets/anim-machine_bicep_curl-2.webp", "assets/anim-machine_bicep_curl-3.webp"],
      "Bench_Dips": ["assets/anim-bench_dips-1.webp", "assets/anim-bench_dips-2.webp", "assets/anim-bench_dips-3.webp"],
      "Triceps_Pushdown": ["assets/anim-triceps_pushdown-1.webp", "assets/anim-triceps_pushdown-2.webp", "assets/anim-triceps_pushdown-3.webp"],
      "Air_Bike": ["assets/anim-air_bike-1.webp", "assets/anim-air_bike-2.webp", "assets/anim-air_bike-3.webp"],
      "Plank": ["assets/anim-plank-1.webp", "assets/anim-plank-2.webp", "assets/anim-plank-3.webp"],
      "Glute_Kickback": ["assets/anim-glute_kickback-1.webp", "assets/anim-glute_kickback-2.webp", "assets/anim-glute_kickback-3.webp"],
      "Alternate_Hammer_Curl": ["assets/anim-alternate_hammer_curl-1.webp", "assets/anim-alternate_hammer_curl-2.webp", "assets/anim-alternate_hammer_curl-3.webp"],
      "Alternate_Incline_Dumbbell_Curl": ["assets/anim-alternate_incline_dumbbell_curl-1.webp", "assets/anim-alternate_incline_dumbbell_curl-2.webp", "assets/anim-alternate_incline_dumbbell_curl-3.webp"],
      "Alternating_Deltoid_Raise": ["assets/anim-alternating_deltoid_raise-1.webp", "assets/anim-alternating_deltoid_raise-2.webp", "assets/anim-alternating_deltoid_raise-3.webp"],
      "Alternating_Floor_Press": ["assets/anim-alternating_floor_press-1.webp", "assets/anim-alternating_floor_press-2.webp", "assets/anim-alternating_floor_press-3.webp"],
      "Anti-Gravity_Press": ["assets/anim-anti-gravity_press-1.webp", "assets/anim-anti-gravity_press-2.webp", "assets/anim-anti-gravity_press-3.webp"],
      "Back_Flyes_-_With_Bands": ["assets/anim-back_flyes_-_with_bands-1.webp", "assets/anim-back_flyes_-_with_bands-2.webp", "assets/anim-back_flyes_-_with_bands-3.webp"],
      "Balance_Board": ["assets/anim-balance_board-1.webp", "assets/anim-balance_board-2.webp", "assets/anim-balance_board-3.webp"],
      "Ball_Leg_Curl": ["assets/anim-ball_leg_curl-1.webp", "assets/anim-ball_leg_curl-2.webp", "assets/anim-ball_leg_curl-3.webp"],
      "Band_Assisted_Pull-Up": ["assets/anim-band_assisted_pull-up-1.webp", "assets/anim-band_assisted_pull-up-2.webp", "assets/anim-band_assisted_pull-up-3.webp"],
      "Band_Hip_Adductions": ["assets/anim-band_hip_adductions-1.webp", "assets/anim-band_hip_adductions-2.webp", "assets/anim-band_hip_adductions-3.webp"],
      "Band_Pull_Apart": ["assets/anim-band_pull_apart-1.webp", "assets/anim-band_pull_apart-2.webp", "assets/anim-band_pull_apart-3.webp"],
      "Barbell_Curl": ["assets/anim-barbell_curl-1.webp", "assets/anim-barbell_curl-2.webp", "assets/anim-barbell_curl-3.webp"],
      "Barbell_Curls_Lying_Against_An_Incline": ["assets/anim-barbell_curls_lying_against_an_incline-1.webp", "assets/anim-barbell_curls_lying_against_an_incline-2.webp", "assets/anim-barbell_curls_lying_against_an_incline-3.webp"],
      "Barbell_Incline_Bench_Press_-_Medium_Grip": ["assets/anim-barbell_incline_bench_press_-_medium_grip-1.webp", "assets/anim-barbell_incline_bench_press_-_medium_grip-2.webp", "assets/anim-barbell_incline_bench_press_-_medium_grip-3.webp"],
      "Barbell_Rear_Delt_Row": ["assets/anim-barbell_rear_delt_row-1.webp", "assets/anim-barbell_rear_delt_row-2.webp", "assets/anim-barbell_rear_delt_row-3.webp"],
      "Barbell_Seated_Calf_Raise": ["assets/anim-barbell_seated_calf_raise-1.webp", "assets/anim-barbell_seated_calf_raise-2.webp", "assets/anim-barbell_seated_calf_raise-3.webp"],
      "Barbell_Shrug": ["assets/anim-barbell_shrug-1.webp", "assets/anim-barbell_shrug-2.webp", "assets/anim-barbell_shrug-3.webp"],
      "Barbell_Shrug_Behind_The_Back": ["assets/anim-barbell_shrug_behind_the_back-1.webp", "assets/anim-barbell_shrug_behind_the_back-2.webp", "assets/anim-barbell_shrug_behind_the_back-3.webp"],
      "Barbell_Side_Bend": ["assets/anim-barbell_side_bend-1.webp", "assets/anim-barbell_side_bend-2.webp", "assets/anim-barbell_side_bend-3.webp"],
      "Barbell_Side_Split_Squat": ["assets/anim-barbell_side_split_squat-1.webp", "assets/anim-barbell_side_split_squat-2.webp", "assets/anim-barbell_side_split_squat-3.webp"],
      "Barbell_Walking_Lunge": ["assets/anim-barbell_walking_lunge-1.webp", "assets/anim-barbell_walking_lunge-2.webp", "assets/anim-barbell_walking_lunge-3.webp"],
      "Battling_Ropes": ["assets/anim-battling_ropes-1.webp", "assets/anim-battling_ropes-2.webp", "assets/anim-battling_ropes-3.webp"],
      "Bench_Press_-_With_Bands": ["assets/anim-bench_press_-_with_bands-1.webp", "assets/anim-bench_press_-_with_bands-2.webp", "assets/anim-bench_press_-_with_bands-3.webp"],
      "Bent_Over_Low-Pulley_Side_Lateral": ["assets/anim-bent_over_low-pulley_side_lateral-1.webp", "assets/anim-bent_over_low-pulley_side_lateral-2.webp", "assets/anim-bent_over_low-pulley_side_lateral-3.webp"],
      "Bent_Over_One-Arm_Long_Bar_Row": ["assets/anim-bent_over_one-arm_long_bar_row-1.webp", "assets/anim-bent_over_one-arm_long_bar_row-2.webp", "assets/anim-bent_over_one-arm_long_bar_row-3.webp"],
      "Bent_Over_Two-Dumbbell_Row": ["assets/anim-bent_over_two-dumbbell_row-1.webp", "assets/anim-bent_over_two-dumbbell_row-2.webp", "assets/anim-bent_over_two-dumbbell_row-3.webp"],
      "Bent_Over_Two-Dumbbell_Row_With_Palms_In": ["assets/anim-bent_over_two-dumbbell_row_with_palms_in-1.webp", "assets/anim-bent_over_two-dumbbell_row_with_palms_in-2.webp", "assets/anim-bent_over_two-dumbbell_row_with_palms_in-3.webp"],
      "Bosu_Ball_Cable_Crunch_With_Side_Bends": ["assets/anim-bosu_ball_cable_crunch_with_side_bends-1.webp", "assets/anim-bosu_ball_cable_crunch_with_side_bends-2.webp", "assets/anim-bosu_ball_cable_crunch_with_side_bends-3.webp"],
      "Bradford_Rocky_Presses": ["assets/anim-bradford_rocky_presses-1.webp", "assets/anim-bradford_rocky_presses-2.webp", "assets/anim-bradford_rocky_presses-3.webp"],
      "Cable_Crossover": ["assets/anim-cable_crossover-1.webp", "assets/anim-cable_crossover-2.webp", "assets/anim-cable_crossover-3.webp"],
      "Cable_Deadlifts": ["assets/anim-cable_deadlifts-1.webp", "assets/anim-cable_deadlifts-2.webp", "assets/anim-cable_deadlifts-3.webp"],
      "Cable_Hammer_Curls_-_Rope_Attachment": ["assets/anim-cable_hammer_curls_-_rope_attachment-1.webp", "assets/anim-cable_hammer_curls_-_rope_attachment-2.webp", "assets/anim-cable_hammer_curls_-_rope_attachment-3.webp"],
      "Cable_Hip_Adduction": ["assets/anim-cable_hip_adduction-1.webp", "assets/anim-cable_hip_adduction-2.webp", "assets/anim-cable_hip_adduction-3.webp"],
      "Cable_Incline_Pushdown": ["assets/anim-cable_incline_pushdown-1.webp", "assets/anim-cable_incline_pushdown-2.webp", "assets/anim-cable_incline_pushdown-3.webp"],
      "Cable_Incline_Triceps_Extension": ["assets/anim-cable_incline_triceps_extension-1.webp", "assets/anim-cable_incline_triceps_extension-2.webp", "assets/anim-cable_incline_triceps_extension-3.webp"],
      "Cable_Internal_Rotation": ["assets/anim-cable_internal_rotation-1.webp", "assets/anim-cable_internal_rotation-2.webp", "assets/anim-cable_internal_rotation-3.webp"],
      "Cable_Iron_Cross": ["assets/anim-cable_iron_cross-1.webp", "assets/anim-cable_iron_cross-2.webp", "assets/anim-cable_iron_cross-3.webp"],
      "Cable_Judo_Flip": ["assets/anim-cable_judo_flip-1.webp", "assets/anim-cable_judo_flip-2.webp", "assets/anim-cable_judo_flip-3.webp"],
      "Cable_Lying_Triceps_Extension": ["assets/anim-cable_lying_triceps_extension-1.webp", "assets/anim-cable_lying_triceps_extension-2.webp", "assets/anim-cable_lying_triceps_extension-3.webp"],
      "Cable_One_Arm_Tricep_Extension": ["assets/anim-cable_one_arm_tricep_extension-1.webp", "assets/anim-cable_one_arm_tricep_extension-2.webp", "assets/anim-cable_one_arm_tricep_extension-3.webp"],
      "Cable_Preacher_Curl": ["assets/anim-cable_preacher_curl-1.webp", "assets/anim-cable_preacher_curl-2.webp", "assets/anim-cable_preacher_curl-3.webp"],
      "Cable_Rear_Delt_Fly": ["assets/anim-cable_rear_delt_fly-1.webp", "assets/anim-cable_rear_delt_fly-2.webp", "assets/anim-cable_rear_delt_fly-3.webp"],
      "Cable_Reverse_Crunch": ["assets/anim-cable_reverse_crunch-1.webp", "assets/anim-cable_reverse_crunch-2.webp", "assets/anim-cable_reverse_crunch-3.webp"],
      "Cable_Rope_Overhead_Triceps_Extension": ["assets/anim-cable_rope_overhead_triceps_extension-1.webp", "assets/anim-cable_rope_overhead_triceps_extension-2.webp", "assets/anim-cable_rope_overhead_triceps_extension-3.webp"],
      "Cable_Rope_Rear-Delt_Rows": ["assets/anim-cable_rope_rear-delt_rows-1.webp", "assets/anim-cable_rope_rear-delt_rows-2.webp", "assets/anim-cable_rope_rear-delt_rows-3.webp"],
      "Cable_Russian_Twists": ["assets/anim-cable_russian_twists-1.webp", "assets/anim-cable_russian_twists-2.webp", "assets/anim-cable_russian_twists-3.webp"],
      "Cable_Seated_Crunch": ["assets/anim-cable_seated_crunch-1.webp", "assets/anim-cable_seated_crunch-2.webp", "assets/anim-cable_seated_crunch-3.webp"],
      "Cable_Seated_Lateral_Raise": ["assets/anim-cable_seated_lateral_raise-1.webp", "assets/anim-cable_seated_lateral_raise-2.webp", "assets/anim-cable_seated_lateral_raise-3.webp"],
      "Cable_Shoulder_Press": ["assets/anim-cable_shoulder_press-1.webp", "assets/anim-cable_shoulder_press-2.webp", "assets/anim-cable_shoulder_press-3.webp"],
      "Cable_Shrugs": ["assets/anim-cable_shrugs-1.webp", "assets/anim-cable_shrugs-2.webp", "assets/anim-cable_shrugs-3.webp"],
      "Calf-Machine_Shoulder_Shrug": ["assets/anim-calf-machine_shoulder_shrug-1.webp", "assets/anim-calf-machine_shoulder_shrug-2.webp", "assets/anim-calf-machine_shoulder_shrug-3.webp"],
      "Calf_Press": ["assets/anim-calf_press-1.webp", "assets/anim-calf_press-2.webp", "assets/anim-calf_press-3.webp"],
      "Car_Drivers": ["assets/anim-car_drivers-1.webp", "assets/anim-car_drivers-2.webp", "assets/anim-car_drivers-3.webp"],
      "Chair_Squat": ["assets/anim-chair_squat-1.webp", "assets/anim-chair_squat-2.webp", "assets/anim-chair_squat-3.webp"],
      "Close-Grip_Barbell_Bench_Press": ["assets/anim-close-grip_barbell_bench_press-1.webp", "assets/anim-close-grip_barbell_bench_press-2.webp", "assets/anim-close-grip_barbell_bench_press-3.webp"],
      "Close-Grip_Dumbbell_Press": ["assets/anim-close-grip_dumbbell_press-1.webp", "assets/anim-close-grip_dumbbell_press-2.webp", "assets/anim-close-grip_dumbbell_press-3.webp"],
      "Close-Grip_EZ-Bar_Curl_with_Band": ["assets/anim-close-grip_ez-bar_curl_with_band-1.webp", "assets/anim-close-grip_ez-bar_curl_with_band-2.webp", "assets/anim-close-grip_ez-bar_curl_with_band-3.webp"],
      "Close-Grip_EZ-Bar_Press": ["assets/anim-close-grip_ez-bar_press-1.webp", "assets/anim-close-grip_ez-bar_press-2.webp", "assets/anim-close-grip_ez-bar_press-3.webp"],
      "Close-Grip_EZ_Bar_Curl": ["assets/anim-close-grip_ez_bar_curl-1.webp", "assets/anim-close-grip_ez_bar_curl-2.webp", "assets/anim-close-grip_ez_bar_curl-3.webp"],
      "Close-Grip_Push-Up_off_of_a_Dumbbell": ["assets/anim-close-grip_push-up_off_of_a_dumbbell-1.webp", "assets/anim-close-grip_push-up_off_of_a_dumbbell-2.webp", "assets/anim-close-grip_push-up_off_of_a_dumbbell-3.webp"],
      "Close-Grip_Standing_Barbell_Curl": ["assets/anim-close-grip_standing_barbell_curl-1.webp", "assets/anim-close-grip_standing_barbell_curl-2.webp", "assets/anim-close-grip_standing_barbell_curl-3.webp"],
      "Cocoons": ["assets/anim-cocoons-1.webp", "assets/anim-cocoons-2.webp", "assets/anim-cocoons-3.webp"],
      "Conans_Wheel": ["assets/anim-conans_wheel-1.webp", "assets/anim-conans_wheel-2.webp", "assets/anim-conans_wheel-3.webp"],
      "Concentration_Curls": ["assets/anim-concentration_curls-1.webp", "assets/anim-concentration_curls-2.webp", "assets/anim-concentration_curls-3.webp"],
      "Cross-Body_Crunch": ["assets/anim-cross-body_crunch-1.webp", "assets/anim-cross-body_crunch-2.webp", "assets/anim-cross-body_crunch-3.webp"],
      "Cross_Body_Hammer_Curl": ["assets/anim-cross_body_hammer_curl-1.webp", "assets/anim-cross_body_hammer_curl-2.webp", "assets/anim-cross_body_hammer_curl-3.webp"],
      "Cross_Over_-_With_Bands": ["assets/anim-cross_over_-_with_bands-1.webp", "assets/anim-cross_over_-_with_bands-2.webp", "assets/anim-cross_over_-_with_bands-3.webp"],
      "Decline_Barbell_Bench_Press": ["assets/anim-decline_barbell_bench_press-1.webp", "assets/anim-decline_barbell_bench_press-2.webp", "assets/anim-decline_barbell_bench_press-3.webp"],
      "Decline_Dumbbell_Bench_Press": ["assets/anim-decline_dumbbell_bench_press-1.webp", "assets/anim-decline_dumbbell_bench_press-2.webp", "assets/anim-decline_dumbbell_bench_press-3.webp"],
      "Decline_Dumbbell_Flyes": ["assets/anim-decline_dumbbell_flyes-1.webp", "assets/anim-decline_dumbbell_flyes-2.webp", "assets/anim-decline_dumbbell_flyes-3.webp"],
      "Decline_Dumbbell_Triceps_Extension": ["assets/anim-decline_dumbbell_triceps_extension-1.webp", "assets/anim-decline_dumbbell_triceps_extension-2.webp", "assets/anim-decline_dumbbell_triceps_extension-3.webp"],
      "Decline_EZ_Bar_Triceps_Extension": ["assets/anim-decline_ez_bar_triceps_extension-1.webp", "assets/anim-decline_ez_bar_triceps_extension-2.webp", "assets/anim-decline_ez_bar_triceps_extension-3.webp"],
      "Decline_Smith_Press": ["assets/anim-decline_smith_press-1.webp", "assets/anim-decline_smith_press-2.webp", "assets/anim-decline_smith_press-3.webp"],
      "Dip_Machine": ["assets/anim-dip_machine-1.webp", "assets/anim-dip_machine-2.webp", "assets/anim-dip_machine-3.webp"],
      "Dumbbell_Bench_Press": ["assets/anim-dumbbell_bench_press-1.webp", "assets/anim-dumbbell_bench_press-2.webp", "assets/anim-dumbbell_bench_press-3.webp"],
      "Dumbbell_Bench_Press_with_Neutral_Grip": ["assets/anim-dumbbell_bench_press_with_neutral_grip-1.webp", "assets/anim-dumbbell_bench_press_with_neutral_grip-2.webp", "assets/anim-dumbbell_bench_press_with_neutral_grip-3.webp"],
      "Dumbbell_Bicep_Curl": ["assets/anim-dumbbell_bicep_curl-1.webp", "assets/anim-dumbbell_bicep_curl-2.webp", "assets/anim-dumbbell_bicep_curl-3.webp"],
      "Dumbbell_Flyes": ["assets/anim-dumbbell_flyes-1.webp", "assets/anim-dumbbell_flyes-2.webp", "assets/anim-dumbbell_flyes-3.webp"],
      "Dumbbell_Incline_Row": ["assets/anim-dumbbell_incline_row-1.webp", "assets/anim-dumbbell_incline_row-2.webp", "assets/anim-dumbbell_incline_row-3.webp"],
      "Dumbbell_Incline_Shoulder_Raise": ["assets/anim-dumbbell_incline_shoulder_raise-1.webp", "assets/anim-dumbbell_incline_shoulder_raise-2.webp", "assets/anim-dumbbell_incline_shoulder_raise-3.webp"],
      "Dumbbell_Lunges": ["assets/anim-dumbbell_lunges-1.webp", "assets/anim-dumbbell_lunges-2.webp", "assets/anim-dumbbell_lunges-3.webp"],
      "Dumbbell_Raise": ["assets/anim-dumbbell_raise-1.webp", "assets/anim-dumbbell_raise-2.webp", "assets/anim-dumbbell_raise-3.webp"],
      "Dumbbell_Scaption": ["assets/anim-dumbbell_scaption-1.webp", "assets/anim-dumbbell_scaption-2.webp", "assets/anim-dumbbell_scaption-3.webp"],
      "Dumbbell_Seated_One-Leg_Calf_Raise": ["assets/anim-dumbbell_seated_one-leg_calf_raise-1.webp", "assets/anim-dumbbell_seated_one-leg_calf_raise-2.webp", "assets/anim-dumbbell_seated_one-leg_calf_raise-3.webp"],
      "Dumbbell_Shrug": ["assets/anim-dumbbell_shrug-1.webp", "assets/anim-dumbbell_shrug-2.webp", "assets/anim-dumbbell_shrug-3.webp"],
      "Dumbbell_Side_Bend": ["assets/anim-dumbbell_side_bend-1.webp", "assets/anim-dumbbell_side_bend-2.webp", "assets/anim-dumbbell_side_bend-3.webp"],
      "Dumbbell_Squat": ["assets/anim-dumbbell_squat-1.webp", "assets/anim-dumbbell_squat-2.webp", "assets/anim-dumbbell_squat-3.webp"],
      "EZ-Bar_Curl": ["assets/anim-ez-bar_curl-1.webp", "assets/anim-ez-bar_curl-2.webp", "assets/anim-ez-bar_curl-3.webp"],
      "EZ-Bar_Skullcrusher": ["assets/anim-ez-bar_skullcrusher-1.webp", "assets/anim-ez-bar_skullcrusher-2.webp", "assets/anim-ez-bar_skullcrusher-3.webp"],
      "Exercise_Ball_Crunch": ["assets/anim-exercise_ball_crunch-1.webp", "assets/anim-exercise_ball_crunch-2.webp", "assets/anim-exercise_ball_crunch-3.webp"],
      "Exercise_Ball_Pull-In": ["assets/anim-exercise_ball_pull-in-1.webp", "assets/anim-exercise_ball_pull-in-2.webp", "assets/anim-exercise_ball_pull-in-3.webp"],
      "Extended_Range_One-Arm_Kettlebell_Floor_Press": ["assets/anim-extended_range_one-arm_kettlebell_floor_press-1.webp", "assets/anim-extended_range_one-arm_kettlebell_floor_press-2.webp", "assets/anim-extended_range_one-arm_kettlebell_floor_press-3.webp"],
      "External_Rotation_with_Band": ["assets/anim-external_rotation_with_band-1.webp", "assets/anim-external_rotation_with_band-2.webp", "assets/anim-external_rotation_with_band-3.webp"],
      "External_Rotation_with_Cable": ["assets/anim-external_rotation_with_cable-1.webp", "assets/anim-external_rotation_with_cable-2.webp", "assets/anim-external_rotation_with_cable-3.webp"],
      "Finger_Curls": ["assets/anim-finger_curls-1.webp", "assets/anim-finger_curls-2.webp", "assets/anim-finger_curls-3.webp"],
      "Flexor_Incline_Dumbbell_Curls": ["assets/anim-flexor_incline_dumbbell_curls-1.webp", "assets/anim-flexor_incline_dumbbell_curls-2.webp", "assets/anim-flexor_incline_dumbbell_curls-3.webp"],
      "Front_Cable_Raise": ["assets/anim-front_cable_raise-1.webp", "assets/anim-front_cable_raise-2.webp", "assets/anim-front_cable_raise-3.webp"],
      "Front_Dumbbell_Raise": ["assets/anim-front_dumbbell_raise-1.webp", "assets/anim-front_dumbbell_raise-2.webp", "assets/anim-front_dumbbell_raise-3.webp"],
      "Front_Incline_Dumbbell_Raise": ["assets/anim-front_incline_dumbbell_raise-1.webp", "assets/anim-front_incline_dumbbell_raise-2.webp", "assets/anim-front_incline_dumbbell_raise-3.webp"],
      "Front_Raise_And_Pullover": ["assets/anim-front_raise_and_pullover-1.webp", "assets/anim-front_raise_and_pullover-2.webp", "assets/anim-front_raise_and_pullover-3.webp"],
      "Front_Two-Dumbbell_Raise": ["assets/anim-front_two-dumbbell_raise-1.webp", "assets/anim-front_two-dumbbell_raise-2.webp", "assets/anim-front_two-dumbbell_raise-3.webp"],
      "Goblet_Squat": ["assets/anim-goblet_squat-1.webp", "assets/anim-goblet_squat-2.webp", "assets/anim-goblet_squat-3.webp"],
      "Hack_Squat": ["assets/anim-hack_squat-1.webp", "assets/anim-hack_squat-2.webp", "assets/anim-hack_squat-3.webp"],
      "Hammer_Curls": ["assets/anim-hammer_curls-1.webp", "assets/anim-hammer_curls-2.webp", "assets/anim-hammer_curls-3.webp"],
      "Hammer_Grip_Incline_DB_Bench_Press": ["assets/anim-hammer_grip_incline_db_bench_press-1.webp", "assets/anim-hammer_grip_incline_db_bench_press-2.webp", "assets/anim-hammer_grip_incline_db_bench_press-3.webp"],
      "Hip_Extension_with_Bands": ["assets/anim-hip_extension_with_bands-1.webp", "assets/anim-hip_extension_with_bands-2.webp", "assets/anim-hip_extension_with_bands-3.webp"],
      "Hip_Flexion_with_Band": ["assets/anim-hip_flexion_with_band-1.webp", "assets/anim-hip_flexion_with_band-2.webp", "assets/anim-hip_flexion_with_band-3.webp"],
      "Incline_Bench_Pull": ["assets/anim-incline_bench_pull-1.webp", "assets/anim-incline_bench_pull-2.webp", "assets/anim-incline_bench_pull-3.webp"],
      "Incline_Cable_Chest_Press": ["assets/anim-incline_cable_chest_press-1.webp", "assets/anim-incline_cable_chest_press-2.webp", "assets/anim-incline_cable_chest_press-3.webp"],
      "Incline_Dumbbell_Bench_With_Palms_Facing_In": ["assets/anim-incline_dumbbell_bench_with_palms_facing_in-1.webp", "assets/anim-incline_dumbbell_bench_with_palms_facing_in-2.webp", "assets/anim-incline_dumbbell_bench_with_palms_facing_in-3.webp"],
      "Incline_Dumbbell_Curl": ["assets/anim-incline_dumbbell_curl-1.webp", "assets/anim-incline_dumbbell_curl-2.webp", "assets/anim-incline_dumbbell_curl-3.webp"],
      "Incline_Dumbbell_Flyes": ["assets/anim-incline_dumbbell_flyes-1.webp", "assets/anim-incline_dumbbell_flyes-2.webp", "assets/anim-incline_dumbbell_flyes-3.webp"],
      "Incline_Dumbbell_Flyes_-_With_A_Twist": ["assets/anim-incline_dumbbell_flyes_-_with_a_twist-1.webp", "assets/anim-incline_dumbbell_flyes_-_with_a_twist-2.webp", "assets/anim-incline_dumbbell_flyes_-_with_a_twist-3.webp"],
      "Incline_Dumbbell_Press": ["assets/anim-incline_dumbbell_press-1.webp", "assets/anim-incline_dumbbell_press-2.webp", "assets/anim-incline_dumbbell_press-3.webp"],
      "Incline_Hammer_Curls": ["assets/anim-incline_hammer_curls-1.webp", "assets/anim-incline_hammer_curls-2.webp", "assets/anim-incline_hammer_curls-3.webp"],
      "Incline_Inner_Biceps_Curl": ["assets/anim-incline_inner_biceps_curl-1.webp", "assets/anim-incline_inner_biceps_curl-2.webp", "assets/anim-incline_inner_biceps_curl-3.webp"],
      "Internal_Rotation_with_Band": ["assets/anim-internal_rotation_with_band-1.webp", "assets/anim-internal_rotation_with_band-2.webp", "assets/anim-internal_rotation_with_band-3.webp"],
      "Inverted_Row_with_Straps": ["assets/anim-inverted_row_with_straps-1.webp", "assets/anim-inverted_row_with_straps-2.webp", "assets/anim-inverted_row_with_straps-3.webp"],
      "JM_Press": ["assets/anim-jm_press-1.webp", "assets/anim-jm_press-2.webp", "assets/anim-jm_press-3.webp"],
      "Kettlebell_Halo": ["assets/anim-kettlebell_halo-1.webp", "assets/anim-kettlebell_halo-2.webp", "assets/anim-kettlebell_halo-3.webp"],
      "Kettlebell_Overhead_Triceps_Extension": ["assets/anim-kettlebell_overhead_triceps_extension-1.webp", "assets/anim-kettlebell_overhead_triceps_extension-2.webp", "assets/anim-kettlebell_overhead_triceps_extension-3.webp"],
      "Kettlebell_Pirate_Ships": ["assets/anim-kettlebell_pirate_ships-1.webp", "assets/anim-kettlebell_pirate_ships-2.webp", "assets/anim-kettlebell_pirate_ships-3.webp"],
      "Knee_Hip_Raise_On_Parallel_Bars": ["assets/anim-knee_hip_raise_on_parallel_bars-1.webp", "assets/anim-knee_hip_raise_on_parallel_bars-2.webp", "assets/anim-knee_hip_raise_on_parallel_bars-3.webp"],
      "Kneeling_Cable_Crunch_With_Alternating_Oblique_Twists": ["assets/anim-kneeling_cable_crunch_with_alternating_oblique_twists-1.webp", "assets/anim-kneeling_cable_crunch_with_alternating_oblique_twists-2.webp", "assets/anim-kneeling_cable_crunch_with_alternating_oblique_twists-3.webp"],
      "Kneeling_High_Pulley_Row": ["assets/anim-kneeling_high_pulley_row-1.webp", "assets/anim-kneeling_high_pulley_row-2.webp", "assets/anim-kneeling_high_pulley_row-3.webp"],
      "Kneeling_Single-Arm_High_Pulley_Row": ["assets/anim-kneeling_single-arm_high_pulley_row-1.webp", "assets/anim-kneeling_single-arm_high_pulley_row-2.webp", "assets/anim-kneeling_single-arm_high_pulley_row-3.webp"],
      "Landmine_180s": ["assets/anim-landmine_180s-1.webp", "assets/anim-landmine_180s-2.webp", "assets/anim-landmine_180s-3.webp"],
      "Lateral_Raise_-_With_Bands": ["assets/anim-lateral_raise_-_with_bands-1.webp", "assets/anim-lateral_raise_-_with_bands-2.webp", "assets/anim-lateral_raise_-_with_bands-3.webp"],
      "Leverage_Chest_Press": ["assets/anim-leverage_chest_press-1.webp", "assets/anim-leverage_chest_press-2.webp", "assets/anim-leverage_chest_press-3.webp"],
      "Leverage_Deadlift": ["assets/anim-leverage_deadlift-1.webp", "assets/anim-leverage_deadlift-2.webp", "assets/anim-leverage_deadlift-3.webp"],
      "Leverage_Decline_Chest_Press": ["assets/anim-leverage_decline_chest_press-1.webp", "assets/anim-leverage_decline_chest_press-2.webp", "assets/anim-leverage_decline_chest_press-3.webp"],
      "Leverage_Incline_Chest_Press": ["assets/anim-leverage_incline_chest_press-1.webp", "assets/anim-leverage_incline_chest_press-2.webp", "assets/anim-leverage_incline_chest_press-3.webp"],
      "Leverage_Iso_Row": ["assets/anim-leverage_iso_row-1.webp", "assets/anim-leverage_iso_row-2.webp", "assets/anim-leverage_iso_row-3.webp"],
      "Leverage_Shoulder_Press": ["assets/anim-leverage_shoulder_press-1.webp", "assets/anim-leverage_shoulder_press-2.webp", "assets/anim-leverage_shoulder_press-3.webp"],
      "Leverage_Shrug": ["assets/anim-leverage_shrug-1.webp", "assets/anim-leverage_shrug-2.webp", "assets/anim-leverage_shrug-3.webp"],
      "Low_Cable_Crossover": ["assets/anim-low_cable_crossover-1.webp", "assets/anim-low_cable_crossover-2.webp", "assets/anim-low_cable_crossover-3.webp"],
      "Low_Cable_Triceps_Extension": ["assets/anim-low_cable_triceps_extension-1.webp", "assets/anim-low_cable_triceps_extension-2.webp", "assets/anim-low_cable_triceps_extension-3.webp"],
      "Low_Pulley_Row_To_Neck": ["assets/anim-low_pulley_row_to_neck-1.webp", "assets/anim-low_pulley_row_to_neck-2.webp", "assets/anim-low_pulley_row_to_neck-3.webp"],
      "Lying_Close-Grip_Bar_Curl_On_High_Pulley": ["assets/anim-lying_close-grip_bar_curl_on_high_pulley-1.webp", "assets/anim-lying_close-grip_bar_curl_on_high_pulley-2.webp", "assets/anim-lying_close-grip_bar_curl_on_high_pulley-3.webp"],
      "Lying_Leg_Curls": ["assets/anim-lying_leg_curls-1.webp", "assets/anim-lying_leg_curls-2.webp", "assets/anim-lying_leg_curls-3.webp"],
      "Machine_Bench_Press": ["assets/anim-machine_bench_press-1.webp", "assets/anim-machine_bench_press-2.webp", "assets/anim-machine_bench_press-3.webp"],
      "Machine_Preacher_Curls": ["assets/anim-machine_preacher_curls-1.webp", "assets/anim-machine_preacher_curls-2.webp", "assets/anim-machine_preacher_curls-3.webp"],
      "Machine_Shoulder_Military_Press": ["assets/anim-machine_shoulder_military_press-1.webp", "assets/anim-machine_shoulder_military_press-2.webp", "assets/anim-machine_shoulder_military_press-3.webp"],
      "Machine_Triceps_Extension": ["assets/anim-machine_triceps_extension-1.webp", "assets/anim-machine_triceps_extension-2.webp", "assets/anim-machine_triceps_extension-3.webp"],
      "Monster_Walk": ["assets/anim-monster_walk-1.webp", "assets/anim-monster_walk-2.webp", "assets/anim-monster_walk-3.webp"],
      "One-Arm_Flat_Bench_Dumbbell_Flye": ["assets/anim-one-arm_flat_bench_dumbbell_flye-1.webp", "assets/anim-one-arm_flat_bench_dumbbell_flye-2.webp", "assets/anim-one-arm_flat_bench_dumbbell_flye-3.webp"],
      "One-Arm_High-Pulley_Cable_Side_Bends": ["assets/anim-one-arm_high-pulley_cable_side_bends-1.webp", "assets/anim-one-arm_high-pulley_cable_side_bends-2.webp", "assets/anim-one-arm_high-pulley_cable_side_bends-3.webp"],
      "One-Arm_Incline_Lateral_Raise": ["assets/anim-one-arm_incline_lateral_raise-1.webp", "assets/anim-one-arm_incline_lateral_raise-2.webp", "assets/anim-one-arm_incline_lateral_raise-3.webp"],
      "One-Arm_Long_Bar_Row": ["assets/anim-one-arm_long_bar_row-1.webp", "assets/anim-one-arm_long_bar_row-2.webp", "assets/anim-one-arm_long_bar_row-3.webp"],
      "One-Arm_Medicine_Ball_Slam": ["assets/anim-one-arm_medicine_ball_slam-1.webp", "assets/anim-one-arm_medicine_ball_slam-2.webp", "assets/anim-one-arm_medicine_ball_slam-3.webp"],
      "One-Arm_Side_Laterals": ["assets/anim-one-arm_side_laterals-1.webp", "assets/anim-one-arm_side_laterals-2.webp", "assets/anim-one-arm_side_laterals-3.webp"],
      "One_Arm_Dumbbell_Bench_Press": ["assets/anim-one_arm_dumbbell_bench_press-1.webp", "assets/anim-one_arm_dumbbell_bench_press-2.webp", "assets/anim-one_arm_dumbbell_bench_press-3.webp"],
      "One_Arm_Dumbbell_Preacher_Curl": ["assets/anim-one_arm_dumbbell_preacher_curl-1.webp", "assets/anim-one_arm_dumbbell_preacher_curl-2.webp", "assets/anim-one_arm_dumbbell_preacher_curl-3.webp"],
      "One_Arm_Lat_Pulldown": ["assets/anim-one_arm_lat_pulldown-1.webp", "assets/anim-one_arm_lat_pulldown-2.webp", "assets/anim-one_arm_lat_pulldown-3.webp"],
      "Otis-Up": ["assets/anim-otis-up-1.webp", "assets/anim-otis-up-2.webp", "assets/anim-otis-up-3.webp"],
      "Pallof_Press": ["assets/anim-pallof_press-1.webp", "assets/anim-pallof_press-2.webp", "assets/anim-pallof_press-3.webp"],
      "Pallof_Press_With_Rotation": ["assets/anim-pallof_press_with_rotation-1.webp", "assets/anim-pallof_press_with_rotation-2.webp", "assets/anim-pallof_press_with_rotation-3.webp"],
      "Parallel_Bar_Dip": ["assets/anim-parallel_bar_dip-1.webp", "assets/anim-parallel_bar_dip-2.webp", "assets/anim-parallel_bar_dip-3.webp"],
      "Physioball_Hip_Bridge": ["assets/anim-physioball_hip_bridge-1.webp", "assets/anim-physioball_hip_bridge-2.webp", "assets/anim-physioball_hip_bridge-3.webp"],
      "Platform_Hamstring_Slides": ["assets/anim-platform_hamstring_slides-1.webp", "assets/anim-platform_hamstring_slides-2.webp", "assets/anim-platform_hamstring_slides-3.webp"],
      "Plie_Dumbbell_Squat": ["assets/anim-plie_dumbbell_squat-1.webp", "assets/anim-plie_dumbbell_squat-2.webp", "assets/anim-plie_dumbbell_squat-3.webp"],
      "Power_Partials": ["assets/anim-power_partials-1.webp", "assets/anim-power_partials-2.webp", "assets/anim-power_partials-3.webp"],
      "Preacher_Curl": ["assets/anim-preacher_curl-1.webp", "assets/anim-preacher_curl-2.webp", "assets/anim-preacher_curl-3.webp"],
      "Pull_Through": ["assets/anim-pull_through-1.webp", "assets/anim-pull_through-2.webp", "assets/anim-pull_through-3.webp"],
      "Reverse_Barbell_Curl": ["assets/anim-reverse_barbell_curl-1.webp", "assets/anim-reverse_barbell_curl-2.webp", "assets/anim-reverse_barbell_curl-3.webp"],
      "Reverse_Cable_Curl": ["assets/anim-reverse_cable_curl-1.webp", "assets/anim-reverse_cable_curl-2.webp", "assets/anim-reverse_cable_curl-3.webp"],
      "Reverse_Flyes": ["assets/anim-reverse_flyes-1.webp", "assets/anim-reverse_flyes-2.webp", "assets/anim-reverse_flyes-3.webp"],
      "Reverse_Grip_Triceps_Pushdown": ["assets/anim-reverse_grip_triceps_pushdown-1.webp", "assets/anim-reverse_grip_triceps_pushdown-2.webp", "assets/anim-reverse_grip_triceps_pushdown-3.webp"],
      "Reverse_Machine_Flyes": ["assets/anim-reverse_machine_flyes-1.webp", "assets/anim-reverse_machine_flyes-2.webp", "assets/anim-reverse_machine_flyes-3.webp"],
      "Reverse_Plate_Curls": ["assets/anim-reverse_plate_curls-1.webp", "assets/anim-reverse_plate_curls-2.webp", "assets/anim-reverse_plate_curls-3.webp"],
      "Rocking_Standing_Calf_Raise": ["assets/anim-rocking_standing_calf_raise-1.webp", "assets/anim-rocking_standing_calf_raise-2.webp", "assets/anim-rocking_standing_calf_raise-3.webp"],
      "Rope_Crunch": ["assets/anim-rope_crunch-1.webp", "assets/anim-rope_crunch-2.webp", "assets/anim-rope_crunch-3.webp"],
      "Rope_Straight-Arm_Pulldown": ["assets/anim-rope_straight-arm_pulldown-1.webp", "assets/anim-rope_straight-arm_pulldown-2.webp", "assets/anim-rope_straight-arm_pulldown-3.webp"],
      "Seated_Band_Hamstring_Curl": ["assets/anim-seated_band_hamstring_curl-1.webp", "assets/anim-seated_band_hamstring_curl-2.webp", "assets/anim-seated_band_hamstring_curl-3.webp"],
      "Seated_Barbell_Twist": ["assets/anim-seated_barbell_twist-1.webp", "assets/anim-seated_barbell_twist-2.webp", "assets/anim-seated_barbell_twist-3.webp"],
      "Seated_Cable_Shoulder_Press": ["assets/anim-seated_cable_shoulder_press-1.webp", "assets/anim-seated_cable_shoulder_press-2.webp", "assets/anim-seated_cable_shoulder_press-3.webp"],
      "Seated_Calf_Raise": ["assets/anim-seated_calf_raise-1.webp", "assets/anim-seated_calf_raise-2.webp", "assets/anim-seated_calf_raise-3.webp"],
      "Seated_Dumbbell_Curl": ["assets/anim-seated_dumbbell_curl-1.webp", "assets/anim-seated_dumbbell_curl-2.webp", "assets/anim-seated_dumbbell_curl-3.webp"],
      "Seated_Dumbbell_Inner_Biceps_Curl": ["assets/anim-seated_dumbbell_inner_biceps_curl-1.webp", "assets/anim-seated_dumbbell_inner_biceps_curl-2.webp", "assets/anim-seated_dumbbell_inner_biceps_curl-3.webp"],
      "Seated_Dumbbell_Press": ["assets/anim-seated_dumbbell_press-1.webp", "assets/anim-seated_dumbbell_press-2.webp", "assets/anim-seated_dumbbell_press-3.webp"],
      "Seated_Side_Lateral_Raise": ["assets/anim-seated_side_lateral_raise-1.webp", "assets/anim-seated_side_lateral_raise-2.webp", "assets/anim-seated_side_lateral_raise-3.webp"],
      "Seated_Triceps_Press": ["assets/anim-seated_triceps_press-1.webp", "assets/anim-seated_triceps_press-2.webp", "assets/anim-seated_triceps_press-3.webp"],
      "Shotgun_Row": ["assets/anim-shotgun_row-1.webp", "assets/anim-shotgun_row-2.webp", "assets/anim-shotgun_row-3.webp"],
      "Shoulder_Press_-_With_Bands": ["assets/anim-shoulder_press_-_with_bands-1.webp", "assets/anim-shoulder_press_-_with_bands-2.webp", "assets/anim-shoulder_press_-_with_bands-3.webp"],
      "Side_Laterals_to_Front_Raise": ["assets/anim-side_laterals_to_front_raise-1.webp", "assets/anim-side_laterals_to_front_raise-2.webp", "assets/anim-side_laterals_to_front_raise-3.webp"],
      "Single-Arm_Cable_Crossover": ["assets/anim-single-arm_cable_crossover-1.webp", "assets/anim-single-arm_cable_crossover-2.webp", "assets/anim-single-arm_cable_crossover-3.webp"],
      "Single-Leg_High_Box_Squat": ["assets/anim-single-leg_high_box_squat-1.webp", "assets/anim-single-leg_high_box_squat-2.webp", "assets/anim-single-leg_high_box_squat-3.webp"],
      "Single-Leg_Leg_Extension": ["assets/anim-single-leg_leg_extension-1.webp", "assets/anim-single-leg_leg_extension-2.webp", "assets/anim-single-leg_leg_extension-3.webp"],
      "Single_Dumbbell_Raise": ["assets/anim-single_dumbbell_raise-1.webp", "assets/anim-single_dumbbell_raise-2.webp", "assets/anim-single_dumbbell_raise-3.webp"],
      "Sled_Overhead_Backward_Walk": ["assets/anim-sled_overhead_backward_walk-1.webp", "assets/anim-sled_overhead_backward_walk-2.webp", "assets/anim-sled_overhead_backward_walk-3.webp"],
      "Sled_Overhead_Triceps_Extension": ["assets/anim-sled_overhead_triceps_extension-1.webp", "assets/anim-sled_overhead_triceps_extension-2.webp", "assets/anim-sled_overhead_triceps_extension-3.webp"],
      "Sled_Reverse_Flye": ["assets/anim-sled_reverse_flye-1.webp", "assets/anim-sled_reverse_flye-2.webp", "assets/anim-sled_reverse_flye-3.webp"],
      "Sled_Row": ["assets/anim-sled_row-1.webp", "assets/anim-sled_row-2.webp", "assets/anim-sled_row-3.webp"],
      "Smith_Incline_Shoulder_Raise": ["assets/anim-smith_incline_shoulder_raise-1.webp", "assets/anim-smith_incline_shoulder_raise-2.webp", "assets/anim-smith_incline_shoulder_raise-3.webp"],
      "Smith_Machine_Behind_the_Back_Shrug": ["assets/anim-smith_machine_behind_the_back_shrug-1.webp", "assets/anim-smith_machine_behind_the_back_shrug-2.webp", "assets/anim-smith_machine_behind_the_back_shrug-3.webp"],
      "Smith_Machine_Bench_Press": ["assets/anim-smith_machine_bench_press-1.webp", "assets/anim-smith_machine_bench_press-2.webp", "assets/anim-smith_machine_bench_press-3.webp"],
      "Smith_Machine_Bent_Over_Row": ["assets/anim-smith_machine_bent_over_row-1.webp", "assets/anim-smith_machine_bent_over_row-2.webp", "assets/anim-smith_machine_bent_over_row-3.webp"],
      "Smith_Machine_Calf_Raise": ["assets/anim-smith_machine_calf_raise-1.webp", "assets/anim-smith_machine_calf_raise-2.webp", "assets/anim-smith_machine_calf_raise-3.webp"],
      "Smith_Machine_Close-Grip_Bench_Press": ["assets/anim-smith_machine_close-grip_bench_press-1.webp", "assets/anim-smith_machine_close-grip_bench_press-2.webp", "assets/anim-smith_machine_close-grip_bench_press-3.webp"],
      "Smith_Machine_Incline_Bench_Press": ["assets/anim-smith_machine_incline_bench_press-1.webp", "assets/anim-smith_machine_incline_bench_press-2.webp", "assets/anim-smith_machine_incline_bench_press-3.webp"],
      "Smith_Machine_One-Arm_Upright_Row": ["assets/anim-smith_machine_one-arm_upright_row-1.webp", "assets/anim-smith_machine_one-arm_upright_row-2.webp", "assets/anim-smith_machine_one-arm_upright_row-3.webp"],
      "Smith_Machine_Overhead_Shoulder_Press": ["assets/anim-smith_machine_overhead_shoulder_press-1.webp", "assets/anim-smith_machine_overhead_shoulder_press-2.webp", "assets/anim-smith_machine_overhead_shoulder_press-3.webp"],
      "Smith_Machine_Stiff-Legged_Deadlift": ["assets/anim-smith_machine_stiff-legged_deadlift-1.webp", "assets/anim-smith_machine_stiff-legged_deadlift-2.webp", "assets/anim-smith_machine_stiff-legged_deadlift-3.webp"],
      "Smith_Machine_Upright_Row": ["assets/anim-smith_machine_upright_row-1.webp", "assets/anim-smith_machine_upright_row-2.webp", "assets/anim-smith_machine_upright_row-3.webp"],
      "Smith_Single-Leg_Split_Squat": ["assets/anim-smith_single-leg_split_squat-1.webp", "assets/anim-smith_single-leg_split_squat-2.webp", "assets/anim-smith_single-leg_split_squat-3.webp"],
      "Speed_Band_Overhead_Triceps": ["assets/anim-speed_band_overhead_triceps-1.webp", "assets/anim-speed_band_overhead_triceps-2.webp", "assets/anim-speed_band_overhead_triceps-3.webp"],
      "Spell_Caster": ["assets/anim-spell_caster-1.webp", "assets/anim-spell_caster-2.webp", "assets/anim-spell_caster-3.webp"],
      "Split_Squat_with_Dumbbells": ["assets/anim-split_squat_with_dumbbells-1.webp", "assets/anim-split_squat_with_dumbbells-2.webp", "assets/anim-split_squat_with_dumbbells-3.webp"],
      "Squats_-_With_Bands": ["assets/anim-squats_-_with_bands-1.webp", "assets/anim-squats_-_with_bands-2.webp", "assets/anim-squats_-_with_bands-3.webp"],
      "Standing_Alternating_Dumbbell_Press": ["assets/anim-standing_alternating_dumbbell_press-1.webp", "assets/anim-standing_alternating_dumbbell_press-2.webp", "assets/anim-standing_alternating_dumbbell_press-3.webp"],
      "Standing_Barbell_Calf_Raise": ["assets/anim-standing_barbell_calf_raise-1.webp", "assets/anim-standing_barbell_calf_raise-2.webp", "assets/anim-standing_barbell_calf_raise-3.webp"],
      "Standing_Biceps_Cable_Curl": ["assets/anim-standing_biceps_cable_curl-1.webp", "assets/anim-standing_biceps_cable_curl-2.webp", "assets/anim-standing_biceps_cable_curl-3.webp"],
      "Standing_Bradford_Press": ["assets/anim-standing_bradford_press-1.webp", "assets/anim-standing_bradford_press-2.webp", "assets/anim-standing_bradford_press-3.webp"],
      "Standing_Cable_Chest_Press": ["assets/anim-standing_cable_chest_press-1.webp", "assets/anim-standing_cable_chest_press-2.webp", "assets/anim-standing_cable_chest_press-3.webp"],
      "Standing_Cable_Lift": ["assets/anim-standing_cable_lift-1.webp", "assets/anim-standing_cable_lift-2.webp", "assets/anim-standing_cable_lift-3.webp"],
      "Standing_Cable_Wood_Chop": ["assets/anim-standing_cable_wood_chop-1.webp", "assets/anim-standing_cable_wood_chop-2.webp", "assets/anim-standing_cable_wood_chop-3.webp"],
      "Standing_Concentration_Curl": ["assets/anim-standing_concentration_curl-1.webp", "assets/anim-standing_concentration_curl-2.webp", "assets/anim-standing_concentration_curl-3.webp"],
      "Standing_Dumbbell_Press": ["assets/anim-standing_dumbbell_press-1.webp", "assets/anim-standing_dumbbell_press-2.webp", "assets/anim-standing_dumbbell_press-3.webp"],
      "Standing_Dumbbell_Triceps_Extension": ["assets/anim-standing_dumbbell_triceps_extension-1.webp", "assets/anim-standing_dumbbell_triceps_extension-2.webp", "assets/anim-standing_dumbbell_triceps_extension-3.webp"],
      "Standing_Dumbbell_Upright_Row": ["assets/anim-standing_dumbbell_upright_row-1.webp", "assets/anim-standing_dumbbell_upright_row-2.webp", "assets/anim-standing_dumbbell_upright_row-3.webp"],
      "Standing_Leg_Curl": ["assets/anim-standing_leg_curl-1.webp", "assets/anim-standing_leg_curl-2.webp", "assets/anim-standing_leg_curl-3.webp"],
      "Standing_Low-Pulley_Deltoid_Raise": ["assets/anim-standing_low-pulley_deltoid_raise-1.webp", "assets/anim-standing_low-pulley_deltoid_raise-2.webp", "assets/anim-standing_low-pulley_deltoid_raise-3.webp"],
      "Standing_Military_Press": ["assets/anim-standing_military_press-1.webp", "assets/anim-standing_military_press-2.webp", "assets/anim-standing_military_press-3.webp"],
      "Standing_Olympic_Plate_Hand_Squeeze": ["assets/anim-standing_olympic_plate_hand_squeeze-1.webp", "assets/anim-standing_olympic_plate_hand_squeeze-2.webp", "assets/anim-standing_olympic_plate_hand_squeeze-3.webp"],
      "Standing_Overhead_Barbell_Triceps_Extension": ["assets/anim-standing_overhead_barbell_triceps_extension-1.webp", "assets/anim-standing_overhead_barbell_triceps_extension-2.webp", "assets/anim-standing_overhead_barbell_triceps_extension-3.webp"],
      "Standing_Palm-In_One-Arm_Dumbbell_Press": ["assets/anim-standing_palm-in_one-arm_dumbbell_press-1.webp", "assets/anim-standing_palm-in_one-arm_dumbbell_press-2.webp", "assets/anim-standing_palm-in_one-arm_dumbbell_press-3.webp"],
      "Standing_Rope_Crunch": ["assets/anim-standing_rope_crunch-1.webp", "assets/anim-standing_rope_crunch-2.webp", "assets/anim-standing_rope_crunch-3.webp"],
      "Stiff-Legged_Dumbbell_Deadlift": ["assets/anim-stiff-legged_dumbbell_deadlift-1.webp", "assets/anim-stiff-legged_dumbbell_deadlift-2.webp", "assets/anim-stiff-legged_dumbbell_deadlift-3.webp"],
      "Straight-Arm_Pulldown": ["assets/anim-straight-arm_pulldown-1.webp", "assets/anim-straight-arm_pulldown-2.webp", "assets/anim-straight-arm_pulldown-3.webp"],
      "Straight_Bar_Bench_Mid_Rows": ["assets/anim-straight_bar_bench_mid_rows-1.webp", "assets/anim-straight_bar_bench_mid_rows-2.webp", "assets/anim-straight_bar_bench_mid_rows-3.webp"],
      "Straight_Raises_on_Incline_Bench": ["assets/anim-straight_raises_on_incline_bench-1.webp", "assets/anim-straight_raises_on_incline_bench-2.webp", "assets/anim-straight_raises_on_incline_bench-3.webp"],
      "Suspended_Push-Up": ["assets/anim-suspended_push-up-1.webp", "assets/anim-suspended_push-up-2.webp", "assets/anim-suspended_push-up-3.webp"],
      "Suspended_Reverse_Crunch": ["assets/anim-suspended_reverse_crunch-1.webp", "assets/anim-suspended_reverse_crunch-2.webp", "assets/anim-suspended_reverse_crunch-3.webp"],
      "Suspended_Row": ["assets/anim-suspended_row-1.webp", "assets/anim-suspended_row-2.webp", "assets/anim-suspended_row-3.webp"],
      "Svend_Press": ["assets/anim-svend_press-1.webp", "assets/anim-svend_press-2.webp", "assets/anim-svend_press-3.webp"],
      "T-Bar_Row_with_Handle": ["assets/anim-t-bar_row_with_handle-1.webp", "assets/anim-t-bar_row_with_handle-2.webp", "assets/anim-t-bar_row_with_handle-3.webp"],
      "Thigh_Abductor": ["assets/anim-thigh_abductor-1.webp", "assets/anim-thigh_abductor-2.webp", "assets/anim-thigh_abductor-3.webp"],
      "Thigh_Adductor": ["assets/anim-thigh_adductor-1.webp", "assets/anim-thigh_adductor-2.webp", "assets/anim-thigh_adductor-3.webp"],
      "Trap_Bar_Deadlift": ["assets/anim-trap_bar_deadlift-1.webp", "assets/anim-trap_bar_deadlift-2.webp", "assets/anim-trap_bar_deadlift-3.webp"],
      "Triceps_Overhead_Extension_with_Rope": ["assets/anim-triceps_overhead_extension_with_rope-1.webp", "assets/anim-triceps_overhead_extension_with_rope-2.webp", "assets/anim-triceps_overhead_extension_with_rope-3.webp"],
      "Triceps_Pushdown_-_Rope_Attachment": ["assets/anim-triceps_pushdown_-_rope_attachment-1.webp", "assets/anim-triceps_pushdown_-_rope_attachment-2.webp", "assets/anim-triceps_pushdown_-_rope_attachment-3.webp"],
      "Triceps_Pushdown_-_V-Bar_Attachment": ["assets/anim-triceps_pushdown_-_v-bar_attachment-1.webp", "assets/anim-triceps_pushdown_-_v-bar_attachment-2.webp", "assets/anim-triceps_pushdown_-_v-bar_attachment-3.webp"],
      "Underhand_Cable_Pulldowns": ["assets/anim-underhand_cable_pulldowns-1.webp", "assets/anim-underhand_cable_pulldowns-2.webp", "assets/anim-underhand_cable_pulldowns-3.webp"],
      "Upright_Barbell_Row": ["assets/anim-upright_barbell_row-1.webp", "assets/anim-upright_barbell_row-2.webp", "assets/anim-upright_barbell_row-3.webp"],
      "Upright_Row_-_With_Bands": ["assets/anim-upright_row_-_with_bands-1.webp", "assets/anim-upright_row_-_with_bands-2.webp", "assets/anim-upright_row_-_with_bands-3.webp"],
      "Weighted_Crunches": ["assets/anim-weighted_crunches-1.webp", "assets/anim-weighted_crunches-2.webp", "assets/anim-weighted_crunches-3.webp"],
      "Wide-Grip_Lat_Pulldown": ["assets/anim-wide-grip_lat_pulldown-1.webp", "assets/anim-wide-grip_lat_pulldown-2.webp", "assets/anim-wide-grip_lat_pulldown-3.webp"],
      "Wide-Grip_Standing_Barbell_Curl": ["assets/anim-wide-grip_standing_barbell_curl-1.webp", "assets/anim-wide-grip_standing_barbell_curl-2.webp", "assets/anim-wide-grip_standing_barbell_curl-3.webp"],
      "Wrist_Roller": ["assets/anim-wrist_roller-1.webp", "assets/anim-wrist_roller-2.webp", "assets/anim-wrist_roller-3.webp"],
      "Wrist_Rotations_with_Straight_Bar": ["assets/anim-wrist_rotations_with_straight_bar-1.webp", "assets/anim-wrist_rotations_with_straight_bar-2.webp", "assets/anim-wrist_rotations_with_straight_bar-3.webp"]
    },
    boy: {
      "Leg_Press": ["assets/anim-boy-leg_press-1.webp", "assets/anim-boy-leg_press-2.webp", "assets/anim-boy-leg_press-3.webp"],
      "Calf_Press_On_The_Leg_Press_Machine": ["assets/anim-boy-calf_press_on_the_leg_press_machine-1.webp", "assets/anim-boy-calf_press_on_the_leg_press_machine-2.webp", "assets/anim-boy-calf_press_on_the_leg_press_machine-3.webp"],
      "Leg_Extensions": ["assets/anim-boy-leg_extensions-1.webp", "assets/anim-boy-leg_extensions-2.webp", "assets/anim-boy-leg_extensions-3.webp"],
      "Seated_Leg_Curl": ["assets/anim-boy-seated_leg_curl-1.webp", "assets/anim-boy-seated_leg_curl-2.webp", "assets/anim-boy-seated_leg_curl-3.webp"],
      "Barbell_Squat": ["assets/anim-boy-barbell_squat-1.webp", "assets/anim-boy-barbell_squat-2.webp", "assets/anim-boy-barbell_squat-3.webp"],
      "Smith_Machine_Squat": ["assets/anim-boy-smith_machine_squat-1.webp", "assets/anim-boy-smith_machine_squat-2.webp", "assets/anim-boy-smith_machine_squat-3.webp"],
      "Butt_Lift_Bridge": ["assets/anim-boy-butt_lift_bridge-1.webp", "assets/anim-boy-butt_lift_bridge-2.webp", "assets/anim-boy-butt_lift_bridge-3.webp"],
      "Bodyweight_Squat": ["assets/anim-boy-bodyweight_squat-1.webp", "assets/anim-boy-bodyweight_squat-2.webp", "assets/anim-boy-bodyweight_squat-3.webp"],
      "Close-Grip_Front_Lat_Pulldown": ["assets/anim-boy-close-grip_front_lat_pulldown-1.webp", "assets/anim-boy-close-grip_front_lat_pulldown-2.webp", "assets/anim-boy-close-grip_front_lat_pulldown-3.webp"],
      "Seated_Cable_Rows": ["assets/anim-boy-seated_cable_rows-1.webp", "assets/anim-boy-seated_cable_rows-2.webp", "assets/anim-boy-seated_cable_rows-3.webp"],
      "One-Arm_Dumbbell_Row": ["assets/anim-boy-one-arm_dumbbell_row-1.webp", "assets/anim-boy-one-arm_dumbbell_row-2.webp", "assets/anim-boy-one-arm_dumbbell_row-3.webp"],
      "Bent_Over_Barbell_Row": ["assets/anim-boy-bent_over_barbell_row-1.webp", "assets/anim-boy-bent_over_barbell_row-2.webp", "assets/anim-boy-bent_over_barbell_row-3.webp"],
      "Hyperextensions_Back_Extensions": ["assets/anim-boy-hyperextensions_back_extensions-1.webp", "assets/anim-boy-hyperextensions_back_extensions-2.webp", "assets/anim-boy-hyperextensions_back_extensions-3.webp"],
      "Butterfly": ["assets/anim-boy-butterfly-1.webp", "assets/anim-boy-butterfly-2.webp", "assets/anim-boy-butterfly-3.webp"],
      "Cable_Chest_Press": ["assets/anim-boy-cable_chest_press-1.webp", "assets/anim-boy-cable_chest_press-2.webp", "assets/anim-boy-cable_chest_press-3.webp"],
      "Pushups": ["assets/anim-boy-pushups-1.webp", "assets/anim-boy-pushups-2.webp", "assets/anim-boy-pushups-3.webp"],
      "Alternating_Cable_Shoulder_Press": ["assets/anim-boy-alternating_cable_shoulder_press-1.webp", "assets/anim-boy-alternating_cable_shoulder_press-2.webp", "assets/anim-boy-alternating_cable_shoulder_press-3.webp"],
      "Side_Lateral_Raise": ["assets/anim-boy-side_lateral_raise-1.webp", "assets/anim-boy-side_lateral_raise-2.webp", "assets/anim-boy-side_lateral_raise-3.webp"],
      "Dumbbell_Alternate_Bicep_Curl": ["assets/anim-boy-dumbbell_alternate_bicep_curl-1.webp", "assets/anim-boy-dumbbell_alternate_bicep_curl-2.webp", "assets/anim-boy-dumbbell_alternate_bicep_curl-3.webp"],
      "Machine_Bicep_Curl": ["assets/anim-boy-machine_bicep_curl-1.webp", "assets/anim-boy-machine_bicep_curl-2.webp", "assets/anim-boy-machine_bicep_curl-3.webp"],
      "Bench_Dips": ["assets/anim-boy-bench_dips-1.webp", "assets/anim-boy-bench_dips-2.webp", "assets/anim-boy-bench_dips-3.webp"],
      "Triceps_Pushdown": ["assets/anim-boy-triceps_pushdown-1.webp", "assets/anim-boy-triceps_pushdown-2.webp", "assets/anim-boy-triceps_pushdown-3.webp"],
      "Air_Bike": ["assets/anim-boy-air_bike-1.webp", "assets/anim-boy-air_bike-2.webp", "assets/anim-boy-air_bike-3.webp"],
      "Plank": ["assets/anim-boy-plank-1.webp", "assets/anim-boy-plank-2.webp", "assets/anim-boy-plank-3.webp"],
      "Glute_Kickback": ["assets/anim-boy-glute_kickback-1.webp", "assets/anim-boy-glute_kickback-2.webp", "assets/anim-boy-glute_kickback-3.webp"]
    },
    nb: {
      "Leg_Press": ["assets/anim-nb-leg_press-1.webp", "assets/anim-nb-leg_press-2.webp", "assets/anim-nb-leg_press-3.webp"],
      "Calf_Press_On_The_Leg_Press_Machine": ["assets/anim-nb-calf_press_on_the_leg_press_machine-1.webp", "assets/anim-nb-calf_press_on_the_leg_press_machine-2.webp", "assets/anim-nb-calf_press_on_the_leg_press_machine-3.webp"],
      "Leg_Extensions": ["assets/anim-nb-leg_extensions-1.webp", "assets/anim-nb-leg_extensions-2.webp", "assets/anim-nb-leg_extensions-3.webp"],
      "Seated_Leg_Curl": ["assets/anim-nb-seated_leg_curl-1.webp", "assets/anim-nb-seated_leg_curl-2.webp", "assets/anim-nb-seated_leg_curl-3.webp"],
      "Barbell_Squat": ["assets/anim-nb-barbell_squat-1.webp", "assets/anim-nb-barbell_squat-2.webp", "assets/anim-nb-barbell_squat-3.webp"],
      "Smith_Machine_Squat": ["assets/anim-nb-smith_machine_squat-1.webp", "assets/anim-nb-smith_machine_squat-2.webp", "assets/anim-nb-smith_machine_squat-3.webp"],
      "Butt_Lift_Bridge": ["assets/anim-nb-butt_lift_bridge-1.webp", "assets/anim-nb-butt_lift_bridge-2.webp", "assets/anim-nb-butt_lift_bridge-3.webp"],
      "Bodyweight_Squat": ["assets/anim-nb-bodyweight_squat-1.webp", "assets/anim-nb-bodyweight_squat-2.webp", "assets/anim-nb-bodyweight_squat-3.webp"],
      "Close-Grip_Front_Lat_Pulldown": ["assets/anim-nb-close-grip_front_lat_pulldown-1.webp", "assets/anim-nb-close-grip_front_lat_pulldown-2.webp", "assets/anim-nb-close-grip_front_lat_pulldown-3.webp"],
      "Seated_Cable_Rows": ["assets/anim-nb-seated_cable_rows-1.webp", "assets/anim-nb-seated_cable_rows-2.webp", "assets/anim-nb-seated_cable_rows-3.webp"],
      "One-Arm_Dumbbell_Row": ["assets/anim-nb-one-arm_dumbbell_row-1.webp", "assets/anim-nb-one-arm_dumbbell_row-2.webp", "assets/anim-nb-one-arm_dumbbell_row-3.webp"],
      "Bent_Over_Barbell_Row": ["assets/anim-nb-bent_over_barbell_row-1.webp", "assets/anim-nb-bent_over_barbell_row-2.webp", "assets/anim-nb-bent_over_barbell_row-3.webp"],
      "Hyperextensions_Back_Extensions": ["assets/anim-nb-hyperextensions_back_extensions-1.webp", "assets/anim-nb-hyperextensions_back_extensions-2.webp", "assets/anim-nb-hyperextensions_back_extensions-3.webp"],
      "Butterfly": ["assets/anim-nb-butterfly-1.webp", "assets/anim-nb-butterfly-2.webp", "assets/anim-nb-butterfly-3.webp"],
      "Cable_Chest_Press": ["assets/anim-nb-cable_chest_press-1.webp", "assets/anim-nb-cable_chest_press-2.webp", "assets/anim-nb-cable_chest_press-3.webp"],
      "Pushups": ["assets/anim-nb-pushups-1.webp", "assets/anim-nb-pushups-2.webp", "assets/anim-nb-pushups-3.webp"],
      "Alternating_Cable_Shoulder_Press": ["assets/anim-nb-alternating_cable_shoulder_press-1.webp", "assets/anim-nb-alternating_cable_shoulder_press-2.webp", "assets/anim-nb-alternating_cable_shoulder_press-3.webp"],
      "Side_Lateral_Raise": ["assets/anim-nb-side_lateral_raise-1.webp", "assets/anim-nb-side_lateral_raise-2.webp", "assets/anim-nb-side_lateral_raise-3.webp"],
      "Dumbbell_Alternate_Bicep_Curl": ["assets/anim-nb-dumbbell_alternate_bicep_curl-1.webp", "assets/anim-nb-dumbbell_alternate_bicep_curl-2.webp", "assets/anim-nb-dumbbell_alternate_bicep_curl-3.webp"],
      "Machine_Bicep_Curl": ["assets/anim-nb-machine_bicep_curl-1.webp", "assets/anim-nb-machine_bicep_curl-2.webp", "assets/anim-nb-machine_bicep_curl-3.webp"],
      "Bench_Dips": ["assets/anim-nb-bench_dips-1.webp", "assets/anim-nb-bench_dips-2.webp", "assets/anim-nb-bench_dips-3.webp"],
      "Triceps_Pushdown": ["assets/anim-nb-triceps_pushdown-1.webp", "assets/anim-nb-triceps_pushdown-2.webp", "assets/anim-nb-triceps_pushdown-3.webp"],
      "Air_Bike": ["assets/anim-nb-air_bike-1.webp", "assets/anim-nb-air_bike-2.webp", "assets/anim-nb-air_bike-3.webp"],
      "Plank": ["assets/anim-nb-plank-1.webp", "assets/anim-nb-plank-2.webp", "assets/anim-nb-plank-3.webp"],
      "Glute_Kickback": ["assets/anim-nb-glute_kickback-1.webp", "assets/anim-nb-glute_kickback-2.webp", "assets/anim-nb-glute_kickback-3.webp"]
    }
  };
  function framesFor(exId, skin) {
    var byFig = FRAMES[skin];
    if (byFig && byFig[exId]) return byFig[exId];
    return (FRAMES.girl && FRAMES.girl[exId]) || null;
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
         Bubble i rides frame i (QA delta pin a). Where the
         exercise holds a generated frame set, the stills ARE
         those frames; the rest keep the drawn rig's poses. */
      var strip = document.createElement("div");
      strip.className = "animStills";
      stageDiv.appendChild(strip);
      var frames = [], sel = 0;
      function fillStill(holder, ki) {
        holder.innerHTML = "";
        var set = framesFor(exId, skin);
        if (set) {
          var im = document.createElement("img");
          im.className = "animStillImg";
          im.setAttribute("style", "width:100%;height:auto;display:block;border-radius:8px");
          im.alt = "";
          im.src = set[ki];
          holder.appendChild(im);
        } else {
          var s = svgEl("animSvgStill");
          holder.appendChild(s);
          var st = buildStage(s, track, skin);
          st.apply(ki === 1 ? track.keys[1] : track.keys[0]);
        }
      }
      [0, 1, 2].forEach(function (ki) {
        var holder = document.createElement("button");
        holder.type = "button";
        holder.className = "animStill" + (ki === 0 ? " sel" : "");
        fillStill(holder, ki);
        strip.appendChild(holder);
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
          frames.forEach(function (holder, ki) { fillStill(holder, ki); });
        },
        setBubbles: function (on) { guide.style.display = on ? "" : "none"; },
        missing: false
      };
    }

    /* The stage: a generated frame set where the exercise
       holds one (the frame follows the loop's own phase, so
       bubbles, seats, the freeze and the rest hand-over ride
       the same clock as ever, about 870 ms a step on the
       standard loop), else the drawn rig exactly as before. */
    var acc = (opts.startAt || 0) * 1000, last = 0, frozen = false, visible = true, curPhase = -1;
    var frameSet = framesFor(exId, skin), frameImg = null, frameShown = -1, svg = null, stage = null;
    if (frameSet) {
      frameImg = document.createElement("img");
      frameImg.className = "animFrameImg";
      frameImg.setAttribute("style", "width:100%;height:auto;display:block;border-radius:14px;background:#FAEED6");
      frameImg.alt = "";
      frameSet.forEach(function (src) { var p = new Image(); p.src = src; });
      frameShown = phaseAt(track, acc / 1000);
      frameImg.src = frameSet[frameShown];
      stageDiv.appendChild(frameImg);
    } else {
      svg = svgEl("animSvg");
      stageDiv.appendChild(svg);
      stage = buildStage(svg, track, skin);
    }
    function frame(now) {
      if (dead) return;
      if (last && !frozen && visible && !document.hidden) acc += now - last;
      last = now;
      var t = acc / 1000;
      var ph = phaseAt(track, t);
      if (frameImg) { if (ph !== frameShown) { frameShown = ph; frameImg.src = frameSet[ph]; } }
      else stage.apply(poseAt(track, t));
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
        if (frameImg) {
          var ns = framesFor(exId, skin);
          if (ns) { frameSet = ns; frameShown = -1; }
        } else {
          stage = buildStage(svg, track, skin);
          stage.apply(poseAt(track, acc / 1000));
        }
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
  window.FitAnim = { mount: mount, renderAt: renderAt, poseAt: poseAt, phaseAt: phaseAt, trackOf: trackOf, framesFor: framesFor, PHASE_NAMES: PHASE_NAMES };
  window.FIT_FRAMES = FRAMES;
})();
