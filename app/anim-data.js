/* FitAnim tracks: one pose track + Wally bubble script per
   exercise. Bubbles are written from each exercise's own
   verified cue (exercises-data.js) — kind words, information
   only, no claims, no amounts. Pose keys: [start, effort];
   the player eases start -> effort, breathes, returns.
   Invariants are numbers the gate asserts (QA pin 1). */
window.FIT_ANIM = {
  "Leg_Press": {
    view: "side", scene: "legpress", t: [0.95, 1.45, 2.6],
    keys: [
      { hip: [128, 168], sh: [108, 120], hd: [104, 96], el: [126, 142], ha: [148, 164], kne: [178, 156], ank: [206, 198] },
      { hip: [128, 168], sh: [108, 120], hd: [104, 96], el: [126, 142], ha: [148, 164], kne: [224, 162], ank: [258, 184] }
    ],
    movers: [{ joint: "ank", kind: "plate", dx: 8, dy: -14, rot: -8 }],
    bubbles: ["Back flat on the pad, feet flat on the plate.", "Push the plate away with your whole foot.", "Bend slowly back. Keep your knees soft."],
    watch: 1,
    invariants: [{ kind: "extends", joint: "ank", ref: "hip", min: 30 }, { kind: "same", joint: "hip" }]
  },
  "Calf_Press_On_The_Leg_Press_Machine": {
    view: "side", scene: "legpress", t: [0.8, 1.35, 2.4],
    keys: [
      { hip: [128, 168], sh: [108, 120], hd: [104, 96], el: [126, 142], ha: [148, 164], kne: [214, 158], ank: [252, 186] },
      { hip: [128, 162], sh: [108, 114], hd: [104, 90], el: [126, 136], ha: [148, 158], kne: [218, 152], ank: [260, 180] }
    ],
    movers: [{ joint: "ank", kind: "plate", dx: 8, dy: -14, rot: -8 }],
    bubbles: ["Feet low on the plate, heels free.", "Push through the balls of your feet.", "Let your heels sink back, slowly."],
    watch: 1,
    invariants: [{ kind: "rises", joint: "hip", min: 4 }, { kind: "extends", joint: "ank", ref: "hip", min: 6 }]
  },
  "Leg_Extensions": {
    view: "side", scene: "legext", t: [0.9, 1.4, 2.6],
    keys: [
      { hip: [168, 166], sh: [162, 108], hd: [160, 82], el: [150, 138], ha: [142, 166], kne: [206, 166], ank: [210, 212] },
      { hip: [168, 166], sh: [162, 108], hd: [160, 82], el: [150, 138], ha: [142, 166], kne: [206, 166], ank: [250, 160] }
    ],
    movers: [{ joint: "ank", kind: "pad", dy: -12 }],
    bubbles: ["Sit tall, the pad resting on your shins.", "Lift until your legs are nearly straight.", "Lower slowly. Small and steady wins."],
    watch: 2,
    invariants: [{ kind: "angle", j: ["hip", "kne", "ank"], at: 1, min: 148, max: 180 }, { kind: "angle", j: ["hip", "kne", "ank"], at: 0, min: 55, max: 115 }]
  },
  "Seated_Leg_Curl": {
    view: "side", scene: "legcurl", t: [0.9, 1.4, 2.6],
    keys: [
      { hip: [168, 166], sh: [162, 108], hd: [160, 82], el: [150, 138], ha: [142, 166], kne: [206, 166], ank: [216, 208] },
      { hip: [168, 166], sh: [162, 108], hd: [160, 82], el: [150, 138], ha: [142, 166], kne: [206, 166], ank: [178, 210] }
    ],
    movers: [{ joint: "ank", kind: "pad", dy: -4 }],
    bubbles: ["Sit tall, pad behind your ankles.", "Pull your heels down and back.", "Return slowly. Keep your hips still."],
    watch: 2,
    invariants: [{ kind: "pulls", joint: "ank", min: 30 }, { kind: "same", joint: "hip" }]
  },
  "Smith_Machine_Squat": {
    view: "side", scene: "smith", t: [1.0, 1.5, 2.7],
    keys: [
      { hip: [182, 138], sh: [184, 84], hd: [186, 58], el: [198, 108], ha: [180, 90], kne: [184, 182], ank: [182, 230] },
      { hip: [166, 178], sh: [176, 114], hd: [180, 88], el: [192, 136], ha: [176, 116], kne: [208, 184], ank: [182, 230] }
    ],
    movers: [{ joint: "sh", kind: "disc", dx: -20, dy: 6 }],
    bubbles: ["Bar on your upper back, feet a step forward.", "Slide down the rails until thighs are level.", "Push up tall, steady all the way."],
    watch: 1,
    invariants: [{ kind: "same", joint: "ank" }, { kind: "drops", joint: "hip", min: 30 }]
  },
  "Standing_Calf_Raises": {
    view: "side", scene: "calfstep", t: [0.85, 1.4, 2.5],
    keys: [
      { hip: [188, 142], sh: [188, 88], hd: [188, 62], el: [198, 116], ha: [180, 142], kne: [190, 186], ank: [196, 220] },
      { hip: [188, 128], sh: [188, 74], hd: [188, 48], el: [198, 102], ha: [180, 128], kne: [190, 172], ank: [196, 220] }
    ],
    bubbles: ["Stand tall, balls of your feet on the step.", "Rise up onto your toes.", "Pause, then lower slowly below the step."],
    watch: 2,
    invariants: [{ kind: "rises", joint: "hip", min: 10 }, { kind: "same", joint: "ank" }]
  },
  "Butterfly": {
    view: "front", scene: "pecdeck", t: [0.95, 1.45, 2.6],
    keys: [
      { hip: [180, 180], sh: [180, 118], hd: [180, 84], elL: [102, 128], haL: [118, 162], elR: [258, 128], haR: [242, 162], kneL: [146, 196], ankL: [144, 222], kneR: [214, 196], ankR: [216, 222] },
      { hip: [180, 180], sh: [180, 118], hd: [180, 84], elL: [146, 130], haL: [156, 160], elR: [214, 130], haR: [204, 160], kneL: [146, 196], ankL: [144, 222], kneR: [214, 196], ankR: [216, 222] }
    ],
    cables: [{ from: [66, 62], joint: "elL", w: 6, color: "#A9BFA5" }, { from: [294, 62], joint: "elR", w: 6, color: "#A9BFA5" }],
    movers: [{ joint: "elL", kind: "pad" }, { joint: "elR", kind: "pad" }],
    bubbles: ["Sit tall, arms resting on the pads.", "Bring the pads together in front of your chest.", "Open slowly, all the way back."],
    watch: 1,
    invariants: [{ kind: "closer", j: ["elL", "elR"], min: 40 }]
  },
  "Machine_Bicep_Curl": {
    view: "side", scene: "bicep", t: [0.9, 1.4, 2.6],
    keys: [
      { hip: [168, 166], sh: [164, 108], hd: [162, 82], el: [206, 146], ha: [236, 166], kne: [196, 190], ank: [202, 216] },
      { hip: [168, 166], sh: [164, 108], hd: [162, 82], el: [206, 146], ha: [204, 110], kne: [196, 190], ank: [202, 216] }
    ],
    movers: [{ joint: "ha", kind: "handle" }],
    bubbles: ["Elbows on the pad, sit tall.", "Curl the handles up, slow and smooth.", "Lower until arms are nearly straight."],
    watch: 0,
    invariants: [{ kind: "angle", j: ["sh", "el", "ha"], at: 1, min: 25, max: 75 }, { kind: "angle", j: ["sh", "el", "ha"], at: 0, min: 110, max: 176 }, { kind: "same", joint: "el" }]
  },
  "Close-Grip_Front_Lat_Pulldown": {
    view: "front", scene: "latpd", t: [0.95, 1.45, 2.6],
    keys: [
      { hip: [180, 188], sh: [180, 124], hd: [180, 90], elL: [130, 86], haL: [150, 52], elR: [230, 86], haR: [210, 52], kneL: [150, 200], ankL: [148, 220], kneR: [210, 200], ankR: [212, 220] },
      { hip: [180, 188], sh: [180, 124], hd: [180, 90], elL: [126, 142], haL: [158, 106], elR: [234, 142], haR: [202, 106], kneL: [150, 200], ankL: [148, 220], kneR: [210, 200], ankR: [212, 220] }
    ],
    barBetween: ["haL", "haR"],
    cables: [{ from: [180, 42], joint: "haL" }, { from: [180, 42], joint: "haR" }],
    bubbles: ["Grip the bar, sit tall underneath it.", "Pull the bar to your upper chest, elbows down.", "Let it rise slowly, arms long again."],
    watch: 1,
    invariants: [{ kind: "drops", joint: "haL", min: 45 }, { kind: "drops", joint: "haR", min: 45 }]
  },
  "Seated_Cable_Rows": {
    view: "side", scene: "cable", t: [0.95, 1.45, 2.6],
    keys: [
      { hip: [148, 174], sh: [146, 118], hd: [144, 92], el: [184, 130], ha: [240, 140], kne: [218, 182], ank: [272, 196] },
      { hip: [148, 174], sh: [150, 118], hd: [148, 92], el: [126, 136], ha: [166, 146], kne: [218, 182], ank: [272, 196] }
    ],
    cables: [{ from: [316, 138], joint: "ha" }],
    movers: [{ joint: "ha", kind: "handle" }],
    bubbles: ["Sit tall, arms long in front of you.", "Pull the handle to your tummy.", "Squeeze your shoulder blades, then reach forward slowly."],
    watch: 1,
    invariants: [{ kind: "pulls", joint: "ha", min: 55 }, { kind: "same", joint: "ank" }]
  },
  "Triceps_Pushdown": {
    view: "side", scene: "cable", t: [0.9, 1.4, 2.6],
    keys: [
      { hip: [192, 146], sh: [190, 94], hd: [188, 68], el: [214, 120], ha: [220, 94], kne: [194, 188], ank: [192, 224] },
      { hip: [192, 146], sh: [190, 94], hd: [188, 68], el: [214, 120], ha: [222, 150], kne: [194, 188], ank: [192, 224] }
    ],
    cables: [{ from: [316, 46], joint: "ha" }],
    movers: [{ joint: "ha", kind: "handle" }],
    bubbles: ["Elbows tucked close, cable in hand.", "Push down until your arms are straight.", "Let it rise slowly, elbows still tucked."],
    watch: 0,
    invariants: [{ kind: "drops", joint: "ha", min: 45 }, { kind: "same", joint: "el" }]
  },
  "Cable_Chest_Press": {
    view: "side", scene: "cable", t: [0.95, 1.45, 2.6],
    keys: [
      { hip: [178, 146], sh: [184, 94], hd: [186, 68], el: [208, 102], ha: [198, 112], el2: [212, 110], ha2: [202, 120], kne: [162, 190], ank: [148, 232], kne2: [202, 188], ank2: [218, 230] },
      { hip: [178, 146], sh: [184, 94], hd: [186, 68], el: [164, 98], ha: [122, 104], el2: [170, 106], ha2: [130, 112], kne: [162, 190], ank: [148, 232], kne2: [202, 188], ank2: [218, 230] }
    ],
    cables: [{ from: [318, 72], joint: "ha" }, { from: [318, 84], joint: "ha2" }],
    movers: [{ joint: "ha", kind: "handle" }],
    bubbles: ["Handles at chest height, chest tall.", "Push forward until your arms are long.", "Return slowly, chest tall the whole time."],
    watch: 2,
    invariants: [{ kind: "pulls", joint: "ha", min: 55 }]
  },
  "Alternating_Cable_Shoulder_Press": {
    view: "front", scene: "none", t: [0.8, 1.05, 2.1],
    keys: [
      { hip: [180, 150], sh: [180, 98], hd: [180, 66], elL: [118, 84], haL: [138, 42], elR: [240, 96], haR: [218, 122], kneL: [168, 194], ankL: [166, 234], kneR: [192, 194], ankR: [194, 234] },
      { hip: [180, 150], sh: [180, 98], hd: [180, 66], elL: [120, 96], haL: [142, 122], elR: [242, 84], haR: [222, 42], kneL: [168, 194], ankL: [166, 234], kneR: [192, 194], ankR: [194, 234] }
    ],
    cables: [{ from: [62, 228], joint: "haL" }, { from: [298, 228], joint: "haR" }],
    movers: [{ joint: "haL", kind: "handle" }, { joint: "haR", kind: "handle" }],
    bubbles: ["One handle at shoulder height, stand tall.", "Push up until your arm is long.", "Lower slowly, then swap sides."],
    watch: 2,
    invariants: [{ kind: "alt", joint: "haL", min: 60 }, { kind: "alt", joint: "haR", min: 60 }]
  }
};

