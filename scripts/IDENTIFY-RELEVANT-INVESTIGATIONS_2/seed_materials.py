#!/usr/bin/env python3
"""
Build the material <-> PSI investigation link layer.

Outputs (all inside this folder):
  data/materials.json
  data/investigation_materials.json
  data/investigation_topics.json
  data/materials.csv
  data/investigation_materials.csv
  sql/01_schema_materials.sql
  sql/02_seed_materials.sql
  sql/03_seed_investigation_materials.sql
  sql/04_views_materials.sql

The seed data is curated from the reports, science documents, test matrices
and raw-data folder names under PSI-TEXT-FILES_1_1. Every link carries at
least one evidence path and, where possible, a short exact quote.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
SQL = ROOT / "sql"
DATA.mkdir(exist_ok=True)
SQL.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# 1. Material taxonomy
# ---------------------------------------------------------------------------
MATERIALS = [
    {
        "id": "ptfe_teflon",
        "canonical_name": "Polytetrafluoroethylene (PTFE / Teflon)",
        "category": "fluoropolymer",
        "phase": "solid",
        "chemical_formula": "(C2F4)n",
        "aliases": ["Teflon", "Teflon®", "PTFE", "polytetrafluoroethylene"],
        "spacecraft_relevance": "Wire insulation, tubing, seals, thermal blankets and other polymer components in crewed habitats.",
        "fire_safety_notes": "Melts and can drip; thermal decomposition can release HF and carbonyl fluoride. SAME data show very small smoke particles that are hard for optical detectors to see.",
        "is_fuel": True,
    },
    {
        "id": "polyimide_kapton",
        "canonical_name": "Polyimide (Kapton)",
        "category": "polyimide",
        "phase": "solid",
        "chemical_formula": "(C22H10N2O5)n",
        "aliases": ["Kapton", "Kapton®", "polyimide", "PI"],
        "spacecraft_relevance": "Wire and cable insulation, flexible circuits, thermal blankets and heater films.",
        "fire_safety_notes": "Chars rather than melts; can smolder and produce ultrafine smoke. Relevant to detection and to arc-track / insulation failure scenarios.",
        "is_fuel": True,
    },
    {
        "id": "silicone_rubber",
        "canonical_name": "Silicone rubber",
        "category": "elastomer",
        "phase": "solid",
        "chemical_formula": "[-Si(CH3)2O-]n",
        "aliases": ["silicone", "silicone rubber", "RTV silicone", "siloxane"],
        "spacecraft_relevance": "Seals, gaskets, potting compounds, flexible insulation and crew equipment.",
        "fire_safety_notes": "Leaves silica ash; can smolder. SAME data show a larger smoke-particle mode than Teflon or Kapton.",
        "is_fuel": True,
    },
    {
        "id": "pyrell_foam",
        "canonical_name": "Pyrell intumescent foam",
        "category": "foam",
        "phase": "solid",
        "chemical_formula": None,
        "aliases": ["Pyrell", "Pyrell®", "Pyrel", "intumescent polyurethane foam"],
        "spacecraft_relevance": "Fire-retardant foam used as a test material for smoke generation and material flammability.",
        "fire_safety_notes": "Intumescent fire-retardant foam by Foamex. SAME-R introduced Pyrell to replace the liquid DBP smoke source and to test a realistic solid foam.",
        "is_fuel": True,
    },
    {
        "id": "cotton_lampwick",
        "canonical_name": "Cotton lamp wick (cellulose)",
        "category": "cellulose",
        "phase": "solid",
        "chemical_formula": "(C6H10O5)n",
        "aliases": ["lampwick", "lamp wick", "cotton lamp wick", "cotton wick", "cellulose"],
        "spacecraft_relevance": "Cellulosic representative fuel; wick material used to hold liquid smoke sources.",
        "fire_safety_notes": "Pyrolysis, charring and smoldering; a standard cellulosic solid fuel in SAME and SAME-R.",
        "is_fuel": True,
    },
    {
        "id": "sibal_fabric",
        "canonical_name": "SIBAL cotton-fiberglass fabric",
        "category": "composite_fabric",
        "phase": "solid",
        "chemical_formula": None,
        "aliases": ["SIBAL", "Sibal", "cotton-fiberglass fabric", "cotton fiberglass fabric", "SIBAL cloth"],
        "spacecraft_relevance": "NASA solid-fuel flammability test material; analog for clothing, linens and other cellulosic fabrics in spacecraft.",
        "fire_safety_notes": "75% cotton + 25% fiberglass by mass. Burns like cotton but keeps structural integrity after the cotton is consumed, which makes it useful for long-duration flame-spread tests.",
        "is_fuel": True,
    },
    {
        "id": "cotton",
        "canonical_name": "Cotton (cellulose)",
        "category": "cellulose",
        "phase": "solid",
        "chemical_formula": "(C6H10O5)n",
        "aliases": ["cotton", "cellulose"],
        "spacecraft_relevance": "Constituent of SIBAL and a common clothing/bedding material.",
        "fire_safety_notes": "Cellulosic fuel; burns and chars. The combustible part of SIBAL.",
        "is_fuel": True,
    },
    {
        "id": "fiberglass",
        "canonical_name": "Fiberglass (glass fiber)",
        "category": "inorganic_fiber",
        "phase": "solid",
        "chemical_formula": "SiO2-based glass",
        "aliases": ["fiberglass", "fibre glass", "glass fiber", "glass fibre", "E-glass"],
        "spacecraft_relevance": "Composite reinforcement and fire-resistant structural fabric.",
        "fire_safety_notes": "Noncombustible inorganic reinforcement. Retains the sample shape after the cotton burns, affecting flame spread and extinction.",
        "is_fuel": False,
    },
    {
        "id": "nomex_aramid",
        "canonical_name": "Nomex aramid fabric",
        "category": "aramid",
        "phase": "solid",
        "chemical_formula": "(C14H12O2N2)n",
        "aliases": ["Nomex", "Nomex®", "meta-aramid", "aramid", "Nomex III"],
        "spacecraft_relevance": "Fire-resistant clothing, insulation, stowage and cabin fabrics.",
        "fire_safety_notes": "Char-forming aramid. BASS showed that some Nomex variants can burn in high-oxygen, low-velocity microgravity conditions, while others self-extinguish.",
        "is_fuel": True,
    },
    {
        "id": "ultem_pei",
        "canonical_name": "Ultem polyetherimide (PEI)",
        "category": "polyetherimide",
        "phase": "solid",
        "chemical_formula": "(C37H24O6N2)n",
        "aliases": ["Ultem", "Ultem®", "PEI", "polyetherimide"],
        "spacecraft_relevance": "High-performance aerospace plastic used for connectors, brackets and structural parts.",
        "fire_safety_notes": "BASS tested Ultem rods; the material did not sustain burning in ISS atmosphere in those tests.",
        "is_fuel": True,
    },
    {
        "id": "pmma_acrylic",
        "canonical_name": "Polymethyl methacrylate (PMMA / acrylic)",
        "category": "acrylic",
        "phase": "solid",
        "chemical_formula": "(C5H8O2)n",
        "aliases": ["PMMA", "polymethyl methacrylate", "polymethylmethacrylate", "acrylic", "Plexiglas", "Lucite"],
        "spacecraft_relevance": "Transparent structural plastic; idealized solid fuel for flame-spread experiments.",
        "fire_safety_notes": "Clean-burning thermoplastic and a standard benchmark for opposed and concurrent flame spread. BASS used rods, slabs and spheres; SAFFIRE-II used flat PMMA.",
        "is_fuel": True,
    },
    {
        "id": "paraffin_wax",
        "canonical_name": "Paraffin wax",
        "category": "wax",
        "phase": "solid",
        "chemical_formula": "CnH2n+2 (C20-C40)",
        "aliases": ["paraffin", "paraffin wax", "wax"],
        "spacecraft_relevance": "Phase-change material, candle analog and solid fuel.",
        "fire_safety_notes": "Melts and burns as a pool. BASS used fiberglass fabric saturated with paraffin wax.",
        "is_fuel": True,
    },
    {
        "id": "japan_wax",
        "canonical_name": "Japan wax (candle wax)",
        "category": "wax",
        "phase": "solid",
        "chemical_formula": "triglyceride mixture",
        "aliases": ["Japan wax", "candle wax", "candle"],
        "spacecraft_relevance": "Candle analog for microgravity flame studies.",
        "fire_safety_notes": "BASS burned Japan-wax candles inside tubes to study low-velocity candle flames.",
        "is_fuel": True,
    },
    {
        "id": "dbp",
        "canonical_name": "Dibutyl phthalate (DBP)",
        "category": "phthalate",
        "phase": "liquid",
        "chemical_formula": "C16H22O4",
        "aliases": ["DBP", "dibutyl phthalate", "dibutyl-phthalate"],
        "spacecraft_relevance": "Liquid smoke source used to generate controlled pyrolysis aerosol in SAME.",
        "fire_safety_notes": "Deposited on a cotton wick and heated. Replaced by Pyrell in SAME-R because a solid fire-retardant foam was more representative.",
        "is_fuel": True,
    },
    {
        "id": "n_heptane",
        "canonical_name": "n-Heptane",
        "category": "alkane",
        "phase": "liquid",
        "chemical_formula": "C7H16",
        "aliases": ["heptane", "n-heptane", "C7H16"],
        "spacecraft_relevance": "Reference liquid fuel and diesel/Jet-A surrogate.",
        "fire_safety_notes": "Well-characterized droplet fuel; FLEX measured LOI and suppression effectiveness, FLEX-2 used heptane in surrogate mixtures.",
        "is_fuel": True,
    },
    {
        "id": "n_dodecane",
        "canonical_name": "n-Dodecane",
        "category": "alkane",
        "phase": "liquid",
        "chemical_formula": "C12H26",
        "aliases": ["dodecane", "n-dodecane", "C12H26"],
        "spacecraft_relevance": "Diesel and Jet-A surrogate; cool-flame droplet fuel.",
        "fire_safety_notes": "CFI burned n-dodecane droplets and n-dodecane/iso-dodecane blends at 0.25-5 atm.",
        "is_fuel": True,
    },
    {
        "id": "iso_dodecane",
        "canonical_name": "iso-Dodecane",
        "category": "branched_alkane",
        "phase": "liquid",
        "chemical_formula": "C12H26",
        "aliases": ["isododecane", "iso-dodecane", "2,2,4,6,6-pentamethylheptane"],
        "spacecraft_relevance": "Branched surrogate component in aviation/diesel fuel blends.",
        "fire_safety_notes": "CFI tested 60/40 and 75/25 n-dodecane/iso-dodecane blends to study cool-flame behavior.",
        "is_fuel": True,
    },
    {
        "id": "farnesane",
        "canonical_name": "Farnesane",
        "category": "branched_alkane",
        "phase": "liquid",
        "chemical_formula": "C15H32",
        "aliases": ["farnesane", "2,6,10-trimethyldodecane"],
        "spacecraft_relevance": "Sustainable aviation fuel surrogate.",
        "fire_safety_notes": "Branched C15 alkane burned as a droplet in CFI to extend cool-flame data to larger molecules.",
        "is_fuel": True,
    },
    {
        "id": "n_decane",
        "canonical_name": "n-Decane",
        "category": "alkane",
        "phase": "liquid",
        "chemical_formula": "C10H22",
        "aliases": ["decane", "n-decane", "C10H22"],
        "spacecraft_relevance": "Diesel/Jet-A surrogate and FLEX-2 droplet fuel.",
        "fire_safety_notes": "FLEX-2 focused on ethanol and decane as fuels and on decane/propylbenzene surrogate mixtures.",
        "is_fuel": True,
    },
    {
        "id": "n_octane",
        "canonical_name": "n-Octane",
        "category": "alkane",
        "phase": "liquid",
        "chemical_formula": "C8H18",
        "aliases": ["octane", "n-octane", "C8H18"],
        "spacecraft_relevance": "Gasoline surrogate component.",
        "fire_safety_notes": "FLEX-2 surrogate-fuel test matrix included 100% n-octane and iso-octane.",
        "is_fuel": True,
    },
    {
        "id": "iso_octane",
        "canonical_name": "iso-Octane",
        "category": "branched_alkane",
        "phase": "liquid",
        "chemical_formula": "C8H18",
        "aliases": ["isooctane", "iso-octane", "2,2,4-trimethylpentane"],
        "spacecraft_relevance": "Gasoline surrogate component.",
        "fire_safety_notes": "FLEX-2 surrogate-fuel test matrix.",
        "is_fuel": True,
    },
    {
        "id": "toluene",
        "canonical_name": "Toluene",
        "category": "aromatic",
        "phase": "liquid",
        "chemical_formula": "C7H8",
        "aliases": ["toluene", "methylbenzene", "C7H8"],
        "spacecraft_relevance": "Aromatic surrogate component; soot precursor.",
        "fire_safety_notes": "FLEX-2 surrogate-fuel test matrix; aromatic fuels strongly affect soot production.",
        "is_fuel": True,
    },
    {
        "id": "propylbenzene",
        "canonical_name": "n-Propylbenzene",
        "category": "aromatic",
        "phase": "liquid",
        "chemical_formula": "C9H12",
        "aliases": ["propylbenzene", "n-propylbenzene", "C9H12"],
        "spacecraft_relevance": "Aromatic surrogate component; soot precursor.",
        "fire_safety_notes": "FLEX-2 used propylbenzene and decane/propylbenzene mixtures.",
        "is_fuel": True,
    },
    {
        "id": "n_propanol",
        "canonical_name": "1-Propanol",
        "category": "alcohol",
        "phase": "liquid",
        "chemical_formula": "C3H8O",
        "aliases": ["propanol", "1-propanol", "n-propanol", "C3H8O"],
        "spacecraft_relevance": "Oxygenated fuel component.",
        "fire_safety_notes": "FLEX-2 condensed-phase test matrix used propanol/glycerol mixtures.",
        "is_fuel": True,
    },
    {
        "id": "glycerol",
        "canonical_name": "Glycerol",
        "category": "polyol",
        "phase": "liquid",
        "chemical_formula": "C3H8O3",
        "aliases": ["glycerol", "glycerin", "C3H8O3"],
        "spacecraft_relevance": "Condensed-phase fuel additive; biofuel byproduct.",
        "fire_safety_notes": "FLEX-2 used 95% propanol / 5% glycerol and 80/20 mixtures to study condensed-phase droplet burning.",
        "is_fuel": True,
    },
    {
        "id": "ethanol",
        "canonical_name": "Ethanol",
        "category": "alcohol",
        "phase": "liquid",
        "chemical_formula": "C2H6O",
        "aliases": ["ethanol", "ethyl alcohol", "C2H6O"],
        "spacecraft_relevance": "Biofuel constituent and oxygenated fuel.",
        "fire_safety_notes": "FLEX-2 focused on ethanol and decane; ethanol/decane binary droplets were used to study differential vaporization.",
        "is_fuel": True,
    },
    {
        "id": "methanol",
        "canonical_name": "Methanol",
        "category": "alcohol",
        "phase": "liquid",
        "chemical_formula": "CH4O",
        "aliases": ["methanol", "methyl alcohol", "MeOH", "CH3OH"],
        "spacecraft_relevance": "Oxygenated fuel and cool-flame reference fuel.",
        "fire_safety_notes": "FLEX measured LOI and suppressant effectiveness for heptane and methanol; PSI-117 modeled methanol cool flames.",
        "is_fuel": True,
    },
    {
        "id": "n_hexadecane",
        "canonical_name": "n-Hexadecane",
        "category": "alkane",
        "phase": "liquid",
        "chemical_formula": "C16H34",
        "aliases": ["hexadecane", "n-hexadecane", "cetane", "C16H34"],
        "spacecraft_relevance": "Bi-component droplet fuel; diesel surrogate.",
        "fire_safety_notes": "FLEX-2 references heptane-hexadecane mixture droplets for differential vaporization studies.",
        "is_fuel": True,
    },
    {
        "id": "methane",
        "canonical_name": "Methane",
        "category": "gas_fuel",
        "phase": "gas",
        "chemical_formula": "CH4",
        "aliases": ["methane", "CH4", "natural gas"],
        "spacecraft_relevance": "Gaseous fuel; relevant to cabin atmosphere contamination and life-support processes.",
        "fire_safety_notes": "Simple gaseous fuel used in ACME CLD, s-Flame, E-FIELD, SLICE, SPICE and BRE. Cleaner soot behavior than ethylene.",
        "is_fuel": True,
    },
    {
        "id": "ethylene",
        "canonical_name": "Ethylene",
        "category": "gas_fuel",
        "phase": "gas",
        "chemical_formula": "C2H4",
        "aliases": ["ethylene", "ethene", "C2H4"],
        "spacecraft_relevance": "Gaseous fuel and soot precursor; common in combustion research.",
        "fire_safety_notes": "Strongly sooting gaseous fuel used in ACME Flame Design, CLD, s-Flame, E-FIELD, SLICE, SPICE, BRE and PSI-10.",
        "is_fuel": True,
    },
    {
        "id": "ethane",
        "canonical_name": "Ethane",
        "category": "gas_fuel",
        "phase": "gas",
        "chemical_formula": "C2H6",
        "aliases": ["ethane", "C2H6"],
        "spacecraft_relevance": "Gaseous fuel; CFI-G alternative fuel.",
        "fire_safety_notes": "Substituted for n-pentane in CFI-G because n-pentane's vapor pressure was too low.",
        "is_fuel": True,
    },
    {
        "id": "propane",
        "canonical_name": "Propane",
        "category": "gas_fuel",
        "phase": "gas",
        "chemical_formula": "C3H8",
        "aliases": ["propane", "C3H8", "LPG"],
        "spacecraft_relevance": "Gaseous fuel; smoke-point and flame-design studies.",
        "fire_safety_notes": "SPICE found an unusually high sooting propensity for propane in microgravity. CFI-G burned propane cool flames.",
        "is_fuel": True,
    },
    {
        "id": "n_butane",
        "canonical_name": "n-Butane",
        "category": "gas_fuel",
        "phase": "gas",
        "chemical_formula": "C4H10",
        "aliases": ["butane", "n-butane", "C4H10"],
        "spacecraft_relevance": "Gaseous fuel; CFI-G.",
        "fire_safety_notes": "CFI-G burned normal and inverse n-butane cool diffusion flames.",
        "is_fuel": True,
    },
    {
        "id": "n_pentane",
        "canonical_name": "n-Pentane",
        "category": "gas_fuel",
        "phase": "liquid/gas",
        "chemical_formula": "C5H12",
        "aliases": ["pentane", "n-pentane", "C5H12"],
        "spacecraft_relevance": "Planned CFI-G fuel.",
        "fire_safety_notes": "Planned for CFI-G but replaced by ethane because its vapor pressure was too low for the ACME hardware.",
        "is_fuel": True,
    },
    {
        "id": "propylene",
        "canonical_name": "Propylene",
        "category": "gas_fuel",
        "phase": "gas",
        "chemical_formula": "C3H6",
        "aliases": ["propylene", "propene", "C3H6"],
        "spacecraft_relevance": "Gaseous fuel and soot precursor.",
        "fire_safety_notes": "SPICE measured smoke points for propylene and propylene/nitrogen mixtures; it is the most strongly sooting fuel in that set.",
        "is_fuel": True,
    },
    {
        "id": "dimethyl_ether",
        "canonical_name": "Dimethyl ether (DME)",
        "category": "oxygenated_fuel",
        "phase": "gas/liquid",
        "chemical_formula": "C2H6O",
        "aliases": ["dimethyl ether", "DME", "methoxymethane", "C2H6O"],
        "spacecraft_relevance": "Oxygenated fuel used in cool-flame ground experiments.",
        "fire_safety_notes": "PSI-142 used DME/air mixtures for 1-D cool-flame and warm-flame modeling.",
        "is_fuel": True,
    },
    {
        "id": "n_tetradecane",
        "canonical_name": "n-Tetradecane",
        "category": "alkane",
        "phase": "liquid",
        "chemical_formula": "C14H30",
        "aliases": ["tetradecane", "n-tetradecane", "C14H30"],
        "spacecraft_relevance": "Large n-alkane cool-flame reference fuel.",
        "fire_safety_notes": "PSI-142 compiled nC7, nC8, nC10, nC12 and nC14 cool-flame extinction data.",
        "is_fuel": True,
    },
    {
        "id": "ozone",
        "canonical_name": "Ozone",
        "category": "oxidizer_additive",
        "phase": "gas",
        "chemical_formula": "O3",
        "aliases": ["ozone", "O3"],
        "spacecraft_relevance": "Laboratory sensitizer for cool-flame experiments.",
        "fire_safety_notes": "PSI-142 used ozone-sensitized counterflow flames to access cool-flame regimes at ground conditions.",
        "is_fuel": False,
    },
    {
        "id": "arizona_road_dust",
        "canonical_name": "Arizona Road Dust (fine)",
        "category": "aerosol_standard",
        "phase": "solid",
        "chemical_formula": None,
        "aliases": ["Arizona Road Dust", "ARD", "ARD Fine"],
        "spacecraft_relevance": "Standardized aerosol for instrument validation, not a spacecraft material.",
        "fire_safety_notes": "DAFT used ARD to validate the modified P-Trak and DustTrak aerosol monitors in microgravity. It is a test aerosol, not a combustion fuel.",
        "is_fuel": False,
    },
    {
        "id": "soot",
        "canonical_name": "Soot",
        "category": "combustion_product",
        "phase": "solid",
        "chemical_formula": "C (black carbon)",
        "aliases": ["soot", "black carbon", "carbonaceous particulate"],
        "spacecraft_relevance": "Fire signature, radiant heat source and detector challenge.",
        "fire_safety_notes": "Soot volume fraction and radiation are central to flame spread and smoke detection.",
        "is_fuel": False,
    },
    {
        "id": "smoke_aerosol",
        "canonical_name": "Smoke aerosol",
        "category": "combustion_product",
        "phase": "solid/gas",
        "chemical_formula": None,
        "aliases": ["smoke", "aerosol", "particulate", "particle size distribution"],
        "spacecraft_relevance": "Fire detection and crew warning.",
        "fire_safety_notes": "SAME and SAME-R measured smoke particle size distributions for different materials; detector response depends strongly on particle size.",
        "is_fuel": False,
    },
    {
        "id": "nitrogen",
        "canonical_name": "Nitrogen",
        "category": "atmosphere",
        "phase": "gas",
        "chemical_formula": "N2",
        "aliases": ["nitrogen", "N2", "GN2"],
        "spacecraft_relevance": "Cabin diluent and test-atmosphere balance gas.",
        "fire_safety_notes": "Diluent; lowering oxygen mole fraction by adding nitrogen is a standard suppression/flammability-limit variable.",
        "is_fuel": False,
    },
    {
        "id": "carbon_dioxide",
        "canonical_name": "Carbon dioxide",
        "category": "suppressant",
        "phase": "gas",
        "chemical_formula": "CO2",
        "aliases": ["carbon dioxide", "CO2"],
        "spacecraft_relevance": "Fire suppressant and metabolic product.",
        "fire_safety_notes": "FLEX measured CO2 suppression effectiveness for heptane and methanol flames.",
        "is_fuel": False,
    },
    {
        "id": "helium",
        "canonical_name": "Helium",
        "category": "suppressant",
        "phase": "gas",
        "chemical_formula": "He",
        "aliases": ["helium", "He"],
        "spacecraft_relevance": "Inert suppressant/diluent.",
        "fire_safety_notes": "FLEX tested helium as a fire suppressant; its high diffusivity changes flame behavior.",
        "is_fuel": False,
    },
    {
        "id": "sulfur_hexafluoride",
        "canonical_name": "Sulfur hexafluoride",
        "category": "suppressant",
        "phase": "gas",
        "chemical_formula": "SF6",
        "aliases": ["sulfur hexafluoride", "SF6", "sulphur hexafluoride"],
        "spacecraft_relevance": "High-performance gaseous fire suppressant.",
        "fire_safety_notes": "FLEX tested SF6 as a suppressant for heptane and methanol flames.",
        "is_fuel": False,
    },
    {
        "id": "oxygen",
        "canonical_name": "Oxygen",
        "category": "oxidizer",
        "phase": "gas",
        "chemical_formula": "O2",
        "aliases": ["oxygen", "O2"],
        "spacecraft_relevance": "Cabin oxidizer; oxygen concentration is a primary flammability variable.",
        "fire_safety_notes": "Lowering oxygen mole fraction is the main lever for material flammability limits; many PSI tests vary O2 from ~15% to ~40%.",
        "is_fuel": False,
    },
]

MATERIAL_INDEX = {m["id"]: m for m in MATERIALS}

# ---------------------------------------------------------------------------
# 2. Investigation -> material links
# ---------------------------------------------------------------------------
# Every tuple:
# (investigation_id, material_id, role, confidence, is_primary,
#  evidence_quality, data_completeness, evidence_files, evidence_quote, notes)
LINKS = [
    # PSI-10 ACME Flame Design
    ("PSI-10", "ethylene", "fuel", "high", True, 95, 85,
     ["PSI-10/Reports/PSI-10_Reports_FinalRpt_ACMEFlameDesign.pdf",
      "PSI-10/Raw Data/Reduced Gravity/1_normal_ethylene_flames_inferior_burner_1002",
      "PSI-10/Raw Data/Reduced Gravity/4_inverse_ethylene_flames_burner_1003"],
     "Except for the single propane (C3H8) test day previously mentioned, all ISS tests were conducted with the fuel ethylene (C2H4).",
     "Primary flight fuel; normal and inverse spherical diffusion flames."),
    ("PSI-10", "propane", "fuel", "medium", False, 85, 75,
     ["PSI-10/Reports/PSI-10_Reports_FinalRpt_ACMEFlameDesign.pdf",
      "PSI-10/Raw Data/Reduced Gravity/3_normal_propane_flames_burner_1003"],
     "the first day of testing in the second round was carried out in the normal flame configuration, with propane (with or without nitrogen) flowing into an oxygen/nitrogen atmosphere.",
     "One propane test day; not the main fuel."),
    ("PSI-10", "methane", "planned_not_tested", "low", False, 55, 45,
     ["PSI-10/Reports/PSI-10_Reports_FinalRpt_ACMEFlameDesign.pdf"],
     "Desired ISS testing with the fuel methane (CH4), inert carbon dioxide (CO2), and coflow flame configuration was not ...",
     "Methane was planned but the reported ISS test campaign focused on ethylene/propane."),

    # PSI-100 SAFFIRE-III
    ("PSI-100", "sibal_fabric", "test_material", "high", True, 90, 85,
     ["PSI-100/Science Documents/PSI-100_Science Documents_SAFFIRE Objectives, Development and Status.pdf",
      "PSI-100/Science Documents/PSI-100_Science Documents_SAFFIRE-I and SAFFIRE-III Readme.docx"],
     "The sample material for SAFFIRE-I and SAFFIRE-III is a composite fabric consisting of cotton on a fiberglass substrate (75% cotton, 25% fiberglass by weight). It is called SIBAL cloth ...",
     "Large-scale fire growth at 30 cm/s airflow."),
    ("PSI-100", "cotton", "constituent", "high", False, 85, 80,
     ["PSI-100/Science Documents/PSI-100_Science Documents_SAFFIRE Objectives, Development and Status.pdf"],
     "75% cotton, 25% fiberglass by weight",
     "Combustible constituent of SIBAL."),
    ("PSI-100", "fiberglass", "constituent", "high", False, 85, 80,
     ["PSI-100/Science Documents/PSI-100_Science Documents_SAFFIRE Objectives, Development and Status.pdf"],
     "75% cotton, 25% fiberglass by weight",
     "Noncombustible reinforcement that preserves sample geometry after cotton burns."),

    # PSI-101 SAME-R
    ("PSI-101", "ptfe_teflon", "test_material", "high", True, 95, 90,
     ["PSI-101/Reports/PSI-101_Reports_SAME-R_Final Report.pdf",
      "PSI-101/Raw Data/Reduced Gravity/Teflon"],
     "included 6 Pyrell, 6 silicone rubber, 9 Kapton, 5 lamp wick and 4 Teflon samples.",
     "Smoke particle size and morphology; Teflon produces very small particles."),
    ("PSI-101", "polyimide_kapton", "test_material", "high", True, 95, 90,
     ["PSI-101/Reports/PSI-101_Reports_SAME-R_Final Report.pdf",
      "PSI-101/Raw Data/Reduced Gravity/Kapton"],
     "included 6 Pyrell, 6 silicone rubber, 9 Kapton, 5 lamp wick and 4 Teflon samples.",
     "Kapton was the most frequently tested material in SAME-R."),
    ("PSI-101", "silicone_rubber", "test_material", "high", True, 95, 90,
     ["PSI-101/Reports/PSI-101_Reports_SAME-R_Final Report.pdf",
      "PSI-101/Raw Data/Reduced Gravity/Silicone"],
     "included 6 Pyrell, 6 silicone rubber, 9 Kapton, 5 lamp wick and 4 Teflon samples.",
     "Silicone smoke has a larger particle mode than Teflon/Kapton."),
    ("PSI-101", "pyrell_foam", "test_material", "high", True, 95, 90,
     ["PSI-101/Reports/PSI-101_Reports_SAME-R_Final Report.pdf",
      "PSI-101/Raw Data/Reduced Gravity/Pyrell"],
     "Pyrell®, an intumescent fire-retardant foam by Foamex, was introduced to replace DBP samples ...",
     "New solid foam test material in SAME-R."),
    ("PSI-101", "cotton_lampwick", "test_material", "high", True, 95, 90,
     ["PSI-101/Reports/PSI-101_Reports_SAME-R_Final Report.pdf",
      "PSI-101/Raw Data/Reduced Gravity/Cotton Lamp wick"],
     "included 6 Pyrell, 6 silicone rubber, 9 Kapton, 5 lamp wick and 4 Teflon samples.",
     "Cellulosic reference material."),
    ("PSI-101", "dbp", "replaced_material", "high", False, 75, 55,
     ["PSI-101/Reports/PSI-101_Reports_SAME-R_Final Report.pdf"],
     "Pyrell®, an intumescent fire-retardant foam by Foamex, was introduced to replace DBP samples ...",
     "DBP was the SAME liquid smoke source; SAME-R replaced it with Pyrell."),

    # PSI-102 SAME
    ("PSI-102", "ptfe_teflon", "test_material", "high", True, 95, 90,
     ["PSI-102/Reports/PSI-102_Reports_SAME_Final Science Report.pdf",
      "PSI-102/Analyzed Data/Reduced Gravity/Teflon"],
     "Four materials, typical of those found in spacecraft, were tested including cellulose (lamp wick), Kapton, silicone rubber, and Teflon.",
     "Smoke generation and particle size in microgravity."),
    ("PSI-102", "polyimide_kapton", "test_material", "high", True, 95, 90,
     ["PSI-102/Reports/PSI-102_Reports_SAME_Final Science Report.pdf",
      "PSI-102/Analyzed Data/Reduced Gravity/Kapton"],
     "Four materials, typical of those found in spacecraft, were tested including cellulose (lamp wick), Kapton, silicone rubber, and Teflon.",
     "Smoke generation and particle size in microgravity."),
    ("PSI-102", "silicone_rubber", "test_material", "high", True, 95, 90,
     ["PSI-102/Reports/PSI-102_Reports_SAME_Final Science Report.pdf",
      "PSI-102/Analyzed Data/Reduced Gravity/Silicone"],
     "Four materials, typical of those found in spacecraft, were tested including cellulose (lamp wick), Kapton, silicone rubber, and Teflon.",
     "Silicone smoke produced a larger detector response than Teflon."),
    ("PSI-102", "cotton_lampwick", "test_material", "high", True, 95, 90,
     ["PSI-102/Reports/PSI-102_Reports_SAME_Final Science Report.pdf",
      "PSI-102/Analyzed Data/Reduced Gravity/Cotton Lamp wick"],
     "Four materials, typical of those found in spacecraft, were tested including cellulose (lamp wick), Kapton, silicone rubber, and Teflon.",
     "Cellulosic reference material."),
    ("PSI-102", "dbp", "test_material", "high", True, 95, 90,
     ["PSI-102/Reports/PSI-102_Reports_SAME_Final Science Report.pdf",
      "PSI-102/Analyzed Data/Reduced Gravity/Dibutyl Phthalate"],
     "A fifth material, dibutyl-phthalate (DBP) retained in a cotton wick ...",
     "Liquid smoke source; five materials total."),

    # PSI-106 SLICE
    ("PSI-106", "methane", "fuel", "high", True, 90, 85,
     ["PSI-106/Raw Data/Legacy/2015 - SLICE Final Report/SLICE final report 20151224.pdf"],
     "CH4 methane (a SLICE fuel)",
     "Primary SLICE fuel."),
    ("PSI-106", "ethylene", "fuel", "high", True, 90, 85,
     ["PSI-106/Raw Data/Legacy/2015 - SLICE Final Report/SLICE final report 20151224.pdf"],
     "C2H4 ethylene (a SLICE fuel)",
     "Primary SLICE fuel."),
    ("PSI-106", "propane", "fuel", "medium", False, 80, 70,
     ["PSI-106/Raw Data/Legacy/2015 - SLICE Final Report/SLICE final report 20151224.pdf"],
     "C3H8 propane (a SPICE fuel)",
     "Used in limited SLICE tests, mainly as a comparison fuel."),
    ("PSI-106", "ethane", "fuel", "low", False, 75, 65,
     ["PSI-106/Raw Data/Legacy/2015 - SLICE Final Report/SLICE final report 20151224.pdf"],
     "C2H6 ethane (a SPICE fuel that was used in limited SLICE tests)",
     "Limited tests only."),

    # PSI-107 SPICE
    ("PSI-107", "ethylene", "fuel", "high", True, 95, 90,
     ["PSI-107/Reports/PSI-107_Reports_SPICE_FinalReport.pdf"],
     "Fifty-two smoke points were found for ethylene, propane, propylene, and propylene/nitrogen ...",
     "Primary smoke-point fuel."),
    ("PSI-107", "propane", "fuel", "high", True, 95, 90,
     ["PSI-107/Reports/PSI-107_Reports_SPICE_FinalReport.pdf"],
     "Fifty-two smoke points were found for ethylene, propane, propylene, and propylene/nitrogen ...",
     "Unusually high sooting propensity in microgravity."),
    ("PSI-107", "propylene", "fuel", "high", True, 95, 90,
     ["PSI-107/Reports/PSI-107_Reports_SPICE_FinalReport.pdf"],
     "Fifty-two smoke points were found for ethylene, propane, propylene, and propylene/nitrogen ...",
     "Strongest sooting fuel in the SPICE set."),
    ("PSI-107", "methane", "fuel", "medium", False, 85, 75,
     ["PSI-107/Reports/PSI-107_Reports_SPICE_FinalReport.pdf"],
     "Smoke points were attempted with methane, but could not ...",
     "Attempted but smoke points were not obtained for all conditions."),

    # PSI-115
    ("PSI-115", "dbp", "test_material", "high", True, 90, 85,
     ["PSI-115/Reports/PSI-115_Reports_NNX17AF08A_FinalReport.pdf"],
     "The formation and growth of dibutyl-phthalate (DBP) particles in Earth gravity and microgravity environments were simulated.",
     "Numerical simulation of SAME smoke; DBP is the modeled smoke source."),
    ("PSI-115", "smoke_aerosol", "combustion_product", "high", False, 85, 80,
     ["PSI-115/Reports/PSI-115_Reports_NNX17AF08A_FinalReport.pdf"],
     "The intention of this effort is to quantify the differences between microgravity and Earth gravity smoke ...",
     "Focus is smoke particle growth, not a new material."),

    # PSI-117
    ("PSI-117", "methanol", "fuel", "medium", True, 75, 70,
     ["PSI-117/Reports/PSI-117_Reports_Dissertation_Combustion Behavior Of Sub-Millimeter Sized Oxygenated And N-Alka.pdf"],
     "Methanol was used as model fuel",
     "FLEX-derived model study; methanol is one of the oxygenated reference fuels."),
    ("PSI-117", "ethanol", "fuel", "medium", True, 75, 70,
     ["PSI-117/Reports/PSI-117_Reports_Dissertation_Combustion Behavior Of Sub-Millimeter Sized Oxygenated And N-Alka.pdf"],
     "methanol, ethanol, and n-Butanol droplet combustion",
     "FLEX-derived model study; ethanol is one of the oxygenated reference fuels."),
    ("PSI-117", "n_heptane", "fuel", "medium", True, 75, 70,
     ["PSI-117/Reports/PSI-117_Reports_Dissertation_Combustion Behavior Of Sub-Millimeter Sized Oxygenated And N-Alka.pdf"],
     "n-heptane and n-decane",
     "FLEX-derived n-alkane model fuel."),
    ("PSI-117", "n_decane", "fuel", "medium", False, 70, 65,
     ["PSI-117/Reports/PSI-117_Reports_Dissertation_Combustion Behavior Of Sub-Millimeter Sized Oxygenated And N-Alka.pdf"],
     "n-heptane and n-decane",
     "n-Alkane reference fuel in the dissertation."),
    ("PSI-117", "n_octane", "fuel", "medium", False, 70, 65,
     ["PSI-117/Reports/PSI-117_Reports_Dissertation_Combustion Behavior Of Sub-Millimeter Sized Oxygenated And N-Alka.pdf"],
     "n-heptane, n-octane, and n-decane",
     "n-Alkane reference fuel in the dissertation."),
    ("PSI-117", "n_dodecane", "fuel", "low", False, 65, 60,
     ["PSI-117/Reports/PSI-117_Reports_Dissertation_Combustion Behavior Of Sub-Millimeter Sized Oxygenated And N-Alka.pdf"],
     "higher molecular weight straight chain alkanes e.g. n-dodecane",
     "Mentioned as a large n-alkane; not the main test fuel."),

    # PSI-142
    ("PSI-142", "n_heptane", "fuel", "high", True, 85, 80,
     ["PSI-142/Analyzed Data/Modeling Data/PSI-142_Analyzed Data_PSI data summary Princeton with links.xlsx"],
     "nC7",
     "n-Heptane is represented by the nC7 dataset in the PSI data summary."),
    ("PSI-142", "n_dodecane", "fuel", "high", True, 85, 80,
     ["PSI-142/Analyzed Data/Modeling Data/PSI-142_Analyzed Data_PSI data summary Princeton with links.xlsx"],
     "nC12",
     "n-Alkane dataset in the PSI data summary."),
    ("PSI-142", "n_tetradecane", "fuel", "high", False, 85, 80,
     ["PSI-142/Analyzed Data/Modeling Data/PSI-142_Analyzed Data_PSI data summary Princeton with links.xlsx"],
     "nC14",
     "n-Alkane dataset in the PSI data summary."),
    ("PSI-142", "n_decane", "fuel", "high", False, 85, 80,
     ["PSI-142/Analyzed Data/Modeling Data/PSI-142_Analyzed Data_PSI data summary Princeton with links.xlsx"],
     "nC10",
     "n-Alkane dataset in the PSI data summary."),
    ("PSI-142", "n_octane", "fuel", "high", False, 85, 80,
     ["PSI-142/Analyzed Data/Modeling Data/PSI-142_Analyzed Data_PSI data summary Princeton with links.xlsx"],
     "nC8",
     "n-Alkane dataset in the PSI data summary."),
    ("PSI-142", "dimethyl_ether", "fuel", "medium", False, 70, 65,
     [],
     "one dimensional freely-propagating dimethyl ether (DME) flames",
     "DME/air cool-flame modeling. Evidence is the investigations.approach text in the lunatika DB; no matching local file."),
    ("PSI-142", "ozone", "additive", "high", False, 85, 80,
     ["PSI-142/Analyzed Data/Modeling Data/PSI-142_Analyzed Data_PSI data summary Princeton with links.xlsx"],
     "cool diffusion flame extinction limits, with ozone",
     "Ozone is an experimental sensitizer, not a fuel."),

    # PSI-159 CFI-G
    ("PSI-159", "ethane", "fuel", "high", True, 95, 90,
     ["PSI-159/Reports/PSI-159_Reports_FinalRpt_ACME.CFI-G.pdf",
      "PSI-159/Raw Data/Reduced Gravity/1_normal_flames_ethane"],
     "testing was instead conducted with ethane as an alternate",
     "Substituted for n-pentane; normal and inverse cool flames."),
    ("PSI-159", "propane", "fuel", "high", True, 95, 90,
     ["PSI-159/Reports/PSI-159_Reports_FinalRpt_ACME.CFI-G.pdf",
      "PSI-159/Raw Data/Reduced Gravity/2_normal_flames_propane"],
     "Cool diffusion flames burning propane, n-butane, and n-pentane",
     "Primary CFI-G fuel."),
    ("PSI-159", "n_butane", "fuel", "high", True, 95, 90,
     ["PSI-159/Reports/PSI-159_Reports_FinalRpt_ACME.CFI-G.pdf",
      "PSI-159/Raw Data/Reduced Gravity/3_normal_flames_n-butane"],
     "Cool diffusion flames burning propane, n-butane, and n-pentane",
     "Primary CFI-G fuel; normal and inverse flames."),
    ("PSI-159", "n_pentane", "planned_not_tested", "high", False, 85, 60,
     ["PSI-159/Reports/PSI-159_Reports_FinalRpt_ACME.CFI-G.pdf"],
     "testing was instead conducted with ethane as an alternate",
     "Planned but not tested because of low vapor pressure."),

    # PSI-20 BRE
    ("PSI-20", "ethylene", "fuel", "high", True, 95, 85,
     ["PSI-20/Reports/PSI-20_Reports_Final_20220201.pdf",
      "PSI-20/Raw Data/Reduced Gravity/25-mm burner_100% ethylene"],
     "100% ethylene",
     "Primary BRE fuel."),
    ("PSI-20", "methane", "fuel", "high", True, 95, 85,
     ["PSI-20/Reports/PSI-20_Reports_Final_20220201.pdf"],
     "CH4/N2 and C2H4/N2 mixtures on porous circular burners",
     "Primary BRE fuel."),
    ("PSI-20", "propane", "fuel", "medium", False, 85, 75,
     ["PSI-20/Reports/PSI-20_Reports_Final_20220201.pdf"],
     "propane and propylene to emulate additional condensed fuels",
     "Used to emulate other condensed fuels."),
    ("PSI-20", "propylene", "fuel", "medium", False, 85, 75,
     ["PSI-20/Reports/PSI-20_Reports_Final_20220201.pdf"],
     "propane and propylene to emulate additional condensed fuels",
     "Used to emulate other condensed fuels."),
    ("PSI-20", "pmma_acrylic", "emulated_material", "medium", False, 80, 65,
     ["PSI-20/Reports/PSI-20_Reports_Final_20220201.pdf"],
     "could represent PMMA as a material solid.",
     "BRE emulates the burning rate of solid PMMA with a gas burner; PMMA is not the actual sample."),

    # PSI-21 CLD
    ("PSI-21", "methane", "fuel", "high", True, 95, 90,
     ["PSI-21/Raw Data/Legacy/2022 - ACME CLD Flame Final Report (2022)/CLD_Flame_final_report_20220330.pdf",
      "PSI-21/Raw Data/Legacy/Methane, dilute (0-40%)"],
     "highly diluted and sooting methane coflow flames",
     "Primary CLD fuel; dilution series."),
    ("PSI-21", "ethylene", "fuel", "high", True, 95, 90,
     ["PSI-21/Raw Data/Legacy/2022 - ACME CLD Flame Final Report (2022)/CLD_Flame_final_report_20220330.pdf",
      "PSI-21/Raw Data/Legacy/Ethylene (100% C2H4)"],
     "dilution limits of coflow laminar methane and ethylene flames",
     "Primary CLD fuel."),

    # PSI-22 E-FIELD
    ("PSI-22", "methane", "fuel", "high", True, 95, 90,
     ["PSI-22/Reports/PSI-22_Reports_E-FIELD Flames Final Report.pdf"],
     "total fuel (methane and ethylene) flow rate",
     "Primary E-FIELD fuel."),
    ("PSI-22", "ethylene", "fuel", "high", True, 95, 90,
     ["PSI-22/Reports/PSI-22_Reports_E-FIELD Flames Final Report.pdf"],
     "total fuel (methane and ethylene) flow rate",
     "Primary E-FIELD fuel."),

    # PSI-23 s-Flame
    ("PSI-23", "methane", "fuel", "high", True, 95, 90,
     ["PSI-23/Reports/PSI-23_Reports_s_Flame_final_report_20210729.pdf"],
     "Conventional gaseous fuels including hydrogen, methane, and ethylene are used.",
     "Primary s-Flame fuel."),
    ("PSI-23", "ethylene", "fuel", "high", True, 95, 90,
     ["PSI-23/Reports/PSI-23_Reports_s_Flame_final_report_20210729.pdf"],
     "Conventional gaseous fuels including hydrogen, methane, and ethylene are used.",
     "Primary s-Flame fuel."),

    # PSI-25 BASS-II
    ("PSI-25", "pmma_acrylic", "test_material", "high", True, 95, 90,
     ["PSI-25/Reports/PSI-25_Reports_BASS-II Summary Report.pdf"],
     "A number of sample geometries were used in BASS-II: cast polymethylmethacrylate (PMMA) samples were shaped as rods ... thin to thick slabs ... or a section of a 4-cm-diameter sphere.",
     "Main solid fuel; rods, slabs and spheres."),
    ("PSI-25", "sibal_fabric", "test_material", "high", True, 95, 90,
     ["PSI-25/Reports/PSI-25_Reports_BASS-II Summary Report.pdf",
      "PSI-25/Science Documents/PSI-25_Science Documents_BASS-II_Test.Matrices.xlsx"],
     "flat cotton-fiberglass blended fabric samples were also burned",
     "Concurrent and opposed flame spread over fabric."),
    ("PSI-25", "cotton", "constituent", "high", False, 85, 80,
     ["PSI-25/Reports/PSI-25_Reports_BASS-II Summary Report.pdf"],
     "cotton-fiberglass blended fabric",
     "Combustible constituent of SIBAL."),
    ("PSI-25", "fiberglass", "constituent", "high", False, 85, 80,
     ["PSI-25/Reports/PSI-25_Reports_BASS-II Summary Report.pdf"],
     "cotton-fiberglass blended fabric",
     "Noncombustible reinforcement."),
    ("PSI-25", "nomex_aramid", "test_material", "medium", False, 85, 75,
     ["PSI-25/Reports/PSI-25_Reports_BASS-II Summary Report.pdf"],
     "3.1 Nomex® Flammability",
     "Nomex flammability is a dedicated section of the BASS-II report."),

    # PSI-26 BASS
    ("PSI-26", "sibal_fabric", "test_material", "high", True, 95, 90,
     ["PSI-26/Science Documents/PSI-26_Science Documents_SRD_BASS.pdf",
      "PSI-26/Presentations/PSI-26_Presentations_FlammabilityAspectsofCottonFiberglassFabric_ASGSR2012.pdf"],
     "The cotton-fiberglass fabric blend SIBAL1 fuel is our leading ...",
     "Primary BASS solid fuel."),
    ("PSI-26", "nomex_aramid", "test_material", "high", True, 95, 90,
     ["PSI-26/Science Documents/PSI-26_Science Documents_SRD_BASS.pdf",
      "PSI-26/Presentations/PSI-26_Presentations_BASS_Overview of Recent ISS Results.pdf"],
     "Nomex III (Blend) ... WSTF Nomex Natural (HT90-40)",
     "Nomex variants tested in BASS."),
    ("PSI-26", "ultem_pei", "test_material", "high", True, 95, 90,
     ["PSI-26/Science Documents/PSI-26_Science Documents_SRD_BASS.pdf",
      "PSI-26/Presentations/PSI-26_Presentations_BASS_Overview of Recent ISS Results.pdf"],
     "Ultem® 1000 C37H24O6N2",
     "Ultem rods tested; did not sustain burning in ISS atmosphere."),
    ("PSI-26", "pmma_acrylic", "test_material", "high", True, 95, 90,
     ["PSI-26/Science Documents/PSI-26_Science Documents_SRD_BASS.pdf",
      "PSI-26/Presentations/PSI-26_Presentations_BASS_Overview of Recent ISS Results.pdf"],
     "PMMA Sphere 1 and 2-cm width ... 1 and 2-cm PMMA",
     "PMMA spheres, rods and slabs."),
    ("PSI-26", "paraffin_wax", "test_material", "medium", False, 85, 80,
     ["PSI-26/Science Documents/PSI-26_Science Documents_SRD_BASS.pdf"],
     "A flat slab of fiberglass fabric saturated with wax",
     "Wax-saturated fiberglass sample."),
    ("PSI-26", "japan_wax", "test_material", "medium", False, 85, 80,
     ["PSI-26/Science Documents/PSI-26_Science Documents_SRD_BASS.pdf"],
     "Candle (Japan wax) within tube",
     "Candle-flame tests."),
    ("PSI-26", "cotton", "constituent", "high", False, 85, 80,
     ["PSI-26/Presentations/PSI-26_Presentations_FlammabilityAspectsofCottonFiberglassFabric_ASGSR2012.pdf"],
     "25% fiberglass, 75% cotton blend",
     "Combustible constituent of SIBAL."),
    ("PSI-26", "fiberglass", "constituent", "high", False, 85, 80,
     ["PSI-26/Presentations/PSI-26_Presentations_FlammabilityAspectsofCottonFiberglassFabric_ASGSR2012.pdf"],
     "25% fiberglass, 75% cotton blend",
     "Noncombustible reinforcement."),

    # PSI-39 CFI
    ("PSI-39", "n_dodecane", "fuel", "high", True, 95, 90,
     ["PSI-39/Reports/PSI-39_Reports_CFI Science Final Report.pdf",
      "PSI-39/Raw Data/Reduced Gravity/CFI – DODECANE"],
     "Examine the cool flame combustion behavior of n-dodecane, n-dodecane/iso-dodecane fuel mixtures, and farnesane fuels over a rage of pressure from 0.25 atm to 5 atm.",
     "Primary CFI fuel."),
    ("PSI-39", "iso_dodecane", "fuel", "high", True, 95, 90,
     ["PSI-39/Reports/PSI-39_Reports_CFI Science Final Report.pdf",
      "PSI-39/Raw Data/Reduced Gravity/CFI - DODECANE (75) ISODODECANE (25)"],
     "n-dodecane/iso-dodecane fuel mixtures",
     "Blend component; 60/40 and 75/25 mixtures."),
    ("PSI-39", "farnesane", "fuel", "high", True, 95, 90,
     ["PSI-39/Reports/PSI-39_Reports_CFI Science Final Report.pdf",
      "PSI-39/Raw Data/Reduced Gravity/CFI - FARNESANE"],
     "farnesane",
     "Branched C15 fuel; extends cool-flame data."),

    # PSI-47 DAFT
    ("PSI-47", "arizona_road_dust", "test_aerosol", "high", True, 90, 85,
     ["PSI-47/Reports/PSI-47_Reports_DAFT_30Day.PostFlightReport.pdf"],
     "it was proposed to use Arizona Road Dust (ARD, Fine) instead, in combination with ISS GN2 to create an aerosol",
     "Instrument-validation aerosol, not a combustion fuel."),

    # PSI-60 (metadata only)
    ("PSI-60", "methane", "fuel", "medium", False, 55, 40,
     [],
     "SPICE smoke-point data set",
     "No local files in PSI-TEXT-FILES_1_1; linked from investigation metadata. SPICE fuel set."),
    ("PSI-60", "ethylene", "fuel", "medium", False, 55, 40,
     [],
     "SPICE smoke-point data set",
     "No local files; linked from investigation metadata. SPICE fuel set."),
    ("PSI-60", "propane", "fuel", "medium", False, 55, 40,
     [],
     "SPICE smoke-point data set",
     "No local files; linked from investigation metadata. SPICE fuel set."),
    ("PSI-60", "propylene", "fuel", "medium", False, 55, 40,
     [],
     "SPICE smoke-point data set",
     "No local files; linked from investigation metadata. SPICE fuel set."),
    ("PSI-60", "soot", "combustion_product", "medium", False, 55, 40,
     [],
     "soot formation in 1g and 0g flames",
     "No local files; linked from investigation metadata."),

    # PSI-62 (metadata only)
    ("PSI-62", "pmma_acrylic", "test_material", "medium", True, 55, 40,
     [],
     "flat sheets, spheres, and rod-shaped polymethyl methacrylate (PMMA) samples",
     "No local files; linked from investigation metadata. BASS/BASS-II benchmark."),
    ("PSI-62", "paraffin_wax", "test_material", "medium", False, 55, 40,
     [],
     "wax cylinders",
     "No local files; linked from investigation metadata."),
    ("PSI-62", "sibal_fabric", "test_material", "medium", False, 55, 40,
     [],
     "BASS and BASS-II experiments as benchmarks",
     "No local files; linked from investigation metadata. BASS fabric benchmark."),

    # PSI-68 FLEX-2
    ("PSI-68", "ethanol", "fuel", "high", True, 95, 90,
     ["PSI-68/Science Documents/PSI-68_Science Documents_FLEX-2 SRD Final.pdf",
      "PSI-68/Raw Data/Reduced Gravity/Binary Array 2014 - Ethanol"],
     "They focus on ethanol and decane as fuels, as well as various fuel mixtures",
     "Primary FLEX-2 fuel."),
    ("PSI-68", "n_decane", "fuel", "high", True, 95, 90,
     ["PSI-68/Science Documents/PSI-68_Science Documents_FLEX-2 SRD Final.pdf",
      "PSI-68/Raw Data/Reduced Gravity/Quiescent 2012 - Decane"],
     "They focus on ethanol and decane as fuels, as well as various fuel mixtures",
     "Primary FLEX-2 fuel."),
    ("PSI-68", "n_heptane", "fuel", "high", False, 90, 85,
     ["PSI-68/Science Documents/PSI-68_Science Documents_FLEX-2 SRD Final.pdf",
      "PSI-68/Raw Data/Reduced Gravity/SurrogateFuel 2013 - Heptane"],
     "n-heptane/iso-octane",
     "Surrogate-fuel test matrix."),
    ("PSI-68", "n_octane", "fuel", "high", False, 90, 85,
     ["PSI-68/Science Documents/PSI-68_Science Documents_FLEX-2 SRD Final.pdf",
      "PSI-68/Raw Data/Reduced Gravity/SurrogateFuel 2012 - N_Octane"],
     "heptane/octane mixture",
     "Surrogate-fuel test matrix."),
    ("PSI-68", "iso_octane", "fuel", "high", False, 90, 85,
     ["PSI-68/Science Documents/PSI-68_Science Documents_FLEX-2 SRD Final.pdf",
      "PSI-68/Raw Data/Reduced Gravity/SurrogateFuel 2014 - IsoOctane"],
     "n-heptane/iso-octane (2,2,4 trimethylpentane)",
     "Surrogate-fuel test matrix."),
    ("PSI-68", "toluene", "fuel", "high", False, 90, 85,
     ["PSI-68/Raw Data/Reduced Gravity/SurrogateFuel 2014 - Toluene"],
     "SurrogateFuel 2014 - Toluene",
     "Aromatic surrogate component; evidence quote is the raw-data folder name."),
    ("PSI-68", "propylbenzene", "fuel", "high", False, 90, 85,
     ["PSI-68/Science Documents/PSI-68_Science Documents_FLEX-2 SRD Final.pdf",
      "PSI-68/Raw Data/Reduced Gravity/SurrogateFuel 2012 - Propylbenzene"],
     "n-decane/n-propylbenzene",
     "Aromatic surrogate component."),
    ("PSI-68", "n_propanol", "fuel", "high", False, 90, 85,
     ["PSI-68/Science Documents/PSI-68_Science Documents_FLEX-2 SRD Final.pdf",
      "PSI-68/Raw Data/Reduced Gravity/95% Propanol, 5% Glycerol"],
     "1-propanol/glycerol",
     "Condensed-phase test mixture."),
    ("PSI-68", "glycerol", "fuel", "high", False, 90, 85,
     ["PSI-68/Science Documents/PSI-68_Science Documents_FLEX-2 SRD Final.pdf",
      "PSI-68/Raw Data/Reduced Gravity/95% Propanol, 5% Glycerol"],
     "1-propanol/glycerol",
     "Condensed-phase additive."),
    ("PSI-68", "methanol", "fuel", "medium", False, 80, 70,
     ["PSI-68/Science Documents/PSI-68_Science Documents_FLEX-2 SRD Final.pdf"],
     "methanol, for example, in increased-oxygen atmospheres",
     "Reference/comparison fuel in the SRD; not the primary FLEX-2 fuel."),
    ("PSI-68", "n_hexadecane", "fuel", "medium", False, 80, 70,
     ["PSI-68/Science Documents/PSI-68_Science Documents_FLEX-2 SRD Final.pdf"],
     "heptane-hexadecane mixture droplets",
     "Bi-component droplet reference."),

    # PSI-69 FLEX
    ("PSI-69", "n_heptane", "fuel", "high", True, 95, 90,
     ["PSI-69/Science Documents/PSI-69_Science Documents_FLEX_Test_Plan.pdf",
      "PSI-69/Raw Data/Reduced Gravity/Heptane"],
     "the LOI as a function of pressure for heptane and methanol",
     "Primary FLEX fuel."),
    ("PSI-69", "methanol", "fuel", "high", True, 95, 90,
     ["PSI-69/Science Documents/PSI-69_Science Documents_FLEX_Test_Plan.pdf",
      "PSI-69/Raw Data/Reduced Gravity/MeOH"],
     "the LOI as a function of pressure for heptane and methanol",
     "Primary FLEX fuel."),
    ("PSI-69", "carbon_dioxide", "suppressant", "high", False, 90, 85,
     ["PSI-69/Science Documents/PSI-69_Science Documents_FLEX_Test_Plan.pdf"],
     "CO2 , He and SF6 . The tests use the two test fuels, are over a range of pressures, oxygen mole",
     "Suppressant tested in FLEX. Quote spacing reflects PDF subscript extraction."),
    ("PSI-69", "helium", "suppressant", "high", False, 90, 85,
     ["PSI-69/Science Documents/PSI-69_Science Documents_FLEX_Test_Plan.pdf"],
     "CO2 , He and SF6 . The tests use the two test fuels, are over a range of pressures, oxygen mole",
     "Suppressant tested in FLEX. Quote spacing reflects PDF subscript extraction."),
    ("PSI-69", "sulfur_hexafluoride", "suppressant", "high", False, 90, 85,
     ["PSI-69/Science Documents/PSI-69_Science Documents_FLEX_Test_Plan.pdf"],
     "CO2 , He and SF6 . The tests use the two test fuels, are over a range of pressures, oxygen mole",
     "Suppressant tested in FLEX. Quote spacing reflects PDF subscript extraction."),

    # PSI-98 SAFFIRE-I
    ("PSI-98", "sibal_fabric", "test_material", "high", True, 95, 90,
     ["PSI-98/Science Documents/PSI-98_Science Documents_SAFFIRE Objectives, Development and Status.pdf",
      "PSI-98/Science Documents/PSI-98_Science Documents_SAFFIRE-I and SAFFIRE-III Readme.docx"],
     "The sample material for SAFFIRE-I and SAFFIRE-III is a composite fabric consisting of cotton on a fiberglass substrate (75% cotton, 25% fiberglass by weight).",
     "Large-scale fire growth at 20 cm/s airflow."),
    ("PSI-98", "cotton", "constituent", "high", False, 85, 80,
     ["PSI-98/Science Documents/PSI-98_Science Documents_SAFFIRE Objectives, Development and Status.pdf"],
     "75% cotton, 25% fiberglass by weight",
     "Combustible constituent of SIBAL."),
    ("PSI-98", "fiberglass", "constituent", "high", False, 85, 80,
     ["PSI-98/Science Documents/PSI-98_Science Documents_SAFFIRE Objectives, Development and Status.pdf"],
     "75% cotton, 25% fiberglass by weight",
     "Noncombustible reinforcement."),

    # PSI-99 SAFFIRE-II
    ("PSI-99", "sibal_fabric", "test_material", "high", True, 95, 90,
     ["PSI-99/Science Documents/PSI-99_Science Documents_SAFFIRE Objectives, Development and Status.pdf",
      "PSI-99/Science Documents/PSI-99_Science Documents_SAFFIRE-II Readme.docx"],
     "SIBAL fabric 0.33 mm",
     "SAFFIRE-II sample card includes SIBAL fabric."),
    ("PSI-99", "cotton", "constituent", "high", False, 85, 80,
     ["PSI-99/Science Documents/PSI-99_Science Documents_SAFFIRE Objectives, Development and Status.pdf"],
     "75% cotton, 25% fiberglass by weight",
     "Combustible constituent of SIBAL."),
    ("PSI-99", "fiberglass", "constituent", "high", False, 85, 80,
     ["PSI-99/Science Documents/PSI-99_Science Documents_SAFFIRE Objectives, Development and Status.pdf"],
     "75% cotton, 25% fiberglass by weight",
     "Noncombustible reinforcement."),
    ("PSI-99", "silicone_rubber", "test_material", "high", True, 95, 90,
     ["PSI-99/Science Documents/PSI-99_Science Documents_SAFFIRE Objectives, Development and Status.pdf"],
     "S1 Silicone 0.25 mm ... S4 Silicone 0.36 mm",
     "Five silicone samples of different thickness."),
    ("PSI-99", "pmma_acrylic", "test_material", "high", True, 95, 90,
     ["PSI-99/Science Documents/PSI-99_Science Documents_SAFFIRE Objectives, Development and Status.pdf"],
     "S9 Flat PMMA tapered edge 30 Upstream",
     "Flat PMMA sample."),
    ("PSI-99", "nomex_aramid", "test_material", "high", True, 95, 90,
     ["PSI-99/Science Documents/PSI-99_Science Documents_SAFFIRE Objectives, Development and Status.pdf"],
     "Nomex",
     "Nomex sample on the SAFFIRE-II card."),
]

# ---------------------------------------------------------------------------
# 3. Topic groups for query routing
# ---------------------------------------------------------------------------
TOPICS = [
    {
        "id": "solid_polymer_flammability",
        "name": "Solid polymer / fabric flammability",
        "description": "Ignition, flame spread, extinction and flammability limits of solid spacecraft materials (polymers, fabrics, foams, composites).",
        "keywords": ["polymer", "plastic", "fabric", "cloth", "foam", "PMMA", "Teflon", "Kapton", "silicone", "SIBAL", "Nomex", "Ultem", "Pyrell", "flame spread", "flammability limit", "material screening"],
        "investigations": ["PSI-25", "PSI-26", "PSI-62", "PSI-98", "PSI-99", "PSI-100"],
    },
    {
        "id": "smoke_aerosol_detection",
        "name": "Smoke generation and fire detection",
        "description": "Smoke particle size, morphology, transport and detector response for microgravity fires.",
        "keywords": ["smoke", "aerosol", "particle", "detector", "detection", "P-Trak", "DustTrak", "SAME", "DAFT", "soot", "alarm"],
        "investigations": ["PSI-47", "PSI-101", "PSI-102", "PSI-115"],
    },
    {
        "id": "liquid_droplet_combustion",
        "name": "Liquid fuel droplet combustion and extinction",
        "description": "Droplet burning, cool flames, radiative extinction, limiting oxygen index and suppressant effectiveness for liquid fuels.",
        "keywords": ["droplet", "liquid fuel", "heptane", "dodecane", "decane", "ethanol", "methanol", "LOI", "extinction", "suppressant", "FLEX", "CFI"],
        "investigations": ["PSI-39", "PSI-68", "PSI-69", "PSI-117", "PSI-142"],
    },
    {
        "id": "gaseous_diffusion_flames",
        "name": "Gaseous diffusion flames, soot and flame structure",
        "description": "Laminar gas-jet and coflow flames, flame stability, soot formation, smoke point and electric-field effects.",
        "keywords": ["gas", "methane", "ethylene", "propane", "propylene", "soot", "smoke point", "flame structure", "liftoff", "coflow", "electric field", "ACME", "SPICE", "SLICE"],
        "investigations": ["PSI-10", "PSI-20", "PSI-21", "PSI-22", "PSI-23", "PSI-106", "PSI-107", "PSI-159", "PSI-60"],
    },
    {
        "id": "fire_growth_suppression",
        "name": "Large-scale fire growth and suppression",
        "description": "Large-scale fire growth in low gravity, low-g flammability limits and suppression / extinguishment.",
        "keywords": ["fire growth", "large scale", "suppression", "extinguishment", "SAFFIRE", "BASS", "oxygen limit", "CO2", "helium", "SF6"],
        "investigations": ["PSI-25", "PSI-26", "PSI-98", "PSI-99", "PSI-100"],
    },
    {
        "id": "cool_flames",
        "name": "Cool flames and low-temperature combustion",
        "description": "Cool diffusion flames, warm flames, oscillatory and extinction behavior at low temperature.",
        "keywords": ["cool flame", "warm flame", "low temperature", "ozone", "DME", "CFI", "FLEX", "oscillation", "extinction"],
        "investigations": ["PSI-39", "PSI-117", "PSI-142", "PSI-159"],
    },
    {
        "id": "electric_field_effects",
        "name": "Electric-field effects on flames",
        "description": "How electric fields alter flame shape, stability, soot and chemi-ion currents in microgravity.",
        "keywords": ["electric field", "voltage", "ion current", "chemi-ion", "E-FIELD", "ACME"],
        "investigations": ["PSI-22"],
    },
    {
        "id": "modeling_and_simulation",
        "name": "Modeling, simulation and data reuse",
        "description": "Ground-based modeling and re-analysis of PSI data: soot, flame spread, cool flames and smoke.",
        "keywords": ["model", "simulation", "CFD", "FGM", "soot model", "radiation", "data reuse", "PSI data"],
        "investigations": ["PSI-60", "PSI-62", "PSI-115", "PSI-117", "PSI-142"],
    },
]


# ---------------------------------------------------------------------------
# 4. Writers
# ---------------------------------------------------------------------------
def material_rows():
    for m in MATERIALS:
        yield {
            "id": m["id"],
            "canonical_name": m["canonical_name"],
            "category": m["category"],
            "phase": m["phase"],
            "chemical_formula": m["chemical_formula"],
            "aliases": m["aliases"],
            "spacecraft_relevance": m["spacecraft_relevance"],
            "fire_safety_notes": m["fire_safety_notes"],
            "is_fuel": m["is_fuel"],
        }


def link_rows():
    for (inv, mat, role, conf, primary, eq, dc, files, quote, notes) in LINKS:
        assert mat in MATERIAL_INDEX, f"unknown material {mat}"
        yield {
            "investigation_id": inv,
            "material_id": mat,
            "material_name": MATERIAL_INDEX[mat]["canonical_name"],
            "role": role,
            "confidence": conf,
            "is_primary": primary,
            "evidence_quality": eq,
            "data_completeness": dc,
            "evidence_files": files,
            "evidence_quote": quote,
            "notes": notes,
        }


def write_json_csv():
    mrows = list(material_rows())
    lrows = list(link_rows())

    (DATA / "materials.json").write_text(json.dumps(mrows, ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA / "investigation_materials.json").write_text(json.dumps(lrows, ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA / "investigation_topics.json").write_text(json.dumps(TOPICS, ensure_ascii=False, indent=2), encoding="utf-8")

    with (DATA / "materials.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(mrows[0].keys()))
        w.writeheader()
        for r in mrows:
            r = dict(r)
            r["aliases"] = "; ".join(r["aliases"])
            w.writerow(r)

    with (DATA / "investigation_materials.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(lrows[0].keys()))
        w.writeheader()
        for r in lrows:
            r = dict(r)
            r["evidence_files"] = "; ".join(r["evidence_files"])
            w.writerow(r)


def q(value):
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def jsonb(value):
    return q(json.dumps(value, ensure_ascii=False)) + "::jsonb"


def text_array(values):
    if not values:
        return "'{}'::text[]"
    return "ARRAY[" + ", ".join(q(v) for v in values) + "]::text[]"


SCHEMA = r"""
-- Material <-> PSI investigation link layer.
-- Run with: psql -U postgres -h 127.0.0.1 -d lunatika -f sql/01_schema_materials.sql
BEGIN;

