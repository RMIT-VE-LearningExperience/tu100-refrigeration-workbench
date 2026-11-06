'use client';
/* oxlint-disable react/react-compiler, react/no-unknown-property */
// Imperative three.js updates in useFrame (handwheels, needles, fans, particles, camera flights)
// cannot be expressed as React state without re-rendering the scene graph every frame.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls, useGLTF } from '@react-three/drei';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  COMPONENTS,
  FLOW_STYLE,
  LAYOUT,
  STAGES,
  THEMES,
  flowPath,
  gaugeAngle,
  identify,
  valveWorld,
  type FlowRole,
  type StageId,
  type TwinTheme,
  type Vec3,
} from '@/lib/twin';
import { VALVE_NAMES, type Valve, type ValveState, type simulate } from '@/lib/model';
import { observationStates } from '@/lib/observation';
import { asset } from '@/lib/base';

export const MODEL_URL = asset('/models/tu100-unit.glb');
export type Pick = { kind: 'valve'; id: Valve } | { kind: 'component'; id: string } | null;
export type TwinSceneProps = {
  valves: ValveState;
  model: ReturnType<typeof simulate>;
  refrigerant: string;
  running: boolean;
  selected: Valve | null;
  picked: Pick;
  stage: StageId | null;
  flow: boolean;
  labels: boolean;
  theme: TwinTheme;
  focusRequest: number;
  reducedMotion: boolean;
  onPick: (pick: Pick) => void;
  onUserMove: () => void;
  onReady: () => void;
};

const ACCENT = new THREE.Color('#176749');
const HOVER = new THREE.Color('#7fb59a');
const PHASE_CORE: Record<string, { colour: string; opacity: number }> = {
  liquid: { colour: '#3e7bd6', opacity: 0.85 },
  vapour: { colour: '#dbe6ef', opacity: 0.18 },
  mixture: { colour: '#7fd0dc', opacity: 0.6 },
  stopped: { colour: '#9aa3a8', opacity: 0.25 },
};
const TUBE_ROLES = (heating: boolean): Record<string, string> =>
  heating
    ? {
        Tube_UpperTop: 'condenser-in',
        Tube_UpperBottom: 'condenser-out',
        Tube_LowerTop: 'evaporator-out',
        Tube_LowerBottom: 'evaporator-in',
      }
    : {
        Tube_LowerTop: 'condenser-in',
        Tube_LowerBottom: 'condenser-out',
        Tube_UpperTop: 'evaporator-out',
        Tube_UpperBottom: 'evaporator-in',
      };

/** Multi-material nodes export as a named group with children named after their geometry
 * (for example Cylinder088_1 under Valve_HP1_Wheel), so names are resolved up the parent chain. */
function owner(o: THREE.Object3D) {
  let cur: THREE.Object3D | null = o;
  while (cur) {
    const id = identify(cur.name);
    if (id) return id;
    cur = cur.parent;
  }
  return null;
}
function keyOf(o: THREE.Object3D) {
  const id = owner(o);
  return id ? id.kind + ':' + id.id : null;
}

type PointerEvt = { stopPropagation: () => void; object: THREE.Object3D; delta?: number };

