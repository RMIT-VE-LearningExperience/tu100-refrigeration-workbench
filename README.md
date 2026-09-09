# TU-100 Refrigeration Workbench

Interactive RMIT TU-100 teaching prototype. React/TypeScript, static Vinext export, no application backend. Uses a cropped photograph of the actual Imperial TU-100, the supplied circuit drawing, 12 valve controls, all eight approved configurations, RUN/STOP, four refrigerant models, pressure gauges, temperature readouts, a learning exercise and offline caching.

Run `npm install`, then `npm run dev -- --hostname 127.0.0.1`. Run `npm test` and `npm run typecheck`; `npm run build` writes the static site to `dist/client`. Serve that directory over localhost or HTTPS. Offline use requires a successful first load and service-worker installation; direct file:// launch is not supported. No remote fonts or runtime property API calls are used.

## Model and validation

`lib/model.ts` contains the supplied gauge-pressure polynomials, exact valve patterns and provisional fixed operating offsets. R454C bubble temperature uses bounded inversion of the bubble-pressure polynomial at condenser pressure. It does not use the less accurate supplied inverse fit. Ambient domain 0–55°C follows from all pressure calls remaining inside −20–70°C. This is a mathematical range, not a physical operating rating.

`lib/properties.json` contains CoolProp 8.0.0 HEOS property data for R134a, R290 and R32 with IIR enthalpy reference, kPa absolute and kJ/kg. The p–h view interpolates ambient states at 0.5°C intervals and uses ideal isenthalpic throttling. Its suction line includes the assumed pressure drop and heat gain. Regenerate using `scripts/generate-properties.py` with CoolProp 8.0.0 installed. `tests/property-audit.json` records polynomial residuals at 181 points per fluid. Maximum absolute errors were 0.242 kPa (R134a), 0.304 kPa (R290), 2.109 kPa (R32). These validate property fits, not the complete physical model.

Six model tests exhaust all 4096 valve states, verify reference patterns, check a numerical fixture, sweep the operating domain, check output gating and bypasses, and compare R454C to official Chemours data. Tests are independent of rendering. The build and TypeScript checks validate code compilation. Browser interaction/visual QA and WebMCP contract testing have not been performed; no supported embedded browser was available. WebMCP tools are feature-detected and share app state.

## Current limits and next work

- Local-unit calibration and teaching-team acceptance remain outstanding. No live telemetry, startup/equalisation transients, faults, charge model, mass-flow model, compressor map or fan-speed simulation.
- R454C p–h plotting awaits validated mixture enthalpy data. Its pressure and temperature readouts work; feature availability is controlled in `SETTINGS.enableR454C`.
- The circuit tab displays the supplied cooling schematic and selected flow sequence; it is not a fully redrawn dynamically rerouted circuit.
- The photo hotspots cover visible mapped valves; all 12 controls, including the receiver bypass, are available in the valve panel. Exact labels and measurement locations still need a teacher walkthrough.
- Observation-tube operating videos and the optimised 3D reconstruction are not yet integrated. Do not mistake the photo view for a completed 3D model.
- Airflow is marked unvalidated instead of presenting the brief's tentative 6 L/min as a measurement.
- Alternative refrigerants are simulated comparisons, not statements of compatibility with this R134a trainer.
- Unit cooling/heating follows the valve pattern; there is no independent mode switch. Changing any valve stops the simulator.

## References

- Project brief, quick reference card, February 17 meeting notes and TU-100 emulator logic-MTA1 provided in the shared project folder.
- https://iconnecttraining.com/training-units/tu-100-basic-refrigeration-trainer/
- https://training.gov.au/training/details/UEERA0036
- https://coolprop.org/coolprop/HighLevelAPI.html
- https://www.opteon.com/en/-/media/files/opteon/o-xl20pt-si-xl20-pt-chart-si.pdf

Detailed implementation plan: `../TU100_DIGITAL_TWIN_PLAN.md` in the workspace.
