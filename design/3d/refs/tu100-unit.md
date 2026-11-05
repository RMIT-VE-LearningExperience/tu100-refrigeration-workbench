# Reference sheet: TU-100 basic refrigeration trainer (RMIT unit)

Written 4 November 2026 for the 3D twin. Numbers marked **verify** come from the manufacturer's published US specification or were scaled from photographs; they have not been measured on the RMIT unit.

## What it is

A panel-mounted teaching refrigeration unit: a reversible vapour-compression circuit with hand valves that reconfigure it, built on a white panel over a bench-height stand. Manufacturer family: Imperial / iConnect TU-100. The app does not reproduce the brand plate; the model number appears as text only.

## Dimensions

| Quantity | Value | Source |
| --- | --- | --- |
| Overall width | 34.5 in = 0.876 m **verify** | iConnect TU-100 page, "34.5″ L x 18″ W x 77.5″ H" |
| Overall depth | 18 in = 0.457 m **verify** | same |
| Overall height | 77.5 in = 1.969 m **verify** | same |
| Panel material | 1/4 in HDPE = 6.4 mm | same |
| Panel height | 1.39 m **verify** | scaled: the app's front photo (1010 × 1600 px) frames the panel at 0.876 m wide, aspect 1.584 |
| Bench top height | 0.58 m **verify** | 1.969 − 1.39 |
| Compressor | 1/3 HP hermetic reciprocating, about 0.17 m diameter, 0.28 m tall **verify** | spec page; size scaled from photo 0H5A3411 |
| Glass observation tube | 22 mm glass, 0.175 m visible length, tie-bolt brass ends **verify** | photos 0H5A3498–3503 |
| Hand valve handwheel | 55 mm red six-lobe knob **verify** | photo 0H5A3447 against 9.5 mm copper tube |
| Copper tube | 3/8 in = 9.5 mm OD **verify** | photo 0H5A3447 |
| Pressure gauge | 70 mm dial **verify** | photo 0H5A3447 |
| Receiver | 0.10 m diameter, 0.26 m tall, black **verify** | photo 0H5A3442 |
| Accumulator | 0.085 m diameter, 0.20 m tall, black, yellow label band **verify** | photo 0H5A3411 |
| Coil block | 0.25 m wide, 0.21 m tall, 0.05 m thick, 8 tube rows, U-bends both sides **verify** | photos 0H5A3438, 0H5A3498 |

Two independent sources for the overall size were not available; the RMIT unit's nameplate and a tape measure are the next evidence.

## Proportions that make it recognisable

- Panel aspect about 1.6 tall to 1 wide, standing on a stand of about 0.3 panel heights.
- Two equal coils stacked on the left third of the panel, each with a black tray beneath and a glass tube above and below.
- Pipework and the valve block fill the right half; red handwheels in a visible grid (three at the metering row, four in the reversing block, three around the accumulator), three more at bench level.
- Black cylinders (receiver, accumulator, compressor) sit low; the compressor is the largest and furthest right.

## Parts list (front, in reading order)

Panel and frame; evaporator-side glass tube (top); upper coil with left-side risers; upper glass tube (bottom) and upper drip tray; fan-speed control box with two knobs and a display; thermostat controller; clamp-probe holder plate; top pressure gauge; insulated suction section with TXV bulb; model plate; capillary coil; automatic expansion valve body; thermostatic expansion valve body; CTV, AXV, TXV handwheels; reversing valves HP1 HP2 / HP3 HP4; sight glass and filter-dryer; condenser-side gauge; lower glass tubes, lower coil and tray; ACI, ACB, ACO handwheels and the right-hand gauge; accumulator with pressure switch in front; receiver with LRB, LRI, LRK at bench level; compressor. Behind the panel: a fan housing per coil (variable speed, published), side mesh guards.

Moving parts: twelve handwheels (and the AXV wheel, not modelled), three gauge needles, two fans.

## Photo positions used for placement

Percent of the app's front photo (x across, y down). From `components/trainer/equipment.tsx` pins and `lib/learning.ts` regions, checked against the photo.

| Part | x | y |
| --- | --- | --- |
| CTV / AXV / TXV | 61.8 / 73.5 / 85.5 | 28.7 |
| HP1 / HP2 | 73.8 / 85.5 | 44 |
| HP3 / HP4 | 73.8 / 85.5 | 50.3 |
| ACB | 85.5 | 60.5 |
| ACI / ACO | 63.5 / 85.5 | 66.5 |
| LRB / LRI / LRK | bench level, left to right, LRK frontmost | 0H5A3442 |
| Upper coil | 9–50 | 7–31 |
| Lower coil | 9–50 | 57–79 |
| TXV body | 73–95 | 9–27 |
| Compressor | 75–100 | 77–98 |

## Reference images (study only, never shipped)

- `public/assets/trainer.jpg`: front elevation, the app's photo.
- `work/lrb-photo-audit/previews/0H5A3438.jpg`: upper-left three-quarter view showing standoff depths, coil thickness, tray depth, side mesh.
- `work/lrb-photo-audit/previews/0H5A3411.jpg`: lower half with the stand and bench.
- `work/lrb-photo-audit/agent-middle/0H5A3442-base.jpg`: receiver and bench valves.
- `work/lrb-photo-audit/previews/0H5A3447.jpg`: accumulator valves, a gauge, tube and fitting sizes.
- `work/lrb-photo-audit/sheets/sheet-09.jpg`: coil, tube ends and gauge close-ups.

Licence: RMIT project photographs supplied for this work; used as modelling references only.
