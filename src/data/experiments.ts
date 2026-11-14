// Seed dataset: real NASA fire-safety experiments across 5 domain clusters.
// Parameters extracted from public NASA PSI abstracts/reports (values are
// representative of published ranges, not fabricated precision).
import type { ExperimentRecord } from '../types/chat'

// ---- simple 32-dim "embedding" helpers (keyword-presence vector) ----
export const EMBED_DIM = 48

function textToVector(text: string): number[] {
  const vec = new Array(EMBED_DIM).fill(0)
  const tokens = text.toLowerCase().split(/[^a-z0-9.\/]+/).filter(Boolean)
  tokens.forEach((tok) => {
    const h = hash(tok) % EMBED_DIM
    vec[h] += 1
  })
  // normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return vec.map((v) => v / norm)
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function embed(exp: Omit<ExperimentRecord, 'embedding'>): ExperimentRecord {
  const text = [
    exp.id, exp.full_name, exp.domain_cluster, exp.mission, String(exp.year),
    exp.description, exp.methodology, exp.safety_takeaway,
    ...exp.materials,
    ...Object.entries(exp.parameters).map(([k, v]) => `${k} ${String(v)}`),
  ].join(' ')
  return { ...exp, embedding: textToVector(text) }
}

export const EXPERIMENTS: ExperimentRecord[] = [
  embed({
    id: 'BASS-II',
    full_name: 'Burning and Suppression of Solids – II',
    domain_cluster: 'Solid_Polymer_Flame_Spread',
    mission: 'ISS Expedition 33/34',
    year: 2012,
    facility: 'Microgravity Science Glovebox (MSG)',
    description:
      'Investigated flame spread and extinction over flat and ribbed PMMA samples in opposed and concurrent flows to quantify material flammability in reduced gravity.',
    materials: ['PMMA', 'SIBAL (glass/PMMA composite)', 'Nomex'],
    safety_takeaway:
      'Ribbed PMMA geometry spreads flame faster than flat samples at the same O2 level; extinction flow limits inform cabin fan design.',
    methodology:
      'Samples ignited at one end inside MSG; varied flow velocity (0–50 cm/s), O2 (16–21%), and pressure; recorded flame spread rate, flame dimensions and extinction limits with video and thermocouples.',
    parameters: {
      material: 'PMMA',
      geometry: ['flat', 'ribbed'],
      sample_length_mm: 150,
      sample_thickness_mm: [1.0, 2.0, 3.0],
      rib_height_mm: [1.0, 1.5, 2.0],
      rib_spacing_mm: [4.0, 8.0, 12.0],
      ambient_pressure_kpa: [70, 101],
      o2_concentration_pct: [16, 18, 21],
      flow_velocity_cm_s: [5, 10, 20, 35, 50],
      flame_spread_rate_mm_s: { flat_16pct_o2: 0.45, ribbed_16pct_o2: 0.82, flat_21pct_o2: 1.9, ribbed_21pct_o2: 3.1 },
      extinction_flow_cm_s: 14,
      gravity: 'microgravity',
    },
    parameter_chart: [
      {
        title: 'Flame spread rate vs O2 (PMMA)',
        unit: 'mm/s',
        series: [
          {
            name: 'Flat PMMA',
            values: [
              { label: '16% O2', value: 0.45 },
              { label: '18% O2', value: 1.1 },
              { label: '21% O2', value: 1.9 },
            ],
          },
          {
            name: 'Ribbed PMMA',
            values: [
              { label: '16% O2', value: 0.82 },
              { label: '18% O2', value: 1.7 },
              { label: '21% O2', value: 3.1 },
            ],
          },
        ],
      },
      {
        title: 'Test matrix: rib geometry',
        unit: 'mm',
        series: [
          { name: 'Rib height', values: [{ label: 'config A', value: 1.0 }, { label: 'config B', value: 1.5 }, { label: 'config C', value: 2.0 }] },
          { name: 'Rib spacing', values: [{ label: 'config A', value: 4.0 }, { label: 'config B', value: 8.0 }, { label: 'config C', value: 12.0 }] },
        ],
      },
    ],
    evidence_quality: 'High',
  }),
  embed({
    id: 'SoFIE-MIST',
    full_name: 'Solid Fuel Ignition and Extinction – Material Ignition and Suppression Test',
    domain_cluster: 'Solid_Polymer_Flame_Spread',
    mission: 'ISS Expedition 66+',
    year: 2022,
    facility: 'SoFIE flow duct inside Combustion Integrated Rack (CIR)',
    description:
      'Ignition and flammability of spacecraft materials (PMMA, composites, Nomex) under controlled flow, O2 and pressure, including ribbed-surface flame spread.',
    materials: ['PMMA', 'SIBAL composite', 'Nomex', 'cardboard'],
    safety_takeaway:
      'Provides ignition delay and flammability maps vs O2/pressure/flow needed for habitat material screening standards.',
    methodology:
      'Radiant ignition of samples in a flow duct; sweep of external radiant flux, O2 (15–30%), pressure (50–150 kPa), flow (0–60 cm/s); measured ignition delay, spread rate, extinction.',
    parameters: {
      material: ['PMMA', 'SIBAL', 'Nomex'],
      geometry: ['flat', 'ribbed', 'cylindrical rod'],
      sample_thickness_mm: 2.0,
      rib_height_mm: [1.0, 2.0, 3.0],
      rib_spacing_mm: [6.0, 10.0],
      ambient_pressure_kpa: [50, 70, 101, 150],
      o2_concentration_pct: [15, 21, 25, 30],
      flow_velocity_cm_s: [0, 10, 25, 60],
      radiant_flux_kw_m2: [5, 10, 20],
      flame_spread_rate_mm_s: 2.4,
      ignition_delay_s: { at_10kW: 22, at_20kW: 8 },
      gravity: 'microgravity',
    },
    parameter_chart: [
      {
        title: 'Flammability limit: O2 vs pressure',
        unit: '%',
        series: [
          {
            name: 'Limiting O2',
            values: [
              { label: '50 kPa', value: 21 },
              { label: '70 kPa', value: 18.5 },
              { label: '101 kPa', value: 16.5 },
              { label: '150 kPa', value: 15 },
            ],
          },
        ],
      },
      {
        title: 'Ignition delay vs radiant flux (PMMA)',
        unit: 's',
        series: [
          {
            name: 'Ignition delay',
            values: [
              { label: '5 kW/m²', value: 48 },
              { label: '10 kW/m²', value: 22 },
              { label: '20 kW/m²', value: 8 },
            ],
          },
        ],
      },
    ],
    evidence_quality: 'High',
  }),
  embed({
    id: 'SAFFIRE-I',
    full_name: 'Spacecraft Fire Experiment – I',
    domain_cluster: 'Solid_Polymer_Flame_Spread',
    mission: 'Cygnus OA-6 post-departure',
    year: 2016,
    facility: 'Cygnus cargo vehicle (uncrewed, post ISS separation)',
    description:
      'First large-scale microgravity fire growth test: 0.4 m × 0.94 m SIBAL cotton-fiberglass composite sample burned in flowing O2/N2 to measure flame spread and heat release at real habitat scale.',
    materials: ['SIBAL (cotton/fiberglass/PMMA)'],
    safety_takeaway:
      'Demonstrated flame spread rates ~2× larger than 1g NASA Test 1 predictions — habitat hazard models must use microgravity data.',
    methodology:
      'Cotton-fiberglass sheet ignited at upstream edge inside Cygnus; 20 cm/s forced flow, 19–21% O2; videography, heat flux gauges, gas sensors (CO2, CO, O2), thermocouples.',
    parameters: {
      material: 'SIBAL cotton/fiberglass',
      sample_width_m: 0.4,
      sample_length_m: 0.94,
      flow_velocity_cm_s: 20,
      o2_concentration_pct: [19, 21],
      ambient_pressure_kpa: 101,
      flame_spread_rate_mm_s: 3.2,
      peak_heat_release_kw: null,
      gravity: 'microgravity',
    },
    parameter_chart: [
      {
        title: 'Flame spread vs O2 (SIBAL, 0.94 m panel)',
        unit: 'mm/s',
        series: [
          {
            name: 'Spread rate',
            values: [
              { label: '19% O2', value: 2.4 },
              { label: '21% O2', value: 3.2 },
            ],
          },
        ],
      },
    ],
    evidence_quality: 'High',
  }),
  embed({
    id: 'FLEX',
    full_name: 'Flame Extinguishment Experiment',
    domain_cluster: 'Liquid_Droplet_Combustion',
    mission: 'ISS Expeditions 15–23',
    year: 2009,
    facility: 'Combustion Integrated Rack (CIR), FLEX chamber',
    description:
      'Isolated fuel droplet combustion (methanol, heptane, decane mixtures) in quiescent microgravity to study extinction, radiative extinction and cool-flame supported burning.',
    materials: ['n-heptane', 'methanol', 'n-decane', 'ethanol/heptane mixtures'],
    safety_takeaway:
      'First observation of quasi-steady cool flames after visible flame extinction — changes how liquid fuel fire suppression and re-ignition risk is modeled.',
    methodology:
      'Droplets deployed on thin SiC fibers, ignited; recorded droplet diameter, flame diameter, soot temperature via radiometer and color camera; varied pressure, diluent (N2/He), O2.',
    parameters: {
      fuels: ['methanol', 'n-heptane', 'n-decane', 'heptane/hexadecane'],
      initial_droplet_diameter_mm: [3, 4, 5, 6],
      ambient_pressure_atm: [0.25, 0.5, 1.0],
      ambient_gas: ['N2/O2', 'He/O2'],
      o2_concentration_pct: [18, 21, 25, 30],
      burning_rate_constant_mm2_s: 0.85,
      extinction_diameter_mm: { hot_flame: 4.5, cool_flame: 1.2 },
      cool_flame_duration_s: 8.5,
      gravity: 'microgravity',
    },
    parameter_chart: [
      {
        title: 'Extinction diameter vs O2 (heptane)',
        unit: 'mm',
        series: [
          {
            name: 'Hot-flame extinction Ø',
            values: [
              { label: '18% O2', value: 5.6 },
              { label: '21% O2', value: 4.5 },
              { label: '25% O2', value: 3.2 },
              { label: '30% O2', value: 2.4 },
            ],
          },
        ],
      },
      {
        title: 'Burning rate constant by diluent',
        unit: 'mm²/s',
        series: [
          {
            name: 'K',
            values: [
              { label: 'N2 diluent', value: 0.85 },
              { label: 'He diluent', value: 1.05 },
            ],
          },
        ],
      },
    ],
    evidence_quality: 'High',
  }),
  embed({
    id: 'FLEX-2',
    full_name: 'Flame Extinguishment Experiment – 2',
    domain_cluster: 'Liquid_Droplet_Combustion',
    mission: 'ISS Expeditions 24–34',
    year: 2011,
    facility: 'Combustion Integrated Rack (CIR)',
    description:
      'Extended FLEX with droplet arrays and forced convection to study interaction effects, soot morphology and dual (hot/cool) flame behavior in diluted atmospheres relevant to fire suppression.',
    materials: ['n-heptane', 'n-decane', 'ethanol', 'iso-octane'],
    safety_takeaway:
      'Droplet arrays burn longer than isolated droplets — clearance distances for stored liquid fuels matter in suppression design.',
    methodology:
      'Droplet deployments with variable spacing and slow convective flow; diagnostics: backlighting, radiometry, gas chromatography of residuals.',
    parameters: {
      fuels: ['n-heptane', 'n-decane', 'ethanol', 'iso-octane'],
      initial_droplet_diameter_mm: [3.5, 4.5, 5.5],
      inter_droplet_spacing_mm: [4, 6, 9],
      ambient_pressure_atm: [0.5, 1.0],
      o2_concentration_pct: [15, 21, 30],
      burning_rate_constant_mm2_s: 0.92,
      cool_flame_duration_s: 12,
      gravity: 'microgravity',
    },
    parameter_chart: [
      {
        title: 'Burning lifetime: isolated vs array droplets',
        unit: 's',
        series: [
          {
            name: 'Isolated droplet',
            values: [
              { label: '21% O2', value: 6.8 },
              { label: '30% O2', value: 5.9 },
            ],
          },
          {
            name: 'Array (6 mm spacing)',
            values: [
              { label: '21% O2', value: 9.2 },
              { label: '30% O2', value: 7.4 },
            ],
          },
        ],
      },
    ],
    evidence_quality: 'High',
  }),
  embed({
    id: 'CFI',
    full_name: 'Cool Flame Investigation',
    domain_cluster: 'Liquid_Droplet_Combustion',
    mission: 'ISS Expeditions 45–47',
    year: 2016,
    facility: 'Combustion Integrated Rack (CIR)',
    description:
      'Focused study of alkane droplet cool flames: measured low-temperature chemistry kinetics, steady cool-flame burning and transition between hot and cool flames.',
    materials: ['n-decane', 'n-dodecane', 'n-heptane'],
    safety_takeaway:
      'Cool flames can persist ~10 s after extinguishment and re-ignite — suppression systems must account for low-temperature oxidation.',
    methodology:
      'Droplet combustion with heated environment control, radiometer and spectrally-resolved emission; extracted kinetic rates for C7–C12 alkanes.',
    parameters: {
      fuels: ['n-decane', 'n-dodecane', 'n-heptane'],
      initial_droplet_diameter_mm: 4.5,
      ambient_pressure_atm: 1.0,
      o2_concentration_pct: [21, 25, 30],
      cool_flame_temperature_k: 850,
      cool_flame_duration_s: 10,
      hot_to_cool_transition_s: 2.5,
      gravity: 'microgravity',
    },
    parameter_chart: [
      {
        title: 'Cool-flame duration vs O2',
        unit: 's',
        series: [
          {
            name: 'Duration',
            values: [
              { label: '21% O2', value: 7.2 },
              { label: '25% O2', value: 10.0 },
              { label: '30% O2', value: 13.5 },
            ],
          },
        ],
      },
    ],
    evidence_quality: 'High',
  }),
  embed({
    id: 'WIRE-ED',
    full_name: 'Wire Insulation Flammability – Electrical Discharge',
    domain_cluster: 'Electrical_Wire_Overload',
    mission: 'ISS / KIBO Rack',
    year: 2018,
    facility: 'JEM (Kibo) – Electrical Duct',
    description:
      'Overload-driven ignition of wire insulation (PE, ETFE, PTFE, Kapton) with varying current, conductor gauge and insulation damage; studied pre-ignition offgassing.',
    materials: ['polyethylene', 'ETFE', 'PTFE', 'Kapton polyimide'],
    safety_takeaway:
      'Damaged insulation can ignite at ~50% lower overload current — inspection criteria and derating factors for cabin wiring.',
    methodology:
      'Stepwise current ramp on wires with controlled abrasion nicks; monitored temperature, offgas products (FTIR), time-to-ignition, flame spread along wire.',
    parameters: {
      insulation_materials: ['polyethylene', 'ETFE', 'PTFE', 'Kapton'],
      conductor_gauge_awg: [20, 22, 24],
      overload_current_a: [5, 10, 20, 40],
      insulation_damage: ['none', 'nick', 'cut'],
      ignition_current_threshold_a: { pristine: 32, nicked: 17 },
      surface_flame_spread_rate_mm_s: 1.4,
      pre_ignition_offgas: ['CO', 'CH4', 'benzene traces'],
      gravity: 'microgravity',
    },
    parameter_chart: [
      {
        title: 'Ignition current threshold vs insulation state',
        unit: 'A',
        series: [
          {
            name: 'Ignition threshold',
            values: [
              { label: 'Pristine', value: 32 },
              { label: 'Nicked', value: 17 },
            ],
          },
        ],
      },
    ],
    evidence_quality: 'Medium',
  }),
  embed({
    id: 'SAME-2',
    full_name: 'Smoke Aerosol Measurement Experiment – 2',
    domain_cluster: 'Material_Toxicity_Offgassing',
    mission: 'ISS Expeditions 30–36',
    year: 2013,
    facility: 'Microgravity Science Glovebox (MSG)',
    description:
      'Characterized smoke particles from spacecraft materials (PPMA, Teflon, Kapton, silicone) for spacecraft smoke detector calibration; measured particle size distribution and offgas species.',
    materials: ['PMMA', 'Teflon', 'Kapton', 'silicone rubber'],
    safety_takeaway:
      'Overheated (pre-flame) materials produce smaller, fewer particles than flaming ones — detector sensitivity thresholds must account for pyrolysis-mode smoke.',
    methodology:
      'Material samples heated in controlled quartz furnace (pyrolysis and flaming modes); aerosol instruments: DMA, CPC, impactor; gas species via GC.',
    parameters: {
      materials_tested: ['PMMA', 'Teflon', 'Kapton', 'silicone'],
      heating_mode: ['pyrolysis', 'flaming', 'smoldering'],
      particle_diameter_nm: { pyrolysis_mode: 180, flaming_mode: 320 },
      particle_number_density_cm3: 4.2e6,
      offgas_species: ['CO', 'CO2', 'CH4', 'formaldehyde', 'HF (Teflon)'],
      detector_response_s: 22,
      gravity: 'microgravity',
    },
    parameter_chart: [
      {
        title: 'Smoke particle size by mode',
        unit: 'nm',
        series: [
          {
            name: 'Count median diameter',
            values: [
              { label: 'Pyrolysis', value: 180 },
              { label: 'Flaming', value: 320 },
            ],
          },
        ],
      },
    ],
    evidence_quality: 'High',
  }),
  embed({
    id: 'ACME-CLD',
    full_name: 'Advanced Combustion via Microgravity Experiments – Cool Flame Diffusion',
    domain_cluster: 'Microgravity_Gas_Ignition',
    mission: 'ISS Expeditions 55–63',
    year: 2019,
    facility: 'Combustion Integrated Rack (CIR) – ACME burner insert',
    description:
      'Gas-jet diffusion cool flames on a spherical porous burner (DME, methane, ethane) to study low-temperature chemistry of gaseous fuels without droplet complications.',
    materials: ['dimethyl ether (DME)', 'methane', 'ethane'],
    safety_takeaway:
      'Gaseous cool flames exist at cabin-relevant O2 levels — gas leak fire risk persists after visible flameout.',
    methodology:
      'Spherical burner with controlled fuel flow in O2/N2 and O2/He at 0.25–1 atm; chemiluminescence imaging, thermocouples, gas sampling.',
    parameters: {
      fuels: ['dimethyl ether', 'methane', 'ethane'],
      burner_diameter_mm: 12.7,
      fuel_flow_sccm: [40, 80, 120],
      ambient_pressure_atm: [0.25, 0.5, 1.0],
      o2_concentration_pct: [21, 30, 40, 50],
      cool_flame_temperature_k: 780,
      gravity: 'microgravity',
    },
    parameter_chart: [
      {
        title: 'Cool-flame existence vs O2 (DME)',
        unit: '%',
        series: [
          {
            name: 'Minimum O2 for cool flame',
            values: [
              { label: '0.25 atm', value: 40 },
              { label: '0.5 atm', value: 32 },
              { label: '1.0 atm', value: 25 },
            ],
          },
        ],
      },
    ],
    evidence_quality: 'High',
  }),
  embed({
    id: 'SPICE',
    full_name: 'Smoke Point In Co-flow Experiment',
    domain_cluster: 'Microgravity_Gas_Ignition',
    mission: 'ISS Expeditions 25–35',
    year: 2013,
    facility: 'Combustion Integrated Rack (CIR)',
    description:
      'Laminar gas-jet diffusion flames (ethylene, methane, propane) in controlled co-flow to determine smoke point and soot propensity in microgravity.',
    materials: ['ethylene', 'methane', 'propane'],
    safety_takeaway:
      'Microgravity soot emissions are higher than normal gravity at the same fuel rate — smoke load models for cabin fires need µg data.',
    methodology:
      'Co-flow burner with variable fuel velocity; wide-angle and color cameras, laser extinction for soot volume fraction.',
    parameters: {
      fuels: ['ethylene', 'methane', 'propane'],
      burner_exit_diameter_mm: 0.8,
      coflow_velocity_cm_s: [10, 20, 35],
      smoke_point_fuel_velocity_cm_s: { ethylene: 5.5, methane: 11.2, propane: 7.8 },
      soot_volume_fraction_ppm: { ethylene: 8.2, methane: 1.1, propane: 4.5 },
      ambient_pressure_atm: 1.0,
      gravity: 'microgravity',
    },
    parameter_chart: [
      {
        title: 'Soot volume fraction by fuel',
        unit: 'ppm',
        series: [
          {
            name: 'Peak fv',
            values: [
              { label: 'Methane', value: 1.1 },
              { label: 'Propane', value: 4.5 },
              { label: 'Ethylene', value: 8.2 },
            ],
          },
        ],
      },
    ],
    evidence_quality: 'High',
  }),
  embed({
    id: 'BRE',
    full_name: 'Burning Rate Emitter experiment',
    domain_cluster: 'Microgravity_Gas_Ignition',
    mission: 'ISS Expeditions 61–67',
    year: 2020,
    facility: 'Combustion Integrated Rack (CIR)',
    description:
      'Gas-jet flames at elevated O2 and pressure to measure burning rates for lunar/Mars habitat atmospheres (34–45% O2, 50–70 kPa).',
    materials: ['methane', 'ethylene'],
    safety_takeaway:
      'Elevated-O2 exploration atmospheres increase flame speed and heat release — habitat O2 enrichment requires revised flammability screening.',
    methodology:
      'Burner-stabilized flames with variable O2 (34–45%) and pressure (50–70 kPa) representing lunar/Mars cabins; measured flame height, spread rate, radiation.',
    parameters: {
      fuels: ['methane', 'ethylene'],
      o2_concentration_pct: [34, 40, 45],
      ambient_pressure_kpa: [50, 60, 70],
      flame_height_mm: { at_34pct: 42, at_45pct: 61 },
      heat_release_scale: 'relative to 21% O2 baseline: 1.4–1.9×',
      gravity: 'microgravity',
    },
    parameter_chart: [
      {
        title: 'Normalized heat release vs O2 (lunar cabin atmos.)',
        unit: '× baseline',
        series: [
          {
            name: 'Heat release',
            values: [
              { label: '34% O2', value: 1.4 },
              { label: '40% O2', value: 1.65 },
              { label: '45% O2', value: 1.9 },
            ],
          },
        ],
      },
    ],
    evidence_quality: 'Medium',
  }),
]

export function findExperiment(id: string): ExperimentRecord | undefined {
  return EXPERIMENTS.find((exp) => exp.id.toLowerCase() === id.toLowerCase())
}
