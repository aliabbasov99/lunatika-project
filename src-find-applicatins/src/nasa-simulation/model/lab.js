import { PRESETS } from "./flame.js";

/**
 * Contenido del laboratorio 3D: entornos por escenario, instrumentos y puntos de interés.
 * Los datos de hardware salen de las presentaciones de FLEX en PSI-69 (CIR, MDCA, HiBMS, LLUV, ZGF).
 * Cada texto tiene dos versiones: `plain` para público general y `tech` para quien investiga.
 */

export const ENVS = {
  iss: {
    id: "iss",
     name: "ISS cabin",
     place: "CIR · Destiny module · 400 km orbit",
     plain: "The station's normal air: 21% oxygen at 1 atm. FLEX droplets burned here, inside the Combustion Integrated Rack.",
     tech: "FLEX baseline: 1 atm air in the CIR chamber with the MDCA insert. 3–4 mm heptane droplets show radiative extinction followed by a cool flame.",
  },
  explore: {
    id: "explore",
     name: "Exploration atmosphere",
     place: "Exploration habitat · lunar orbit",
     plain: "Lower pressure and more oxygen allow astronauts to suit up without hours of preparation. The cost: at 34% oxygen, everything burns more readily.",
     tech: "NASA's proposed exploration atmosphere: ≈8.2 psia (56.5 kPa) and 34% O₂. Higher XO₂ increases flame temperature, K, and soot production.",
  },
  co2: {
    id: "co2",
     name: "CO₂ extinguisher discharge",
     place: "CIR · ISS fire alarm",
     plain: "The station's U.S. segment uses CO₂ extinguishers. FLEX measured how much is needed to put out a flame without gravity.",
     tech: "40% CO₂ with 17% O₂: the radiating diluent increases heat loss and lowers flame temperature; methanol extinguishes at large diameters.",
  },
  lowo2: {
    id: "lowo2",
     name: "Low oxygen",
     place: "Drop tower · NASA Glenn (ZGF)",
     plain: "Near the limit: at 14% oxygen the flame is large, dim, and goes out quickly. On Earth, this is tested by dropping the experiment 132 m.",
     tech: "Methanol's oxygen limit. The Zero Gravity Research Facility provides 5.18 s of microgravity: enough for 1–2 mm droplets; FLEX droplets required the ISS.",
  },
};

/** Escenario predefinido que coincide exactamente con las condiciones, o null si son personalizadas. */
export function matchPreset(q) {
  const hit = PRESETS.find((p) => Object.entries(p.q).every(([k, v]) => (typeof v === "number" ? Math.abs(v - q[k]) < 1e-6 : v === q[k])));
  return hit ? hit.id : null;
}

/**
 * Formas de mirar: la vista libre en 3D o el punto de vista real de una cámara.
 * `bar` es la longitud de la barra de escala (mm) que se dibuja sobre la imagen.
 */
export const VIEWS = [
  { id: "free", label: "Free", name: "Free 3D view" },
  { id: "color", label: "Color", name: "MDCA color camera", spec: "0.3 MP · 30 fps", bar: 10 },
  { id: "hibms", label: "HiBMS", name: "HiBMS-1 · backlit droplet", spec: "1 MP · 30 fps · background IR laser", bar: 5 },
  { id: "lluv", label: "LLUV", name: "LLUV · OH* chemiluminescence", spec: "Low-light UV · ~310 nm", bar: 10 },
];

export const LEVELS = [
  { id: "drop", label: "Droplet" },
  { id: "chamber", label: "Chamber" },
  { id: "lab", label: "Laboratory" },
];

