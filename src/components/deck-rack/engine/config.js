// ─────────────────────────────────────────────────────────────
//  DECK RACK CONFIG — every tunable value for the 3D deck rack.
//  Units for the deck are inches (1 world unit = 1 inch).
// ─────────────────────────────────────────────────────────────
export const CONFIG = {
  deck: {
    width: 8.25,
    length: 32,
    plies: 7,
    plyThickness: 0.0625,     // 7 × 1/16" ≈ 0.44" total
    endRadius: 4.9,           // how far the rounded nose/tail extends (≥ width/2 = rounder)
    kickAngle: 20,            // degrees
    kickStart: 9.6,           // distance from center where the kick bend begins (just past truck holes)
    kickBendLength: 2.6,      // length of the curved transition into the kick
    concave: 0.2,             // depth of concave in inches (medium ≈ 0.2)
    concaveInKicks: 0.6,      // concave multiplier inside the kicks
    wheelbase: 14.25,         // distance between inner truck holes
    boltSpacingLength: 2.125, // new-school pattern
    boltSpacingWidth: 1.625,
    boltRadius: 0.09,
    showHardware: true,
    segmentsLength: 160,
    segmentsWidth: 24,
    segmentsEnd: 28,
    segmentsEdge: 6,
  },

  colors: {
    grip: '#1c1c1c',
    plyLight: '#e6c9a0',
    plyDark: '#6b3f22',
    hardware: '#9a9ba0',
    rail: '#d9d6cf',
  },

  lighting: {
    exposure: 1.0,
    envIntensity: 0.55,
    keyIntensity: 2.4,
    rimIntensity: 2.0,
    ambientIntensity: 0.35,
    shadowRadius: 18,
    shadowOpacity: 0.13,
  },

  rack: {
    fov: 20,
    edgeAngle: Math.PI / 2, // rotation when edge-on (0 = graphic faces viewer)
    wallDistance: 6.5,      // how far the wall sits behind the decks
    captionGap: 28,         // px between the bottom of the centre deck and the caption
  },

  // Long single rack (scroll-driven, centre deck in the spotlight)
  carousel: {
    spacing: 5.4,          // distance between decks along the rail (inches)
    focusScale: 1.3,       // size of the centre deck
    focusForward: 2.0,     // how far the centre deck comes off the wall toward you
    focusGap: 2.2,         // clearance either side of the centre deck
    arcRadius: 110,        // curve of the rail; smaller = ends recede faster
    sideReveal: 0.14,      // radians of graphic the side decks show toward the centre (0 = pure edge-on)
    stepVh: 34,            // page scroll (in % of viewport height) to advance one deck
    fillHeight: 0.6,       // fraction of the viewport height the centre deck uses
    centerY: 0.42,         // vertical position of the rack (0 = top, 1 = bottom)
    spotlight: 0.07,       // darkness of the wall vignette around the spotlight (0 = off)
    followStiffness: 140,  // how tightly the rack follows the scroll
    followDamping: 21,
  },

  spring: {
    stiffness: 170,
    damping: 20,
    swing: 0.012,          // how much a deck tilts while it moves, like swinging on a peg
  },
};