/** The GLB with picking, highlights and animated parts. */
function Unit(props: TwinSceneProps) {
  const { scene } = useGLTF(MODEL_URL);
  const [hover, setHover] = useState<string | null>(null);
  const registry = useMemo(() => {
    const byKey = new Map<string, THREE.Mesh[]>();
    const wheels: { id: Valve | 'AXV'; wheel: THREE.Object3D; axis: THREE.Vector3 }[] = [];
    const needles: { id: string; pivot: THREE.Object3D; max: number }[] = [];
    const fans: THREE.Object3D[] = [];
    const cores: { id: string; mesh: THREE.Mesh }[] = [];
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && !Array.isArray(mesh.material)) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const m = (mesh.material as THREE.MeshStandardMaterial).clone();
        mesh.material = m;
        if (o.name.startsWith('Mesh_Side_')) {
          m.transparent = true;
          m.opacity = 0.28;
          m.depthWrite = false;
          mesh.castShadow = false;
        }
        if (o.name.endsWith('_Glass')) {
          m.transparent = true;
          m.opacity = 0.32;
          m.roughness = 0.08;
          m.depthWrite = false;
          mesh.castShadow = false;
        }
        if (o.name.endsWith('_Core')) {
          m.transparent = true;
          cores.push({ id: o.name.replace(/_Core$/, ''), mesh });
        }
        m.userData.baseEmissive = m.emissive.clone();
        const key = keyOf(o);
        if (key) byKey.set(key, [...(byKey.get(key) ?? []), mesh]);
      }
      const wheelMatch = /^Valve_([A-Z0-9]+)_Pivot$/.exec(o.name);
      if (wheelMatch) {
        const id = wheelMatch[1] as Valve | 'AXV';
        const spec = LAYOUT.valves.find((v) => v.id === id);
        const wheel = o.children.find((c) => c.name.endsWith('_Wheel'));
        if (spec && wheel)
          wheels.push({
            id,
            wheel,
            axis: 'bench' in spec && spec.bench ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1),
          });
      }
      const needle = /^Gauge_([A-Za-z]+)_Needle_Pivot$/.exec(o.name);
      if (needle) needles.push({ id: needle[1].toLowerCase(), pivot: o, max: Number(o.userData.max) || 1800 });
      if (/^Fan_[A-Za-z]+_Blades$/.test(o.name)) fans.push(o);
    });
    return { byKey, wheels, needles, fans, cores };
  }, [scene]);

  const announced = useRef(false);
  useEffect(() => {
    if (announced.current) return;
    announced.current = true;
    props.onReady();
  });

  // highlight state: selected valve, picked component, hovered part, active stage parts
  useEffect(() => {
    const active = new Set<string>();
    if (props.selected) active.add('valve:' + props.selected);
    if (props.picked) active.add(props.picked.kind + ':' + props.picked.id);
    const stageParts = props.stage ? (STAGES.find((s) => s.id === props.stage)?.parts ?? []) : [];
    for (const [key, meshes] of registry.byKey) {
      const isActive = active.has(key);
      const isHover = hover === key;
      const inStage = stageParts.some((p) => key.endsWith(':' + p.replace('Valve_', '')) || meshes.some((m) => m.name.startsWith(p) || m.parent?.name.startsWith(p)));
      for (const mesh of meshes) {
        const m = mesh.material as THREE.MeshStandardMaterial;
        m.emissive.copy(m.userData.baseEmissive as THREE.Color);
        if (isActive) m.emissive.lerp(ACCENT, 0.55);
        else if (isHover) m.emissive.lerp(HOVER, 0.35);
        else if (inStage) m.emissive.lerp(ACCENT, 0.18);
      }
    }
  }, [props.selected, props.picked, props.stage, hover, registry]);

  // observation tube cores follow the modelled phase
  useEffect(() => {
    const tubes = observationStates(props.model, props.refrigerant);
    const byPosition = TUBE_ROLES(props.model.config?.mode === 'Heating');
    for (const core of registry.cores) {
      const tube = tubes.find((t) => t.id === byPosition[core.id]);
      const phase = props.model.values && tube ? tube.phase : 'stopped';
      const style = PHASE_CORE[phase] ?? PHASE_CORE.stopped;
      const m = core.mesh.material as THREE.MeshStandardMaterial;
      m.color.set(style.colour);
      m.opacity = style.opacity;
      m.metalness = 0;
      m.roughness = 0.3;
    }
  }, [props.model, props.refrigerant, registry]);

  const spin = useRef(0);
  const spinQ = useMemo(() => new THREE.Quaternion(), []);
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 6);
    for (const w of registry.wheels) {
      const open = w.id === 'AXV' ? false : props.valves[w.id];
      const targetAngle = open ? 0 : Math.PI * 4;
      const data = w.wheel.userData as { angle?: number; baseQ?: THREE.Quaternion; baseP?: THREE.Vector3 };
      if (!data.baseQ) {
        data.baseQ = w.wheel.quaternion.clone();
        data.baseP = w.wheel.position.clone();
      }
      const current = data.angle ?? targetAngle;
      const next = props.reducedMotion ? targetAngle : current + (targetAngle - current) * k;
      data.angle = next;
      w.wheel.quaternion.copy(data.baseQ).premultiply(spinQ.setFromAxisAngle(w.axis, next));
      w.wheel.position.copy(data.baseP!).addScaledVector(w.axis, open ? 0.004 : 0);
    }
    const v = props.model.values;
    for (const n of registry.needles) {
      const reading = n.id === 'cond' ? v?.Pdis : n.id === 'evap' ? v?.Pevap : v?.Psuc;
      const target = -gaugeAngle(reading, n.max);
      const current = n.pivot.rotation.z;
      n.pivot.rotation.z = props.reducedMotion ? target : current + (target - current) * k;
    }
    if (props.running && props.model.values && !props.reducedMotion) {
      spin.current += dt * 14;
      for (const f of registry.fans) f.rotation.z = spin.current;
    }
  });

  return (
    <primitive
      object={scene}
      onPointerMove={(e: PointerEvt) => {
        e.stopPropagation();
        const key = keyOf(e.object);
        if (key !== hover) setHover(key);
        document.body.style.cursor = key ? 'pointer' : '';
      }}
      onPointerOut={() => {
        setHover(null);
        document.body.style.cursor = '';
      }}
      onClick={(e: PointerEvt) => {
        e.stopPropagation();
        if ((e.delta ?? 0) > 4) return; // a drag, not a click
        props.onPick(owner(e.object));
      }}
    />
  );
}