Object.assign(window.FIT_ANIM, {
  "Barbell_Squat": {
    view: "side", scene: "none", t: [1.0, 1.5, 2.7],
    keys: [
      { hip: [180, 136], sh: [182, 84], hd: [184, 58], el: [196, 108], ha: [178, 88], kne: [182, 180], ank: [180, 230] },
      { hip: [164, 176], sh: [172, 112], hd: [176, 88], el: [190, 134], ha: [174, 114], kne: [206, 182], ank: [180, 230] }
    ],
    movers: [{ joint: "sh", kind: "disc", dx: -20, dy: 6 }],
    bubbles: ["Bar on your upper back, feet shoulder wide.", "Sit your hips back and down, chest tall.", "Stand up through your heels."],
    watch: 1,
    invariants: [{ kind: "same", joint: "ank" }, { kind: "drops", joint: "hip", min: 30 }]
  },
  "Bodyweight_Squat": {
    view: "side", scene: "none", t: [1.0, 1.5, 2.7],
    keys: [
      { hip: [180, 136], sh: [182, 86], hd: [184, 60], el: [204, 104], ha: [228, 100], kne: [182, 180], ank: [180, 230] },
      { hip: [164, 176], sh: [174, 114], hd: [178, 90], el: [200, 122], ha: [230, 112], kne: [206, 182], ank: [180, 230] }
    ],
    bubbles: ["Feet shoulder wide, arms forward for balance.", "Sit back, like into a chair.", "Stand tall. Knees track over toes."],
    watch: 2,
    invariants: [{ kind: "same", joint: "ank" }, { kind: "drops", joint: "hip", min: 30 }]
  },
  "Barbell_Bench_Press_-_Medium_Grip": {
    view: "side", scene: "bench", t: [0.95, 1.45, 2.6],
    keys: [
      { hip: [148, 180], sh: [214, 178], hd: [246, 176], el: [220, 138], ha: [222, 104], kne: [126, 196], ank: [122, 232] },
      { hip: [148, 180], sh: [214, 178], hd: [246, 176], el: [206, 156], ha: [216, 150], kne: [126, 196], ank: [122, 232] }
    ],
    movers: [{ joint: "ha", kind: "disc" }],
    bubbles: ["Lie flat, feet on the floor.", "Lower the bar to your chest, with control.", "Push it back up, steady and tall."],
    watch: 1,
    invariants: [{ kind: "drops", joint: "ha", min: 35 }, { kind: "same", joint: "hip" }]
  },
  "Bent_Over_Barbell_Row": {
    view: "side", scene: "none", t: [0.95, 1.45, 2.6],
    keys: [
      { hip: [168, 130], sh: [226, 108], hd: [252, 100], el: [234, 148], ha: [232, 184], kne: [176, 180], ank: [172, 230] },
      { hip: [168, 130], sh: [226, 108], hd: [252, 100], el: [212, 128], ha: [204, 142], kne: [176, 180], ank: [172, 230] }
    ],
    movers: [{ joint: "ha", kind: "disc" }],
    bubbles: ["Hinge at the hips, back flat, knees soft.", "Pull the bar to your tummy.", "Lower it with control, back still flat."],
    watch: 0,
    invariants: [{ kind: "rises", joint: "ha", min: 30 }, { kind: "backAngle", at: 0, min: 15, max: 55 }, { kind: "backAngle", at: 1, min: 15, max: 55 }]
  },
  "One-Arm_Dumbbell_Row": {
    view: "side", scene: "bench", t: [0.95, 1.45, 2.6],
    keys: [
      { hip: [176, 138], sh: [228, 122], hd: [252, 112], el: [236, 156], ha: [232, 184], el2: [218, 158], ha2: [212, 208], kne: [158, 182], ank: [150, 232], kne2: [196, 180], ank2: [222, 186] },
      { hip: [176, 138], sh: [228, 122], hd: [252, 112], el: [236, 156], ha: [232, 184], el2: [202, 142], ha2: [198, 154], kne: [158, 182], ank: [150, 232], kne2: [196, 180], ank2: [222, 186] }
    ],
    movers: [{ joint: "ha2", kind: "db" }],
    bubbles: ["One knee on the bench, back flat.", "Pull the weight up to your hip.", "Lower it all the way down."],
    watch: 0,
    invariants: [{ kind: "rises", joint: "ha2", min: 35 }, { kind: "same", joint: "ha" }]
  },
  "Side_Lateral_Raise": {
    view: "front", scene: "none", t: [0.9, 1.45, 2.6],
    keys: [
      { hip: [180, 148], sh: [180, 96], hd: [180, 64], elL: [146, 130], haL: [140, 166], elR: [214, 130], haR: [220, 166], kneL: [168, 192], ankL: [166, 234], kneR: [192, 192], ankR: [194, 234] },
      { hip: [180, 148], sh: [180, 96], hd: [180, 64], elL: [116, 104], haL: [84, 94], elR: [244, 104], haR: [276, 94], kneL: [168, 192], ankL: [166, 234], kneR: [192, 192], ankR: [194, 234] }
    ],
    movers: [{ joint: "haL", kind: "db" }, { joint: "haR", kind: "db" }],
    bubbles: ["Weights by your sides, elbows soft.", "Lift out to shoulder height.", "Lower slowly. No swinging."],
    watch: 2,
    invariants: [{ kind: "spreads", j: ["haL", "haR"], min: 70 }]
  },
  "Dumbbell_Alternate_Bicep_Curl": {
    view: "front", scene: "none", t: [0.8, 1.05, 2.1],
    keys: [
      { hip: [180, 148], sh: [180, 96], hd: [180, 64], elL: [140, 128], haL: [148, 82], elR: [220, 130], haR: [216, 168], kneL: [168, 192], ankL: [166, 234], kneR: [192, 192], ankR: [194, 234] },
      { hip: [180, 148], sh: [180, 96], hd: [180, 64], elL: [140, 130], haL: [144, 168], elR: [220, 128], haR: [212, 82], kneL: [168, 192], ankL: [166, 234], kneR: [192, 192], ankR: [194, 234] }
    ],
    movers: [{ joint: "haL", kind: "db" }, { joint: "haR", kind: "db" }],
    bubbles: ["Elbows tucked at your sides.", "Curl one weight up, slow and smooth.", "Lower slowly, then swap sides."],
    watch: 0,
    invariants: [{ kind: "alt", joint: "haL", min: 60 }, { kind: "alt", joint: "haR", min: 60 }]
  },
  "Pushups": {
    view: "side", scene: "mat", t: [0.95, 1.4, 2.6],
    keys: [
      { hip: [198, 168], sh: [122, 156], hd: [100, 144], el: [130, 182], ha: [120, 208], kne: [250, 176], ank: [294, 184] },
      { hip: [196, 182], sh: [120, 172], hd: [98, 160], el: [100, 162], ha: [120, 208], kne: [248, 190], ank: [294, 184] }
    ],
    bubbles: ["Hands under shoulders, body one line.", "Lower until your elbows bend deep.", "Push the floor away. Knees down is a fine version."],
    watch: 0,
    invariants: [{ kind: "same", joint: "ha" }, { kind: "angle", j: ["sh", "hip", "ank"], at: 0, min: 150, max: 180 }, { kind: "drops", joint: "sh", min: 12 }]
  },
  "Plank": {
    view: "side", scene: "mat", t: [1.1, 1.6, 2.8],
    keys: [
      { hip: [196, 168], sh: [128, 156], hd: [106, 148], el: [128, 210], ha: [96, 210], kne: [244, 177], ank: [292, 186] },
      { hip: [196, 168], sh: [128, 156], hd: [106, 148], el: [128, 210], ha: [96, 210], kne: [244, 177], ank: [292, 186] }
    ],
    bubbles: ["Forearms down, body one long line.", "Tummy pulled in, breathe slowly.", "Hold, calm and steady. Knees down is a fine version."],
    watch: 0,
    invariants: [{ kind: "angle", j: ["sh", "hip", "ank"], at: 0, min: 155, max: 180 }, { kind: "same", joint: "hip" }, { kind: "flat", j: ["el", "ha"] }]
  },
  "Butt_Lift_Bridge": {
    view: "side", scene: "mat", t: [0.95, 1.5, 2.7],
    keys: [
      { hip: [168, 192], sh: [98, 196], hd: [72, 190], el: [122, 204], ha: [152, 208], kne: [218, 148], ank: [230, 204] },
      { hip: [166, 148], sh: [98, 196], hd: [72, 190], el: [122, 204], ha: [152, 208], kne: [218, 148], ank: [230, 204] }
    ],
    bubbles: ["Lie on your back, knees bent, feet flat.", "Lift your hips until your body makes one line.", "Squeeze, then lower slowly."],
    watch: 1,
    invariants: [{ kind: "rises", joint: "hip", min: 30 }, { kind: "same", joint: "ank" }, { kind: "same", joint: "kne" }]
  },
  "Bench_Dips": {
    view: "side", scene: "bench", t: [0.9, 1.4, 2.6],
    keys: [
      { hip: [240, 194], sh: [234, 138], hd: [232, 112], el: [216, 166], ha: [206, 190], kne: [264, 202], ank: [278, 234] },
      { hip: [240, 220], sh: [234, 162], hd: [232, 136], el: [202, 172], ha: [206, 190], kne: [264, 214], ank: [278, 234] }
    ],
    bubbles: ["Hands on the bench behind you, legs out.", "Lower by bending your elbows.", "Push back up. Bent knees make it gentler."],
    watch: 1,
    invariants: [{ kind: "same", joint: "ha" }, { kind: "drops", joint: "hip", min: 18 }]
  },
  "Air_Bike": {
    view: "side", scene: "mat", t: [0.8, 1.05, 2.1],
    keys: [
      { hip: [168, 200], sh: [106, 202], hd: [80, 196], el: [94, 172], ha: [88, 190], kne: [204, 144], ank: [194, 186], kne2: [240, 172], ank2: [276, 154] },
      { hip: [168, 200], sh: [106, 202], hd: [80, 196], el: [94, 172], ha: [88, 190], kne: [240, 172], ank: [276, 154], kne2: [204, 144], ank2: [194, 186] }
    ],
    bubbles: ["Lie back, hands resting by your head.", "Bring elbow to opposite knee.", "Swap sides like pedalling. Slow beats fast."],
    watch: 2,
    invariants: [{ kind: "alt", joint: "kne", min: 25 }, { kind: "alt", joint: "kne2", min: 25 }]
  },
  "Glute_Kickback": {
    view: "side", scene: "mat", t: [0.95, 1.45, 2.6],
    keys: [
      { hip: [204, 144], sh: [130, 148], hd: [108, 138], el: [128, 178], ha: [126, 204], kne: [198, 202], ank: [214, 208], kne2: [224, 194], ank2: [240, 204] },
      { hip: [204, 144], sh: [130, 148], hd: [108, 138], el: [128, 178], ha: [126, 204], kne: [198, 202], ank: [214, 208], kne2: [242, 148], ank2: [278, 152] }
    ],
    bubbles: ["On all fours, back flat.", "Push one heel up and back.", "Squeeze, then return. Swap sides each set."],
    watch: 0,
    invariants: [{ kind: "rises", joint: "ank2", min: 35 }, { kind: "same", joint: "ank" }]
  },
  "Hyperextensions_Back_Extensions": {
    view: "side", scene: "hyper", t: [1.0, 1.55, 2.8],
    keys: [
      { hip: [150, 158], sh: [228, 160], hd: [252, 154], el: [224, 176], ha: [208, 158], kne: [106, 174], ank: [76, 166] },
      { hip: [150, 158], sh: [214, 128], hd: [240, 120], el: [210, 144], ha: [196, 128], kne: [106, 174], ank: [76, 166] }
    ],
    bubbles: ["Hips on the pad, arms crossed.", "Lower your chest slowly.", "Lift until your body is one straight line."],
    watch: 2,
    invariants: [{ kind: "rises", joint: "sh", min: 22 }, { kind: "same", joint: "ank" }, { kind: "same", joint: "hip" }]
  }
});