DROP VIEW IF EXISTS v_investigation_material_summary, v_material_investigations, v_topic_investigations CASCADE;
DROP TABLE IF EXISTS investigation_topic_links CASCADE;
DROP TABLE IF EXISTS investigation_topics CASCADE;
DROP TABLE IF EXISTS investigation_materials CASCADE;
DROP TABLE IF EXISTS materials CASCADE;

CREATE TABLE materials (
    id                  text PRIMARY KEY,
    canonical_name      text NOT NULL,
    category            text NOT NULL,
    phase               text,
    chemical_formula    text,
    aliases             text[] NOT NULL DEFAULT '{}',
    spacecraft_relevance text,
    fire_safety_notes   text,
    is_fuel             boolean NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE investigation_materials (
    investigation_id  text NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    material_id       text NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    role              text NOT NULL CHECK (role IN (
                          'test_material', 'fuel', 'constituent', 'emulated_material',
                          'planned_not_tested', 'replaced_material', 'test_aerosol',
                          'combustion_product', 'suppressant', 'diluent', 'additive',
                          'reference_material')),
    confidence        text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
    is_primary        boolean NOT NULL DEFAULT false,
    evidence_quality  integer NOT NULL DEFAULT 0 CHECK (evidence_quality BETWEEN 0 AND 100),
    data_completeness integer NOT NULL DEFAULT 0 CHECK (data_completeness BETWEEN 0 AND 100),
    evidence_files    jsonb NOT NULL DEFAULT '[]'::jsonb,
    evidence_quote    text,
    notes             text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (investigation_id, material_id)
);

CREATE INDEX idx_investigation_materials_material ON investigation_materials(material_id);
CREATE INDEX idx_investigation_materials_role ON investigation_materials(role);
CREATE INDEX idx_investigation_materials_confidence ON investigation_materials(confidence);

CREATE TABLE investigation_topics (
    id          text PRIMARY KEY,
    name        text NOT NULL,
    description text,
    keywords    text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE investigation_topic_links (
    investigation_id text NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    topic_id         text NOT NULL REFERENCES investigation_topics(id) ON DELETE CASCADE,
    relevance        text NOT NULL DEFAULT 'primary' CHECK (relevance IN ('primary', 'secondary')),
    PRIMARY KEY (investigation_id, topic_id)
);

CREATE VIEW v_investigation_material_summary AS
SELECT
    i.id AS investigation_id,
    i.title,
    coalesce(
        jsonb_agg(
            jsonb_build_object(
                'material_id', m.id,
                'material', m.canonical_name,
                'category', m.category,
                'phase', m.phase,
                'role', im.role,
                'is_primary', im.is_primary,
                'confidence', im.confidence,
                'evidence_quality', im.evidence_quality,
                'data_completeness', im.data_completeness,
                'evidence_files', im.evidence_files,
                'evidence_quote', im.evidence_quote,
                'notes', im.notes
            ) ORDER BY im.is_primary DESC, im.evidence_quality DESC, m.canonical_name
        ) FILTER (WHERE m.id IS NOT NULL),
        '[]'::jsonb
    ) AS materials
FROM investigations i
LEFT JOIN investigation_materials im ON im.investigation_id = i.id
LEFT JOIN materials m ON m.id = im.material_id
GROUP BY i.id, i.title;

COMMIT;
"""


def write_sql():
    (SQL / "01_schema_materials.sql").write_text(SCHEMA, encoding="utf-8")

    lines = ["-- Seed the material taxonomy.", "BEGIN;", "TRUNCATE materials CASCADE;", ""]
    for m in MATERIALS:
        lines.append(
            "INSERT INTO materials (id, canonical_name, category, phase, chemical_formula, aliases, spacecraft_relevance, fire_safety_notes, is_fuel) VALUES ("
            + ", ".join([
                q(m["id"]), q(m["canonical_name"]), q(m["category"]), q(m["phase"]),
                q(m["chemical_formula"]), text_array(m["aliases"]),
                q(m["spacecraft_relevance"]), q(m["fire_safety_notes"]),
                "true" if m["is_fuel"] else "false",
            ])
            + ");"
        )
    lines += ["COMMIT;", ""]
    (SQL / "02_seed_materials.sql").write_text("\n".join(lines), encoding="utf-8")

    lines = ["-- Seed investigation <-> material links.", "BEGIN;", "TRUNCATE investigation_materials;", ""]
    for r in link_rows():
        lines.append(
            "INSERT INTO investigation_materials (investigation_id, material_id, role, confidence, is_primary, evidence_quality, data_completeness, evidence_files, evidence_quote, notes) VALUES ("
            + ", ".join([
                q(r["investigation_id"]), q(r["material_id"]), q(r["role"]), q(r["confidence"]),
                "true" if r["is_primary"] else "false",
                str(r["evidence_quality"]), str(r["data_completeness"]),
                jsonb(r["evidence_files"]), q(r["evidence_quote"]), q(r["notes"]),
            ])
            + ");"
        )
    lines += ["COMMIT;", ""]
    (SQL / "03_seed_investigation_materials.sql").write_text("\n".join(lines), encoding="utf-8")

    lines = ["-- Seed topic groups.", "BEGIN;", "TRUNCATE investigation_topic_links, investigation_topics;", ""]
    for t in TOPICS:
        lines.append(
            "INSERT INTO investigation_topics (id, name, description, keywords) VALUES ("
            + ", ".join([q(t["id"]), q(t["name"]), q(t["description"]), text_array(t["keywords"])])
            + ");"
        )
        for inv in t["investigations"]:
            lines.append(
                "INSERT INTO investigation_topic_links (investigation_id, topic_id, relevance) VALUES ("
                + ", ".join([q(inv), q(t["id"]), q("primary")])
                + ");"
            )
    lines += ["COMMIT;", ""]
    (SQL / "03b_seed_topics.sql").write_text("\n".join(lines), encoding="utf-8")

    views = r"""
-- Convenience views for the AI / dashboard layer.
BEGIN;

CREATE OR REPLACE VIEW v_investigation_material_summary AS
SELECT
    i.id AS investigation_id,
    i.title,
    coalesce(
        jsonb_agg(
            jsonb_build_object(
                'material_id', m.id,
                'material', m.canonical_name,
                'category', m.category,
                'phase', m.phase,
                'role', im.role,
                'is_primary', im.is_primary,
                'confidence', im.confidence,
                'evidence_quality', im.evidence_quality,
                'data_completeness', im.data_completeness,
                'evidence_files', im.evidence_files,
                'evidence_quote', im.evidence_quote,
                'notes', im.notes
            ) ORDER BY im.is_primary DESC, im.evidence_quality DESC, m.canonical_name
        ) FILTER (WHERE m.id IS NOT NULL),
        '[]'::jsonb
    ) AS materials
FROM investigations i
LEFT JOIN investigation_materials im ON im.investigation_id = i.id
LEFT JOIN materials m ON m.id = im.material_id
GROUP BY i.id, i.title;

CREATE OR REPLACE VIEW v_material_investigations AS
SELECT
    m.id AS material_id,
    m.canonical_name,
    m.category,
    m.phase,
    m.is_fuel,
    count(im.investigation_id) AS investigation_count,
    jsonb_agg(
        jsonb_build_object(
            'investigation_id', im.investigation_id,
            'title', i.title,
            'role', im.role,
            'is_primary', im.is_primary,
            'confidence', im.confidence,
            'evidence_quality', im.evidence_quality
        ) ORDER BY im.is_primary DESC, im.evidence_quality DESC
    ) FILTER (WHERE im.investigation_id IS NOT NULL) AS investigations
FROM materials m
LEFT JOIN investigation_materials im ON im.material_id = m.id
LEFT JOIN investigations i ON i.id = im.investigation_id
GROUP BY m.id, m.canonical_name, m.category, m.phase, m.is_fuel;

CREATE OR REPLACE VIEW v_topic_investigations AS
SELECT
    t.id AS topic_id,
    t.name,
    t.description,
    t.keywords,
    jsonb_agg(
        jsonb_build_object('investigation_id', i.id, 'title', i.title)
        ORDER BY i.id
    ) FILTER (WHERE i.id IS NOT NULL) AS investigations
FROM investigation_topics t
LEFT JOIN investigation_topic_links l ON l.topic_id = t.id
LEFT JOIN investigations i ON i.id = l.investigation_id
GROUP BY t.id, t.name, t.description, t.keywords;

COMMIT;
"""
    (SQL / "04_views_materials.sql").write_text(views, encoding="utf-8")


if __name__ == "__main__":
    write_json_csv()
    write_sql()
    print(f"materials: {len(MATERIALS)}")
    print(f"links: {len(LINKS)}")
    print(f"topics: {len(TOPICS)}")
    print(f"output: {DATA} and {SQL}")
