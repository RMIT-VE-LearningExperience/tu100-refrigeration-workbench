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

## UX iteration — 9 September 2026

Implemented persistent operation status and Run/Stop, valve undo, separate photo inspection and valve operation, a guided first run, responsive Configure/Inspect/Measure navigation, visible compact pressures on tablets/phones, fit-to-viewport photo sizing and mouse drag/scroll panning. Tube inspection now selects one of four phases and keeps its values together. The p–h chart has selectable points and a table of gauge/absolute pressure, temperature and enthalpy. Exercise readings are colocated and feedback identifies the incorrect calculation. Gauge coordinates are rounded for deterministic server/client rendering.

Added an optional Blender-built 3D component pilot: see `design/3d/README.md`. It is an illustrative inspection prototype, not the full measured unit and not connected to simulated valve operation. The original photograph remains the unit reference. Physical tube-to-photo mapping, verified pipe overlays, full-unit geometry, calibrated model changes and real tube videos remain future work requiring physical-unit evidence.

Browser QA has now been performed on the local iteration: guided valid run, tube selection, photo selection without changing run state, deliberate valve operation, invalid-state explanation, undo, exercise feedback, desktop/mobile/tablet layouts and rendered 3D pilot. This supersedes the earlier first-build note that browser QA had not been done. Physical device performance, assistive-technology certification and instructor validation are still outstanding.

## Simplified workspace

The latest interface replaces the three-column control panel with a dominant equipment view and one contextual inspector. Labels default off. Component selection exposes just its valve control and related temperatures. Three compact pressure readings remain in the inspector; all readings, operating setup and model details open on demand. One view selector replaces the tab bar. A compact header holds status, Run/Stop and the secondary menu.

First visit offers Explore freely or Guided practice. Guided steps appear inside the inspector, and calculation exercises appear only in that mode. Mobile uses a collapsible bottom inspector rather than stacked Configure/Inspect/Measure navigation. Circuit validity, undo, numerical model, offline assets and the optional 3D pilot are preserved.

## Interactive photo affordances

The reversing valves now have visible markers by default. Crowded 44px targets form a group marker that zooms into the area, then reveals individually selectable valves. Hover and keyboard focus reveal names; selection highlights the component without changing valve state. The first-use image instruction disappears after a successful component selection. The inspector offers Zoom to component for mapped valves, while Fit restores the whole unit. Labels reveals the remaining mapped valves; the component list remains available for all valves, including the unmapped LRB. Photo markers for observation tubes remain deferred until their positions are verified.

Browser checks cover desktop/mobile appearance, group expansion, keyboard focus transfer, selection without stopping the simulation, and component zoom. Marker grouping tests cover whole-unit and enlarged scales and target preservation.

## Highlighted guided tutorial

Start tutorial launches a seven-step walkthrough anchored to the real setup, Run button, HP1 photo marker, valve action, view selector, tube measurements and superheat/subcooling exercise. A live spotlight follows target position during scrolling, resizing and photo zoom. Instructions remain outside the target; mobile panel height leaves room for the coach. The guide waits for running state, HP1 selection, the Glass tubes view and correct checked answers. Back, Skip, Close and Escape are supported; exit returns focus to Start tutorial. A keyboard shortcut button moves focus to the required control. Loading the example resets the teaching circuit; backward navigation does not repeat that reset.

Browser checks completed the seven-step flow on desktop and at 390 × 844, including actual valve selection, view changes, answers and completion. The tutorial does not change the physical-model equations or claim real gas-flow measurement.

The final tutorial step now highlights the complete exercise, including its input fields and Check answers button. Inputs have explicit white backgrounds and each shows its numerical subtraction as a visible hint. Spotlight bounds respect scrolling containers, keeping the visible exercise bright on mobile. Verified correct-answer completion on desktop/mobile.
