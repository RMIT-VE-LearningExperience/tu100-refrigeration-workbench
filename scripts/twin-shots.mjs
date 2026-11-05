// Screenshots and checks of the 3D twin, driven through real clicks and key presses (viz3d brief).
// Usage: node scripts/twin-shots.mjs [baseUrl] [outDir]
//   needs the dev server running, e.g. npm run dev -- --hostname 127.0.0.1
// Writes PNGs plus checks.json (console errors, fps estimate, coplanar pairs, frame measurements).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:3000/';
const out = process.argv[3] ?? join(process.cwd(), '..', 'work', 'viz3d-review', 'shots');
mkdirSync(out, { recursive: true });
const errors = [];
const checks = {};

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function openTwin(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  await context.addInitScript(() => {
    try {
      localStorage.setItem('tu100-machine-tutorial-seen-v1', '1');
      localStorage.setItem('tu100-twin-flow', '0');
      localStorage.setItem('tu100-twin-theme', 'workshop');
    } catch {}
  });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push({ viewport, type: m.type(), text: m.text().slice(0, 300) });
  });
  page.on('pageerror', (e) => errors.push({ viewport, type: 'pageerror', text: String(e).slice(0, 300) }));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /simulate/i }).first().click();
  await page.waitForFunction(() => !!(window.__twin && window.__twin.scene && window.__twin.scene.getObjectByName('Panel')), null, { timeout: 60000 });
  await page.waitForTimeout(1800);
  return { context, page };
}

const shot = (page, name) => page.screenshot({ path: join(out, name + '.png'), timeout: 90000 });

// Desktop walk-through
{
  const { context, page } = await openTwin({ width: 1440, height: 900 });
  await shot(page, '01-overview');
  checks.nodes = await page.evaluate(() => {
    let meshes = 0, triangles = 0;
    window.__twin.scene.traverse((o) => {
      if (o.isMesh) {
        meshes++;
        const g = o.geometry;
        triangles += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
      }
    });
    return { meshes, triangles: Math.round(triangles) };
  });
  // fps estimate over one second
  checks.fps = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let frames = 0;
        const start = performance.now();
        const tick = () => {
          frames++;
          if (performance.now() - start < 1000) requestAnimationFrame(tick);
          else resolve(frames);
        };
        requestAnimationFrame(tick);
      }),
  );
  // stages by number key
  for (const key of ['2', '3', '4', '5', '6', '7', '8', '9']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(1700);
    await shot(page, `02-stage-${key}`);
  }
  await page.keyboard.press('1');
  await page.waitForTimeout(1700);
  // real click on HP1's handwheel
  const hp1 = await page.evaluate(() => window.__twin.project('Valve_HP1_Wheel'));
  checks.hp1Projected = hp1;
  await page.keyboard.press('3');
  await page.waitForTimeout(1700);
  const hp1Close = await page.evaluate(() => window.__twin.project('Valve_HP1_Wheel'));
  await page.mouse.click(hp1Close.x, hp1Close.y);
  await page.waitForTimeout(600);
  checks.selectedAfterClick = await page.evaluate(() => document.querySelector('.calm-inspector h2')?.textContent ?? null);
  await shot(page, '03-hp1-selected');
  // operate the valve from the inspector, then undo, to see the wheel turn
  await page.getByRole('button', { name: /^close hp1$/i }).click();
  await page.waitForTimeout(900);
  await shot(page, '04-hp1-closed');
  await page.getByRole('button', { name: /undo valve/i }).click();
  await page.waitForTimeout(900);
  // click the lower coil (a component card)
  await page.keyboard.press('4');
  await page.waitForTimeout(1700);
  const coilClose = await page.evaluate(() => window.__twin.project('Coil_Lower_Fins'));
  await page.mouse.click(coilClose.x, coilClose.y);
  await page.waitForTimeout(500);
  checks.coilCard = await page.evaluate(() => document.querySelector('.twin-card strong')?.textContent ?? null);
  await shot(page, '05-coil-card');
  await page.keyboard.press('Escape');
  // run the example and show the flow overlay
  await page.locator('[data-tour="run"]').click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /flow off/i }).click();
  await page.keyboard.press('1');
  await page.waitForTimeout(2200);
  await shot(page, '06-flow-overview');
  await page.keyboard.press('4');
  await page.waitForTimeout(1700);
  await shot(page, '07-flow-condenser');
  await page.keyboard.press('9');
  await page.waitForTimeout(1700);
  await shot(page, '08-gauges-running');
  checks.readingsWhileRunning = await page.evaluate(() =>
    [...document.querySelectorAll('.calm-pressure-row strong')].map((e) => e.textContent),
  );
  // labels on
  await page.getByRole('button', { name: /labels off/i }).click();
  await page.keyboard.press('1');
  await page.waitForTimeout(1800);
  await shot(page, '09-labels');
  // night theme
  await page.locator('.twin-theme > summary').click();
  await page.getByRole('button', { name: /^night$/i }).click();
  await page.waitForTimeout(600);
  await shot(page, '10-night');
  // coplanar check (port of viz3d scripts/coplanar-check.js), on the unit meshes
  checks.coplanar = await page.evaluate(() => {
    const THREE = window.__twin.THREE;
    const FLAT_RATIO = 0.05, AXES = ['x', 'y', 'z'], tolerance = 0.002;
    const boxes = [];
    window.__twin.scene.traverse((o) => {
      if (!o.isMesh || !o.name) return;
      const box = new THREE.Box3().setFromObject(o);
      boxes.push({ name: o.name, box });
    });
    const flatAxes = (box) => {
      const size = { x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z };
      const result = [];
      for (const axis of AXES) {
        const others = AXES.filter((a) => a !== axis);
        const span = Math.max(size[others[0]], size[others[1]]);
        if (size[others[0]] <= 0 || size[others[1]] <= 0) continue;
        if (size[axis] <= FLAT_RATIO * span || size[axis] <= 0.003) result.push({ axis, others });
      }
      return result;
    };
    const pairs = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        for (const fa of flatAxes(a.box))
          for (const fb of flatAxes(b.box)) {
            if (fa.axis !== fb.axis) continue;
            const ax = fa.axis;
            const ca = (a.box.min[ax] + a.box.max[ax]) / 2, cb = (b.box.min[ax] + b.box.max[ax]) / 2;
            if (Math.abs(ca - cb) > tolerance) continue;
            const [o1, o2] = fa.others;
            const w = Math.min(a.box.max[o1], b.box.max[o1]) - Math.max(a.box.min[o1], b.box.min[o1]);
            const h = Math.min(a.box.max[o2], b.box.max[o2]) - Math.max(a.box.min[o2], b.box.min[o2]);
            if (w > 0.005 && h > 0.005) pairs.push({ a: a.name, b: b.name, axis: ax, overlap: +(w * h).toFixed(5) });
          }
      }
    return pairs.slice(0, 40);
  });
  await context.close();
}

// Phone
{
  const { context, page } = await openTwin({ width: 390, height: 844 });
  await shot(page, '11-mobile-overview');
  await page.locator('[data-tour="run"]').first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /flow off/i }).click();
  await page.waitForTimeout(1500);
  await shot(page, '12-mobile-flow');
  await page.getByRole('button', { name: /receiver/i }).first().click();
  await page.waitForTimeout(1700);
  await shot(page, '13-mobile-receiver');
  await context.close();
}

await browser.close();
checks.errors = errors;
writeFileSync(join(out, 'checks.json'), JSON.stringify(checks, null, 2));
console.log(JSON.stringify({ ...checks, errors: errors.length, coplanar: checks.coplanar?.length }, null, 2));