/** Moving particles along the illustrative refrigerant route. */
function Flow(props: { valves: ValveState; visible: boolean; reducedMotion: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const path = useMemo(() => {
    const segments = flowPath(props.valves);
    if (!segments) return null;
    const points: THREE.Vector3[] = [];
    const roles: FlowRole[] = [];
    const cumulative: number[] = [];
    for (const s of segments)
      for (const p of s.points) {
        const v = new THREE.Vector3(...p);
        if (points.length && points[points.length - 1].distanceTo(v) < 1e-6) continue;
        cumulative.push(points.length ? cumulative[cumulative.length - 1] + points[points.length - 1].distanceTo(v) : 0);
        points.push(v);
        roles.push(s.role);
      }
    const length = cumulative[cumulative.length - 1];
    const count = Math.max(40, Math.floor(length / 0.05));
    const offsets = new Float32Array(count);
    for (let i = 0; i < count; i++) offsets[i] = (i / count) * length;
    return { points, roles, cumulative, length, count, offsets };
  }, [props.valves]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colour = useMemo(() => new THREE.Color(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);

  const sample = (s: number): FlowRole => {
    if (!path) return 'vessel';
    const { points, cumulative, roles } = path;
    let lo = 0,
      hi = cumulative.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] <= s) lo = mid;
      else hi = mid;
    }
    const segLen = cumulative[hi] - cumulative[lo] || 1;
    pos.lerpVectors(points[lo], points[hi], (s - cumulative[lo]) / segLen);
    return roles[hi];
  };

  useFrame((_, dt) => {
    const inst = mesh.current;
    if (!inst || !path || !props.visible) return;
    for (let i = 0; i < path.count; i++) {
      let s = path.offsets[i];
      let role = sample(s);
      if (!props.reducedMotion) {
        s = (s + Math.min(dt, 0.05) * FLOW_STYLE[role].speed) % path.length;
        path.offsets[i] = s;
        role = sample(s);
      }
      const hidden = role === 'vessel';
      dummy.position.copy(pos);
      dummy.scale.setScalar(hidden ? 0.0001 : role === 'liquid' || role === 'condensing' ? 0.0062 : 0.0075);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, colour.set(FLOW_STYLE[role].colour));
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  });
  if (!path || !props.visible) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, path.count]} frustumCulled={false}>
      <sphereGeometry args={[1, 10, 8]} />
      <meshStandardMaterial roughness={0.4} metalness={0} emissive="#ffffff" emissiveIntensity={0.08} />
    </instancedMesh>
  );
}