/** Puntos de interés. `level` indica a qué distancia de cámara se muestran. */
export const HOTSPOTS = {
  drop: {
    level: "drop", title: "Fuel droplet",
    plain: "A lentil-sized droplet floating without touching anything. As it burns, it shrinks very regularly: the square of its diameter decreases linearly with time.",
    tech: "d² law: d² = d₀² − K·t. K is predicted from the 7 FLEX tests closest to the selected conditions.",
  },
  flame: {
    level: "drop", title: "Spherical flame",
    plain: "Without gravity, hot air does not rise, so the flame has no 'up': it is a sphere. Oxygen arrives only by slow diffusion, which keeps the flame away from the droplet.",
    tech: "Spherically symmetric diffusion flame. Typical flame-to-droplet ratio (FSR = D_f/D) is 5 to 12; the drawn radius is qualitative.",
  },
  plume: {
    level: "drop", title: "Flame with gravity",
    plain: "On Earth, hot gas is lighter than air and rises. This flow stretches the flame into a teardrop and brings fresh oxygen from below.",
    tech: "Natural convection (buoyancy): the induced flow thins the reaction zone and increases the burning rate compared with the spherical case.",
  },
  soot: {
    level: "drop", title: "Soot shell",
    plain: "Heptane produces soot that becomes trapped in a shell between the droplet and flame. It is what glows yellow-orange.",
    tech: "Soot accumulates where thermophoresis toward the droplet balances vapor drag from the evaporating fuel (Stefan flow). Methanol produces almost no soot.",
  },
  needles: {
    level: "chamber", title: "Deployment needles",
    plain: "Two hollow needles facing each other inject the fuel, stretch the droplet between them, and quickly retract to leave it floating.",
    tech: "MDCA: the needles form a liquid bridge to the desired diameter and retract quickly. The droplet can optionally be held by an 80 µm SiC fiber.",
  },
  igniters: {
    level: "chamber", title: "Hot-wire igniters",
    plain: "Two wire loops glow red-hot, ignite the droplet from both sides, and move away so they do not interfere with the flame.",
    tech: "Symmetric hot wires are energized and retracted as soon as ignition occurs to preserve spherical symmetry.",
  },
  hibms: {
    level: "chamber", title: "HiBMS camera · droplet view",
    plain: "The droplet is viewed against a backlight. These images produce the diameter-versus-time curve for each test.",
    tech: "High Bit-depth Multi-Spectral, ~1 MP at 30 fps, backlit by an infrared laser diode. A second HiBMS with a tunable filter measures soot temperature.",
  },
  lluv: {
    level: "chamber", title: "LLUV camera",
    plain: "It sees ultraviolet light invisible to the eye. This measures the true flame size, even when the flame is nearly invisible.",
    tech: "Low Light Level UV: OH* chemiluminescence (~310 nm). It defines flame diameter and marks hot-flame extinction.",
  },
  backlight: {
    level: "chamber", title: "Backlight",
    plain: "The light behind the droplet that lets the HiBMS camera see its shadow.",
    tech: "Lighting package opposite the HiBMS; collimated infrared background.",
  },
  radiometer: {
    level: "chamber", title: "Radiometers",
    plain: "They measure heat lost by the flame as radiation. For large droplets, this loss eventually puts out the flame.",
    tech: "Broadband and narrowband radiometers. Radiative loss increases with flame size and triggers radiative extinction.",
  },
  colorcam: {
    level: "chamber", title: "Color camera",
    plain: "The 'what you see' view used by the ground team to follow the test in real time.",
    tech: "MDCA color camera: 0.3 MP at 30 fps, operated in real time from NASA Glenn.",
  },
  chamber: {
    level: "lab", title: "CIR combustion chamber",
    plain: "A sealed cylinder where the exact atmosphere for each test is prepared: oxygen level, pressure, and diluent gas.",
    tech: "A roughly 100 L chamber with eight optical windows; the MDCA insert slides inside and diagnostic packages look through the windows.",
  },
  testchamber: {
    level: "lab", title: "Test chamber",
    plain: "The same idea as on the station, in a compact version: a sealed chamber with the test atmosphere, ready to drop.",
    tech: "Sealed drop-vehicle chamber with a dispensing needle, igniter, support fiber, and droplet and flame cameras.",
  },
  bottles: {
    level: "lab", title: "Gas bottles",
    plain: "Oxygen, nitrogen, and diluents (CO₂, helium, xenon) are mixed here to fill the chamber.",
    tech: "CIR manifolds for O₂, N₂, diluent, and gaseous fuel. An adsorbent cartridge cleans the atmosphere between burns.",
  },
  earth: {
    level: "lab", title: "Earth, 400 km below",
    plain: "The station is constantly falling around Earth. That is why everything floats inside, and why the flame is round.",
    tech: "Destiny nadir window. Residual microgravity in the CIR is on the order of 10⁻⁶ g.",
  },
  moon: {
    level: "lab", title: "The Moon through the window",
    plain: "Exploration habitats plan lower pressure and more oxygen so astronauts can suit up quickly. In exchange, materials become more flammable.",
    tech: "≈8.2 psia and 34% O₂: shorter EVA prebreathe time; materials must be requalified for flammability.",
  },
  pfe: {
    level: "lab", title: "Portable CO₂ extinguisher",
    plain: "This is how a fire is fought in the U.S. segment of the station. CO₂ displaces oxygen and also removes heat from the flame.",
    tech: "With CO₂ as a diluent, the flame extinguishes at a higher oxygen level than with N₂ because of the gas's higher heat capacity and radiative participation.",
  },
  alarm: {
    level: "lab", title: "Fire alarm",
    plain: "Red lights and a fire warning: the crew shuts down ventilation and discharges the extinguisher.",
    tech: "'Fire' emergency class in the ISS Caution & Warning system.",
  },
  shaft: {
    level: "lab", title: "143 m vacuum shaft",
    plain: "The experiment falls 132 meters inside an evacuated tube. For 5.18 seconds, nothing weighs anything.",
    tech: "Zero Gravity Research Facility (NASA Glenn): free fall in ~10⁻² torr vacuum, stopped in a bed of polystyrene beads.",
  },
  vehicle: {
    level: "lab", title: "Drop vehicle",
    plain: "The entire laboratory travels onboard: chamber, batteries, video cameras, and gases. It is released, falls, and is recovered for the next test.",
    tech: "Autonomous vehicle with the test chamber, dispensing needle, igniter, LED backlight, and radiometers, as used in ZGF methanol tests.",
  },
};

