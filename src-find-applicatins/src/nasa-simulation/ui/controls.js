import { html } from "../core/dom.js";
import { PRESETS } from "../model/flame.js";

export const SLIDERS = [
  { key: "o2", label: "Oxygen (molar fraction)", min: 0.1, max: 0.4, step: 0.01, dec: 2 },
  { key: "P", label: "Pressure (atm)", min: 0.5, max: 3.0, step: 0.05, dec: 2 },
  { key: "co2", label: "CO₂ (molar fraction)", min: 0, max: 0.7, step: 0.01, dec: 2 },
  { key: "he", label: "Helium (molar fraction)", min: 0, max: 0.45, step: 0.01, dec: 2 },
  { key: "d0", label: "Initial droplet diameter (mm)", min: 1.0, max: 5.0, step: 0.1, dec: 1 },
];

/**
 * Panel de condiciones. Existe una sola instancia: se mueve entre el simulador
 * y la vista 3D, así ambas comparten exactamente las mismas condiciones.
 */
export function createControls(store) {
  const panel = html(`
    <div class="panel controls" id="controls">
      <div class="ctl">
        <label for="in-fuel">Fuel</label>
        <select id="in-fuel">
          <option value="Heptane">Heptane · produces soot</option>
          <option value="Methanol">Methanol · soot-free</option>
        </select>
      </div>
      ${SLIDERS.map((s) => `
        <div class="ctl">
          <label for="in-${s.key}">${s.label} <output id="o-${s.key}"></output></label>
          <input type="range" id="in-${s.key}" min="${s.min}" max="${s.max}" step="${s.step}">
        </div>`).join("")}
      <div class="chips" id="presets"><span class="chip-label">Presets</span></div>
    </div>`);

  const fuel = panel.querySelector("#in-fuel");
  const inputs = Object.fromEntries(SLIDERS.map((s) => [s.key, panel.querySelector(`#in-${s.key}`)]));

  function paint(q) {
    fuel.value = q.fuel;
    SLIDERS.forEach((s) => {
      const inp = inputs[s.key];
      inp.value = q[s.key];
      inp.style.setProperty("--fill", `${((q[s.key] - s.min) / (s.max - s.min)) * 100}%`);
      panel.querySelector(`#o-${s.key}`).textContent = Number(q[s.key]).toFixed(s.dec);
    });
  }

  fuel.addEventListener("input", () => store.set({ fuel: fuel.value }));
  SLIDERS.forEach((s) => inputs[s.key].addEventListener("input", () => store.set({ [s.key]: +inputs[s.key].value })));

  const presets = panel.querySelector("#presets");
  PRESETS.forEach(({ label, q }) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = label;
    b.addEventListener("click", () => store.set({ ...q }));
    presets.appendChild(b);
  });

  store.subscribe(paint);
  paint(store.get());
  return panel;
}