/** Eases the camera to stage presets and component focus; a user drag cancels the flight. */
function CameraRig(props: TwinSceneProps & { controls: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera, scene } = useThree();
  const goal = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const lastFocus = useRef(props.focusRequest);
  const dragStart = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    const stage = STAGES.find((s) => s.id === props.stage);
    if (stage)
      goal.current = {
        position: new THREE.Vector3(...stage.position),
        target: new THREE.Vector3(...stage.target),
      };
  }, [props.stage]);

  useEffect(() => {
    if (props.focusRequest === lastFocus.current) return;
    lastFocus.current = props.focusRequest;
    let point: Vec3 | null = null;
    if (props.selected) point = valveWorld(props.selected);
    else if (props.picked?.kind === 'component') {
      const anchorName = COMPONENTS[props.picked.id]?.anchor;
      const anchor = anchorName ? scene.getObjectByName(anchorName) : null;
      if (anchor) {
        const p = anchor.getWorldPosition(new THREE.Vector3());
        point = [p.x, p.y, p.z];
      }
    }
    if (!point) return;
    const target = new THREE.Vector3(...point);
    const bench = target.y < 0.8;
    goal.current = {
      position: new THREE.Vector3(
        target.x + (bench ? 0.05 : 0.12),
        target.y + (bench ? 0.32 : 0.1),
        target.z + (bench ? 0.5 : 0.55),
      ),
      target,
    };
  }, [props.focusRequest, props.selected, props.picked, scene]);

  useFrame((_, dt) => {
    const controls = props.controls.current;
    if (!controls) return;
    if (dragStart.current && camera.position.distanceTo(dragStart.current) > 0.004) {
      // a real drag, not a click: the user takes over from the stage camera
      dragStart.current = null;
      goal.current = null;
      props.onUserMove();
    }
    const g = goal.current;
    if (!g) return;
    const k = props.reducedMotion ? 1 : 1 - Math.exp(-dt * 3.2);
    camera.position.lerp(g.position, k);
    controls.target.lerp(g.target, k);
    controls.update();
    if (camera.position.distanceTo(g.position) < 0.004 && controls.target.distanceTo(g.target) < 0.004)
      goal.current = null;
  });

  return (
    <OrbitControls
      ref={props.controls}
      makeDefault
      enableDamping
      dampingFactor={0.1}
      minDistance={0.3}
      maxDistance={5.5}
      minPolarAngle={0.2}
      maxPolarAngle={1.5}
      target={[0.05, 1.15, 0.05]}
      onStart={() => {
        dragStart.current = camera.position.clone();
      }}
      onEnd={() => {
        dragStart.current = null;
      }}
    />
  );
}

