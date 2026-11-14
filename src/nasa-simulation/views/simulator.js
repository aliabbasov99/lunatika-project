import { esc, fmt, ICON, END, FLEX_DOI } from "../core/dom.js";
import { METRICS } from "../model/knn.js";
import { createFlame2D } from "../render/flame2d.js";
import { drawD2 } from "../charts/d2law.js";
import { gravitySwitch } from "../ui/chips.js";

export function statusLine(sim) {
  const { cov } = sim;
  return `<span class="status st-${cov.level}">${ICON[cov.level]}${cov.title}</span><span class="dim small">${cov.text}</span>`;
}

export function mountSimulator(root, data, { controls, scenario, gravity }) {
  root.innerHTML = `
    <div class="section-head">
      <div class="eyebrow">Evidence-based prediction</div>
      <h2>What does a fuel droplet do under these conditions?</h2>
      <p class="lede">The model finds the real FLEX tests most similar to the selected conditions and averages their results. Each prediction shows which tests support it and warns when conditions fall outside the measured range.</p>
    </div>
    <div class="grid-sim">
      <div data-slot="controls"></div>
      <div style="display:grid;gap:14px;min-width:0">
        <div class="statusline" id="sim-cov"></div>
        <div class="outputs" id="sim-out"></div>
          <div class="stage-bar"><h3>Combustion chamber</h3><div id="sim-g"></div></div>
        <div class="stage stage-2d">
           <canvas id="sim-flame" aria-label="Droplet and flame animation"></canvas>
          <div class="hud" id="sim-hud"></div>
          <div class="note" id="sim-note"></div>
        </div>
      </div>
    </div>
    <div class="grid-2">
      <div class="panel stack">
        <h3>d² law: measured curves vs. prediction</h3>
        <div class="legend" id="d2-legend"></div>
         <svg class="chart" id="d2" viewBox="0 0 520 300" role="img" aria-label="Diameter squared versus time for neighboring tests and the prediction"></svg>
        <p class="dim small">Thin lines: diameter measured frame by frame in each neighboring test video (PSI DropletData files).</p>
      </div>
      <div class="panel stack">
        <h3>Supporting tests</h3>
        <div class="tablewrap"><table id="sim-nb"></table></div>
       <p class="dim small">Model: ${7} nearest neighbors using the same fuel, weighted by distance. Leave-one-out validation across ${METRICS.n} tests: R² = ${METRICS.r2}, mean K error = ${METRICS.mae} mm²/s; extinction accuracy is ${Math.round(METRICS.acc * 100)}% (${Math.round(METRICS.base * 100)}% when always predicting the most common class).</p>
      </div>
    </div>`;

  const q = (s) => root.querySelector(s);
  q("#sim-g").appendChild(gravitySwitch(gravity));

  function render({ sim }) {
    if (!sim) return;
    const { pr, tBurn, ext, dEnd } = sim;
    q("#sim-cov").innerHTML = statusLine(sim);
    q("#sim-out").innerHTML = [
       ["Burning rate", fmt(pr.K), `± ${fmt(pr.sd)} mm²/s`],
       ["Flame time", fmt(tBurn, 1), "seconds · d² law"],
       ["Extinction probability", `${Math.round(pr.pExt * 100)} %`, ext ? `goes out at ~${fmt(dEnd, 1)} mm` : "burns until consumed"],
       ["Disruption", `${Math.round(pr.pDis * 100)} %`, "the droplet fragments or moves"],
    ].map(([l, b, s]) => `<div class="out"><span class="lbl">${l}</span><b>${b}</b><small>${s}</small></div>`).join("");
    q("#sim-nb").innerHTML =
      `<thead><tr><th>Test</th><th class="num">O₂</th><th class="num">atm</th><th class="num">CO₂</th><th class="num">He</th><th class="num">d₀</th><th class="num">K</th><th>Outcome</th></tr></thead><tbody>` +
      pr.nb.map(({ r }) => `<tr><td style="white-space:nowrap"><a href="${FLEX_DOI}" target="_blank" rel="noopener">FLEX #${r.n}</a><div class="dim" style="font-size:11.5px">${esc(r.date)}</div></td><td class="num">${fmt(r.o2)}</td><td class="num">${fmt(r.P)}</td><td class="num">${fmt(r.co2)}</td><td class="num">${fmt(r.he)}</td><td class="num">${fmt(r.d0, 1)}</td><td class="num">${fmt(r.K)}</td><td>${END[r.end] || r.end}</td></tr>`).join("") +
      "</tbody>";
    const lg = drawD2(q("#d2"), sim, data.curves);
    q("#d2-legend").innerHTML =
      `<span><svg width="20" height="8"><line x1="1" y1="4" x2="19" y2="4" stroke="${lg.color}" stroke-width="2.5" stroke-linecap="round"/></svg>Prediction</span>` +
      `<span><svg width="20" height="8"><line x1="1" y1="4" x2="19" y2="4" stroke="${lg.muted}" stroke-width="1.3"/></svg>${lg.count} measured neighboring tests</span>`;
  }

  const flame = createFlame2D(q("#sim-flame"), {
    getSim: () => scenario.get().sim,
    getG: () => gravity.get().g,
    bg: "#03050b",
    onHud: ({ t, d, label, note }) => {
      q("#sim-hud").innerHTML = `<span>t = <b>${t.toFixed(1)} s</b> · d = <b>${d.toFixed(2)} mm</b></span><span>${label}</span>`;
      q("#sim-note").textContent = note;
    },
  });

  let unsub = null;
  return {
    enter() {
      q('[data-slot="controls"]').appendChild(controls);
      render(scenario.get());
      unsub = scenario.subscribe(render);
      flame.start();
    },
    leave() {
      unsub?.();
      flame.stop();
    },
  };
}
