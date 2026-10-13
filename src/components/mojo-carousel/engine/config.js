// Mojo tin carousel settings. Sizes are in millimetres; the tin lies with its lid
// facing +Z. Ported from the standalone prototype (light-table 2/mojo-showcase).
export const CONFIG = {
  // Dimensions from the J.L. Clark spec sheet (PD-001545), inches → mm.
  tin: {
    width: 54.0,           // 2.126"
    length: 70.0,          // 2.756"
    height: 25.0,          // 0.984" closed
    panelW: 36.04,         // 1.419" flat label panel (lid and base are the same)
    panelH: 52.04,         // 2.049"
    cornerRadius: 12.0,    // R.472 corners seen from above
    endBow: 200,           // R7.874 the short ends bow out very slightly
    edgeSlope: 20,         // degrees: the border slopes down from the panel to the edge
    edgeRadius: 2.0,       // R.079 round where the slope meets the wall
    bulge: 0.25,           // shrink-wrapped walls swell slightly at mid-height
    // how the shrink sleeve ends on the lid and base
    whiteW: 3.2,           // white lid visible between the label and the sleeve
    liftW: 1.35,           // the sleeve's lifted edge, which reads as a grey band
    liftRise: 0.3,         // how far that edge stands off the lid
    pathSegments: 28,      // samples per rounded corner
    profileSegments: 14,   // samples per edge round
  },

  // the shrink sleeve: stacked MO/JO logos, `rows` across × `perSide` columns on each
  // of the four sides (2 × 2 × 4 = 16), colours alternating like a checkerboard
  wrap: { pxPerMm: 24, rows: 2, perSide: 2, markFill: 0.94 },

  // Floating carousel. `o` is a tin's offset from the centre slot in items.
  carousel: {
    ringRadius: 300,       // the row is an arc of a horizontal ring this big
    spacing: 72,           // distance between neighbours along the ring
    centreForward: 10,     // centre tin steps a little further forward
    centreScale: 1.12,     // and is a little larger
    faceOut: 1,            // 1 = tins face straight out from the ring, 0 = all face the camera
    twist: 0.18,           // extra turn per item of offset, on top of the ring
    pitch: -0.1,           // lean back slightly so the lid catches the light
    centreLean: -0.3,      // roll of the centre tin
    leans: [0.2, -0.16, 0.24, -0.2, 0.14, -0.24], // each tin's own roll away from centre
    bob: 1.6,              // floating amplitude (off with reduced motion)
    spin: { duration: 1.1 },  // full turn when the row comes to rest on a tin
    // soft focus away from the centre: blur starts `start` items out, full at `full`
    softFocus: { radius: 7, start: 0.3, full: 2 },
    spring: { stiffness: 90, damping: 13 },        // underdamped: a little overshoot
    calmSpring: { stiffness: 90, damping: 19 },    // reduced motion: no overshoot
    // long lens from a little above, so the ring reads as a curve and sizes stay even
    camera: { fov: 20, elevation: 11 },
    stepVh: 45,            // page scroll (% of viewport height) to move one tin
    heightVh: 60,          // the studio band's height while pinned, centred on screen
  },

  // The 3D studio: a seamless sweep lit by soft area lights.
  studio: {
    set: {
      color: '#e9e6e1',    // warm off-white sweep
      roughness: 0.9,      // soft matte
      room: '#8a8884',     // what the tins reflect around the lights: a softly lit white room
      key: 5,              // overhead softbox
      rim: 7,              // strip lights behind
      fill: 0.9,           // front fill
      shadowLight: 1.1,    // the spot that casts the tins' shadows
      shadow: { color: '#3b3732', opacity: 0.32 }, // soft warm-grey shadows on the floor
    },
    // framing, as screen fractions: the centre tin sits between `lamp` and `pedestal`
    pedestal: [0.5, 0.8],
    lamp: [0.5, 0.14],
    tinFill: 0.72,         // centre tin height as a fraction of that gap
    hover: 0.3,            // gap under the centre tin, as a fraction of its height
    // tall (phone) screens: the row is width-limited, so centre it vertically instead
    portrait: { pedestal: [0.5, 0.64], lamp: [0.5, 0.3] },
    finish: { grain: 0.02, vignette: 0.14 },
    background: '#ebe8e3', // shown behind the canvas while it loads
  },

  render: {
    exposure: 1.0,
    maxPixelRatio: 2,
    mobilePixelRatio: 1.5, // phones and narrow screens render at a lower resolution
  },

  flavours: [
    {
      id: 'peach-watermelon',
      name: 'Peach Watermelon',
      colors: { wrap: '#f7b596', mark: '#0a9a3c', markAlt: '#ffffff', label: '#f79c7c' },
      art: { front: '/mojo/art/peach-watermelon-front.svg', back: '/mojo/art/peach-watermelon-back.svg' },
    },
    {
      id: 'tropical-punch',
      name: 'Tropical Punch',
      colors: { wrap: '#ed1f2e', mark: '#f2d04d', markAlt: '#ffffff', label: '#ed1f2e' },
      art: { front: '/mojo/art/tropical-punch-front.svg', back: '/mojo/art/tropical-punch-back.svg' },
    },
    {
      id: 'mint',
      name: 'Mint',
      colors: { wrap: '#00b9f2', mark: '#004866', markAlt: '#ffffff', label: '#00b9f2' },
      art: { front: '/mojo/art/mint-front.svg', back: '/mojo/art/mint-back.svg' },
    },
    {
      id: 'blue-raspberry',
      name: 'Blue Raspberry',
      colors: { wrap: '#532b85', mark: '#26bcee', markAlt: '#ffffff', label: '#532b85' },
      art: { front: '/mojo/art/blue-raspberry-front.svg', back: '/mojo/art/blue-raspberry-back.svg' },
    },
    {
      id: 'cinnamon-churro',
      name: 'Cinnamon Churro',
      colors: { wrap: '#d36d29', mark: '#3b1f0b', markAlt: '#ffffff', label: '#d36d29' },
      art: { front: '/mojo/art/cinnamon-churro-front.svg', back: '/mojo/art/cinnamon-churro-back.svg' },
    },
    {
      id: 'green-apple',
      name: 'Green Apple',
      colors: { wrap: '#8fc73e', mark: '#004a28', markAlt: '#ffffff', label: '#8fc73e' },
      art: { front: '/mojo/art/green-apple-front.svg', back: '/mojo/art/green-apple-back.svg' },
    },
  ],
};