function RoomLight() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = texture;
    scene.environmentIntensity = 0.3;
    return () => {
      scene.environment = null;
      texture.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function Labels(props: TwinSceneProps) {
  const { scene } = useGLTF(MODEL_URL);
  const { camera } = useThree();
  const [far, setFar] = useState(true);
  const frame = useRef(0);
  useFrame(() => {
    if (frame.current++ % 10) return;
    const distance = camera.position.distanceTo(new THREE.Vector3(0, 1.2, 0));
    const next = distance > 1.9;
    if (next !== far) setFar(next);
  });
  const anchors = useMemo(() => {
    const list: { key: string; name: string; position: Vec3; kind: 'valve' | 'component' }[] = [];
    for (const v of LAYOUT.valves) {
      if (v.id === 'AXV') continue;
      const p = valveWorld(v.id as Valve);
      const bench = 'bench' in v && v.bench;
      list.push({
        key: 'valve:' + v.id,
        name: v.id,
        position: [p[0], p[1] + (bench ? 0.07 : 0.055), p[2] + 0.05],
        kind: 'valve',
      });
    }
    for (const [id, c] of Object.entries(COMPONENTS)) {
      if (id.startsWith('gauge_') || id === 'axv' || id === 'captube' || id === 'txv' || id === 'dryer') continue;
      const anchor = scene.getObjectByName(c.anchor);
      if (!anchor) continue;
      const p = anchor.getWorldPosition(new THREE.Vector3());
      list.push({ key: 'component:' + id, name: c.name, position: [p.x, p.y, p.z + 0.03], kind: 'component' });
    }
    const metering = scene.getObjectByName('Anchor_Metering')?.getWorldPosition(new THREE.Vector3());
    if (metering)
      list.push({ key: 'component:txv', name: 'Metering devices', position: [metering.x, metering.y, metering.z], kind: 'component' });
    return list;
  }, [scene]);
  const mode = props.model.config?.mode;
  const roleName = (key: string, name: string) => {
    if (!mode) return name;
    if (key === 'component:coil_upper') return mode === 'Cooling' ? 'Upper coil · evaporator' : 'Upper coil · condenser';
    if (key === 'component:coil_lower') return mode === 'Cooling' ? 'Lower coil · condenser' : 'Lower coil · evaporator';
    return name;
  };
  const activeKey = props.selected
    ? 'valve:' + props.selected
    : props.picked
      ? props.picked.kind + ':' + props.picked.id
      : null;
  return (
    <>
      {anchors
        .filter((a) => a.key === activeKey || (props.labels && (a.kind === 'component' || !far)))
        .map((a) => (
          <Html key={a.key} position={a.position} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
            <span className={'twin-label ' + a.kind + (a.key === activeKey ? ' is-active' : '')}>
              {roleName(a.key, a.name)}
              {a.kind === 'valve' && <small>{props.valves[a.name as Valve] ? 'open' : 'closed'}</small>}
            </span>
          </Html>
        ))}
    </>
  );
}

/** Exposes the scene for Playwright checks (window.__twin), as the viz3d briefs ask. */
function Expose(props: { controls: React.RefObject<OrbitControlsImpl | null> }) {
  const { scene, camera, gl, size } = useThree();
  useEffect(() => {
    const w = window as unknown as { __twin?: Record<string, unknown> };
    w.__twin = {
      ...w.__twin,
      scene,
      camera,
      THREE,
      project(name: string) {
        const o = scene.getObjectByName(name);
        if (!o) return null;
        const p = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).project(camera);
        const rect = gl.domElement.getBoundingClientRect();
        return { x: rect.left + ((p.x + 1) / 2) * size.width, y: rect.top + ((1 - p.y) / 2) * size.height, z: p.z };
      },
      valveNames: VALVE_NAMES,
    };
  }, [scene, camera, gl, size, props.controls]);
  return null;
}

export default function TwinScene(props: TwinSceneProps) {
  const theme = THEMES[props.theme];
  const controls = useRef<OrbitControlsImpl | null>(null);
  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={[1, 1.5]}
      camera={{ fov: 30, near: 0.05, far: 40, position: STAGES[0].position }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.92,
        powerPreference: 'high-performance',
      }}
      style={{ background: theme.background }}
      onPointerMissed={() => props.onPick(null)}
    >
      <color attach="background" args={[theme.background]} />
      <fog attach="fog" args={[theme.fog, 6, 14]} />
      <hemisphereLight args={['#eef4ff', '#aab6c8', theme.ambient]} />
      <directionalLight
        castShadow
        color="#fff6ea"
        intensity={theme.sun}
        position={[-2.2, 3.6, 3.2]}
        shadow-mapSize={[2048, 2048]}
        shadow-radius={4}
        shadow-bias={-0.0004}
        shadow-camera-left={-1.4}
        shadow-camera-right={1.4}
        shadow-camera-top={1.6}
        shadow-camera-bottom={-1.6}
        shadow-camera-near={1}
        shadow-camera-far={10}
      />
      <directionalLight color="#dfe8f5" intensity={0.5} position={[2.5, 2.2, -1.5]} />
      <RoomLight />
      <Unit {...props} />
      <Flow
        valves={props.valves}
        visible={props.flow && props.running && !!props.model.values}
        reducedMotion={props.reducedMotion}
      />
      <Labels {...props} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0.2]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color={theme.ground} roughness={0.95} metalness={0} />
      </mesh>
      <ContactShadows position={[0, 0.001, 0.2]} opacity={0.45} scale={3} blur={2.2} far={1.2} resolution={512} frames={1} />
      <CameraRig {...props} controls={controls} />
      <Expose controls={controls} />
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
