import { predict, coverage } from "./knn.js";

/** Convierte condiciones en un escenario completo: predicción, ley d² y fases de la llama. */
export function simulate(flex, q) {
  const pr = predict(flex, q);
  const cov = coverage(pr, q, flex);
  const ext = pr.pExt >= 0.5;
  const dEnd = ext && pr.dext ? Math.min(pr.dext, q.d0 * 0.95) : 0;
  const tBurn = (q.d0 ** 2 - dEnd ** 2) / pr.K;
  // FLEX observó llamas frías en heptano tras la extinción radiativa de gotas grandes.
  const cool = q.fuel === "Heptane" && ext && dEnd > 1.2;
  return { q, pr, cov, ext, dEnd, tBurn, cool, t0: performance.now() };
}

/** Duración del bucle de reproducción: aceleración, fase de llama fría y total (en segundos del modelo). */
export function span(sim) {
  const coolDur = sim.cool ? sim.tBurn * 0.6 : 0;
  return { speed: Math.max(1, sim.tBurn / 6), coolDur, total: sim.tBurn + coolDur + 1.5 };
}

/**
 * Diámetro y fase de la gota en el instante `now` (reproducción acelerada en bucle).
 * `frac` < 1 repite solo la primera parte de la combustión (útil como decoración).
 */
export function timeline(sim, now, t0, reduce = false, frac = 1) {
  const { q, pr, ext, dEnd, tBurn, cool } = sim;
  const { speed, coolDur, total: full } = span(sim);
  const total = frac < 1 ? tBurn * frac : full;
  const t = reduce ? tBurn * 0.3 : (((now - t0) / 1000) * speed * (frac < 1 ? 0.5 : 1)) % total;
  let d;
  let phase;
  if (t <= tBurn) {
    d = Math.sqrt(Math.max(0, q.d0 ** 2 - pr.K * t));
    phase = "hot";
  } else if (t <= tBurn + coolDur) {
    d = Math.sqrt(Math.max(0.05, dEnd ** 2 - pr.K * 0.35 * (t - tBurn)));
    phase = "cool";
  } else {
    d = ext ? (cool ? Math.sqrt(Math.max(0.05, dEnd ** 2 - pr.K * 0.35 * coolDur)) : dEnd) : 0;
    phase = ext ? "out" : "gone";
  }
  return { t: Math.min(t, tBurn + coolDur), d, phase };
}

/**
 * Parámetros visuales (cualitativos): radio relativo de la llama, intensidad y hollín.
 * En microgravedad la llama suele medir de 5 a 12 veces el diámetro de la gota.
 */
export function flameParams(q) {
  return {
    fsr: Math.max(3.5, Math.min(12, 7 + (0.21 - q.o2) * 35 - q.he * 4 + q.co2 * 3)),
    o2i: Math.max(0.15, Math.min(1.3, (q.o2 - 0.1) / 0.2)) * (1 - q.co2 * 0.6),
    soot: q.fuel === "Heptane" ? Math.max(0, Math.min(1, (q.o2 - 0.14) / 0.2 + (q.P - 1) * 0.3)) : 0,
  };
}

export const PHASE = {
  hot: "Visible flame",
  cool: "Cool flame · invisible to the naked eye",
  out: "Flame out",
  gone: "Droplet consumed",
};

export function phaseNote(sim, phase, g) {
  if (g) return "With gravity, hot air rises: the flame stretches upward and receives more oxygen.";
  if (sim.cool && phase !== "hot") return "FLEX observed heptane continuing to burn with a cool flame after the visible flame went out.";
  return "Without gravity there is no upward flow: the flame is spherical and oxygen arrives only by diffusion.";
}

export const PRESETS = [
  { id: "iss", label: "ISS cabin", q: { fuel: "Heptane", o2: 0.21, P: 1.0, co2: 0, he: 0, d0: 3.0 } },
  { id: "explore", label: "Exploration atmosphere", q: { fuel: "Heptane", o2: 0.34, P: 0.57, co2: 0, he: 0, d0: 3.0 } },
  { id: "co2", label: "CO₂ extinguisher discharge", q: { fuel: "Methanol", o2: 0.17, P: 1.0, co2: 0.4, he: 0, d0: 3.0 } },
  { id: "lowo2", label: "Low oxygen", q: { fuel: "Methanol", o2: 0.14, P: 1.0, co2: 0, he: 0, d0: 3.0 } },
];
