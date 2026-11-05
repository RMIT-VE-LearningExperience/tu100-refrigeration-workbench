# viz3d topic file: TU-100 refrigeration trainer, 3D twin

Your folder: `web/` (this repository, branch `v2-viz3d`). Dev server port 3000 (`npm run dev -- --hostname 127.0.0.1`).

Shape: lesson app inside the existing teaching workbench. The subject is how one real object works: the RMIT Imperial TU-100 basic refrigeration training unit. The 3D view replaces the photo as the main Simulate view; the photo, glass-tube illustration, circuit drawing and p–h chart stay as reference views.

Look: clean ops world (`references/looks.md`), with the project's green `#176749` as the single accent in place of teal, because the surrounding app already uses it. Pale cool greys for ground and backdrop, matte white and light-grey shells, colour kept for state and for the refrigerant phase in the flow overlay. Three themes switched by one quiet button: Workshop (the look), Night and Blueprint.

## The real parts

Modelled from `refs/tu100-unit.md` (dimensions marked "verify" where only the manufacturer's US figures exist). A white HDPE panel on a bench-height stand. Two finned copper coils with U-bends on both sides, each with a black drip tray below it (physical labels EVAPORATOR on the upper tray, CONDENSER on the lower). Four horizontal glass observation tubes with brass tie-bolt ends: above and below each coil. Twelve red hand valves: HP1 to HP4 in a two-by-two block, CTV/AXV/TXV under the metering devices, ACI/ACO/ACB around the accumulator, and LRB/LRI/LRK at bench level in front of the receiver. A thermostatic expansion valve with its sensing bulb on the insulated suction line, an automatic expansion valve, a capillary coil, a filter-dryer with a sight glass, three pressure gauges, a receiver and an accumulator (black cylinders), a hermetic compressor on the bench, a dual pressure switch, a fan-speed control box and a thermostat. Copper pipework with brass fittings stands off the panel on two depth layers.

## What moves or changes

- Handwheels turn when a valve is opened or closed in the inspector; the valve's state label changes.
- The flow overlay (off by default, one toggle) shows refrigerant as moving particles along the real route for the active configuration: discharge vapour, liquid, mixture after the metering device, suction vapour, each a different colour and speed band. Direction is illustrative, never a measured velocity. Heating reverses the coil roles and the particles follow the other reversing valves.
- Gauge needles follow the model's condenser, evaporator and suction pressures. All numbers come from `lib/model.ts`; nothing is typed in.
- Coil fans spin while the example runs (speed is not modelled; the spin is a running indicator only).
- Selecting a component ring-highlights it and opens the existing inspector or a reading card.

## Stages (number keys 1 to 9, stage bar, Tour)

1. Whole unit. 2. Compressor. 3. Reversing valves HP1 to HP4. 4. Condenser coil (lower in cooling). 5. Receiver and its three valves. 6. Metering: TXV, AXV, capillary and CTV. 7. Evaporator coil (upper in cooling). 8. Accumulator and ACI/ACO/ACB. 9. Gauges and readings.

Each stage has a camera preset framed so the part fills about a quarter of the frame from the side its moving part is seen from. The tour holds each stage for a few seconds; any drag or click stops it.

## Data

The existing steady-state model: eight valid valve configurations, four refrigerants, ambient 0 to 55 °C, pressures in kPa(g) and temperatures in °C. KPIs shown beside the view: condenser pressure, evaporator pressure, suction pressure, operating mode. Observation-tube phases come from `lib/observation.ts`.

## Honest limits to keep on screen

Illustrative geometry built from photographs and published dimensions, not a survey. Pipe routing follows the circuit drawing topologically and the photo where runs are visible; hidden pipework and exact probe positions are not verified. The flow overlay is a teaching animation, not a measurement. No startup transients, faults, charge or fan-speed model.
