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
- All 12 valve controls have photo targets. Receiver labels were checked against the supplied close-ups: LRB is the left base valve, LRI is partly behind LRK in the front view, and LRK is frontmost. A separate receiver close-up makes all three selectable. Measurement locations and teaching-team acceptance still need a teacher walkthrough.
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

All mapped valve targets are available by default; Labels controls names independently. Crowded targets form a group marker that opens a closer view. The receiver group opens an alternate-angle photograph because LRI is obscured by LRK in the main image. Both photo markers and large labelled buttons select LRB, LRI or LRK without operating the valve. The inspector offers the receiver close-up for these three valves and photo zoom for other valves. Hover and keyboard focus reveal names; Fit restores the whole unit. Photo markers for observation tubes remain deferred until their positions are verified.

Receiver mapping evidence: supplied photos `0H5A3431.CR3` and `0H5A3442.CR3` clearly label all three handwheels. `public/assets/receiver-valves.jpg` is an unannotated crop of the camera JPEG from `0H5A3442.CR3` (original crop: x2900,y2600 to x4400,y3550). The left base target previously labelled LRI is corrected to LRB. The existing LRK target remains on the front handwheel; LRI is separately represented behind it and accessible in the close-up.

Browser checks cover desktop/mobile appearance, group expansion, keyboard focus transfer, selection without stopping the simulation, and component zoom. Marker grouping tests cover whole-unit and enlarged scales and target preservation.

## Highlighted guided tutorial

Start tutorial launches a seven-step walkthrough anchored to the real setup, Run button, HP1 photo marker, valve action, view selector, tube measurements and superheat/subcooling exercise. A live spotlight follows target position during scrolling, resizing and photo zoom. Instructions remain outside the target; mobile panel height leaves room for the coach. The guide waits for running state, HP1 selection, the Glass tubes view and correct checked answers. Back, Skip, Close and Escape are supported; exit returns focus to Start tutorial. A keyboard shortcut button moves focus to the required control. Loading the example resets the teaching circuit; backward navigation does not repeat that reset.

Browser checks completed the seven-step flow on desktop and at 390 × 844, including actual valve selection, view changes, answers and completion. The tutorial does not change the physical-model equations or claim real gas-flow measurement.

The final tutorial step now highlights the complete exercise, including its input fields and Check answers button. Inputs have explicit white backgrounds and each shows its numerical subtraction as a visible hint. Spotlight bounds respect scrolling containers, keeping the visible exercise bright on mobile. Verified correct-answer completion on desktop/mobile.


## Student activities (September 2026)

The default Learn workspace replaces the seven-step spotlight and welcome dialog. Its four-question cycle activity links the actual photo, component close-up, simplified cycle, phase/direction explanation and model readings through one selection. The first task identifies heat absorption. Feedback and the next action stay beside the question; mobile progression focuses and reveals the next question. Explore retains the complete equipment controls, tube illustration, circuit reference, p–h chart and optional 3D pilot.

Superheat and subcooling are independent activities in the Activity selector, with a visual temperature gap, one answer at a time, inline recovery and an optional worked example. They use the same fixed R134a/25°C cooling example. No equations, property data or supported valve patterns were changed. The phase indicator shows illustrative direction, not measured flow speed. The four main photo locations are visually identified; tube/pipe overlays remain deferred pending verification.

Cycle progress, activity selection and typed practice answers are stored locally on the device. A memory fallback retains progress during the page session if storage is unavailable. Returning to Learn does not silently operate the unit: a stopped or changed model displays Resume/Restore beside the task. Explore, restart and previous-question actions remain available. The old tutorial components and spotlight styling were removed.

Validation: 14 model/marker/observation/learning tests pass. Browser checks cover wrong/correct selections, Stop/change-selection/Resume, photo close-up, four-question completion, independent calculations including the reported 64 K error and worked-example recovery, and mobile question focus/reflow. Instructor review and a representative student trial remain outstanding.

## Student journey rebuild — 11 September 2026

The app now has three purpose-based sections: **Before class**, **At the unit** and **Simulate**. Preparation starts with a linked cycle/photo orientation, continues through component identification and reading-pair selection, and finishes with a practical handover. Superheat and subcooling include separate labelled arithmetic examples (8 K and 7 K), beyond the supported 5 K model examples. These are teaching values, not additional model states or assessment results.

At the unit opens without starting the example. Component, reference mode, selected practical task and calculation choice survive section changes within the current page session. Reloading returns to the default reference; learner answers and preparation position remain device-local. **Start fresh** clears the cycle progress and both saved temperature answers, including in-memory fallbacks. It is not an identity or class-record system.

The practical reference distinguishes outlet temperature from the pressure-derived saturation reference, with dew for superheat and bubble for subcooling. It describes logical measurement locations; exact physical probe locations remain unverified. The simulator labels calculated values and only shows the valve inspector beside equipment. The p–h graphic exposes state controls accessibly and the optional 3D assembly has a spatial learning prompt.

Four expert critic passes preceded rebuilding and four followed it, with screenshots in the parent project's `work/review-screenshots/`. Details and student-test protocol are in `WHOLE_APP_STUDENT_REVIEW.md` in the parent directory. These were agent expert reviews, not observed student testing or a WCAG conformance audit.

## Guided machine walkthrough — 14 September 2026

**Machine tutorial** in the header (shortened to **Tutorial** on small phones) starts a stopped R134a/25°C cooling example. Nine steps cover photo zoom and labels, inspecting HP1, finding LRB in the receiver close-up, virtual valve operation and Undo, supported configuration, Run, pressure/temperature readings, illustrated glass-tube phases, and Stop with a practical-class handoff. It supplements the existing Before class activities and At the unit reference.

Amber outlines identify the actual controls without a tutorial dimming layer. The guide sits in the workspace or inside the active dialog, keeping fields white and controls usable. Show the control opens/reveals the relevant target; Back, Skip and Exit remain available. Restore tutorial example recovers a changed configuration. During valve practice, Undo restores the tutorial baseline, including any additional valve changes. Skipped steps are disclosed at completion. The temperature explanation includes a direct Continue to glass tubes action. Tutorial progress is session-only; launching it deliberately resets the simulated operating example.

This is practice using the digital twin, not a validated physical startup or shutdown procedure. Students follow their teacher’s procedure on the real machine. Equations and supported valve configurations are unchanged.

Validation: 18 automated tests and TypeScript pass; complete desktop and 390×844 walkthroughs, 320px layout, receiver selection, multiple-valve Undo, wrong-dialog recovery, stopped-model recovery, keyboard Done/Escape, skip-all and practical handoff checked in Chrome. Screenshots and reviewer findings are in `../work/machine-tutorial-review/`. New tutorial files pass lint; the repository-wide lint command still reports existing issues in older components/tests. Instructor acceptance and observed student testing remain outstanding.
