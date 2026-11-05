# TU-100 3D twin: Blender build

Built with the viz3d method (plan file, reference sheet, Blender asset pass, three.js app pass, self-review). Files:

- `TOPIC.md`: the viz3d topic file for this subject, look and stages.
- `refs/tu100-unit.md`: the reference sheet, with every dimension's source and "verify" marks.
- `layout.json`: the single source of truth for geometry. Percent coordinates of the front photo for every coil, tube, tray, gauge, valve, vessel and pipe run, plus the two pipe depth layers. `build-tu100.py` and `lib/twin.ts` both read it, so the modelled pipes and the flow overlay cannot diverge.
- `build-tu100.py`: builds the whole unit procedurally in Blender 5.x and exports `public/models/tu100-unit.glb` (about 2.7 MB, 117k triangles, 363 named nodes) and `tu100-unit.blend` for editing.

Rebuild (headless; add `--render` for preview sheets in `../../work/viz3d-review/blender/`):

```
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python design/3d/build-tu100.py -- --render
```

## Node names the app relies on

- `Valve_<id>_Pivot` with children `Valve_<id>_Wheel` and `Valve_<id>_Stem`: the handwheel spins about the pivot (stem toward the viewer, or up for the bench valves LRB, LRI, LRK). The wheel carries a `valve` extra.
- `Gauge_<Cond|Evap|Suc>_Needle_Pivot` with `max` extra: the needle rotates with the model's pressure.
- `Fan_<Upper|Lower>_Blades`: spin while the example runs.
- `Tube_<UpperTop|UpperBottom|LowerTop|LowerBottom>_Glass` and `_Core`: the core is tinted by the modelled phase.
- `Coil_*`, `Receiver*`, `Accumulator*`, `Compressor*`, `Dryer*`, `TXV*`, `AXV*`, `CapTube`: selectable components (`lib/twin.ts` `identify`).
- `Anchor_*` empties: label and camera anchors.
- `Mesh_Side_*`: the side guards, rendered translucent.

Multi-material nodes export as a named group whose children are named after their geometry, so the app resolves picks up the parent chain.

## What this geometry is and is not

Illustrative, built from the project photographs and the manufacturer's published US dimensions (0.876 × 0.457 × 1.969 m, marked verify). Component positions follow the front photo; standoff depths and part sizes were scaled from oblique photos. Pipe routing follows the circuit drawing topologically and the photo where runs are visible; crossings are handled with two depth layers and are not a survey of the real pipework. The AXV is modelled but not part of the eight supported configurations. Hidden pipework, fan housings and probe positions are not verified. The model plate carries the model number as text only.

Before treating it as a replica: measure the RMIT unit, confirm the four tube roles and the valve bank plumbing with the instructor, and compare the exported front orthographic view with a new straight-on photograph.