export const STEPS = [
  { id: "deploy", label: "Deployment" },
  { id: "ignite", label: "Ignition" },
  { id: "hot", label: "Hot flame" },
  { id: "cool", label: "Cool flame" },
  { id: "end", label: "Outcome" },
];

const FUEL_ES = { Heptane: "heptane", Methanol: "methanol" };

/** Paso activo de la secuencia a partir de la fase del modelo y la etapa previa a la ignición. */
export function stepOf(phase, stage) {
  if (stage === "deploy" || stage === "retract") return "deploy";
  if (stage === "ignite") return "ignite";
  if (phase === "hot") return "hot";
  if (phase === "cool") return "cool";
  return "end";
}

/** Narración en lenguaje llano de lo que pasa en este instante. */
export function narrate(sim, { phase, stage, g, inst }) {
  const fuel = FUEL_ES[sim.q.fuel] || sim.q.fuel;
  if (stage === "deploy") return `Two needles inject ${fuel} and form a ${sim.q.d0.toFixed(1)} mm droplet.`;
  if (stage === "retract") return "The needles retract quickly, leaving the droplet floating alone.";
  if (stage === "ignite") return "Two hot wires ignite it from both sides and move away.";
  if (inst === "color" && phase === "hot" && !g) return "This is the ground team's view: the flame between the retracted needles, with the chamber interior dark.";
  if (inst === "hibms") return phase === "cool" ? "No visible flame remains, but the droplet's shadow continues shrinking: something is still burning." : "Only the droplet's shadow (and soot, if present) is visible against the backlight. This is how diameter is measured.";
  if (inst === "lluv") return phase === "hot" ? "The bright ring is ultraviolet OH* light: this is the hot flame." : "Without OH*, there is no signal: the hot flame has gone out.";
  if (g) return "With gravity, hot air rises: the flame stretches upward and receives more oxygen.";
  if (phase === "hot") return sim.q.fuel === "Heptane"
    ? "Spherical flame: blue outside, with a glowing soot shell inside."
    : "Dim blue spherical flame: methanol produces almost no soot.";
  if (phase === "cool") return "The visible flame has gone out, but the droplet continues burning: it is a cool flame, around 430 °C, invisible to the naked eye.";
  if (phase === "out") return sim.cool ? "The cool flame also goes out. An unburned droplet remains surrounded by vapor that could reignite." : "The flame went out before consuming the droplet: it lost more heat than it produced.";
  return "The droplet was completely consumed.";
}
