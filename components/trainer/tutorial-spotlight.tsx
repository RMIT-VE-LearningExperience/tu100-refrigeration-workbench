'use client';
import { useEffect, useId, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';

type Cutout = { x: number; y: number; width: number; height: number };
type Spotlight = { width: number; height: number; holes: Cutout[] };

// Clip to the visible part of nested photo/dialog scroll containers.
function visibleCutout(
  el: HTMLElement,
  width: number,
  height: number,
  pad = 8,
): Cutout | null {
  if (
    !el.getClientRects().length ||
    getComputedStyle(el).visibility === 'hidden'
  )
    return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 1 || rect.height <= 1) return null;
  let left = Math.max(0, rect.left - pad);
  let top = Math.max(0, rect.top - pad);
  let right = Math.min(width, rect.right + pad);
  let bottom = Math.min(height, rect.bottom + pad);
  for (let parent = el.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    const clipX = /auto|scroll|hidden|clip/.test(style.overflowX);
    const clipY = /auto|scroll|hidden|clip/.test(style.overflowY);
    if (!clipX && !clipY) continue;
    const bounds = parent.getBoundingClientRect();
    if (clipX) {
      left = Math.max(left, bounds.left);
      right = Math.min(right, bounds.right);
    }
    if (clipY) {
      top = Math.max(top, bounds.top);
      bottom = Math.min(bottom, bounds.bottom);
    }
  }
  if (right <= left || bottom <= top) return null;
  return {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.round(right - left),
    height: Math.round(bottom - top),
  };
}

export function TutorialSpotlight({
  panel,
  selector,
  embedded,
  step,
  enabled,
}: {
  panel: RefObject<HTMLElement | null>;
  selector: string;
  embedded: boolean;
  step: number;
  enabled: boolean;
}) {
  const maskId = useId();
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let highlighted: HTMLElement[] = [];
    let frame = 0;
    let movingUntil = 0;
    let lastGeometry = '';
    const observed = new Set<Element>();
    const resize = new ResizeObserver(() => schedule());
    const observe = (el: Element) => {
      if (!observed.has(el)) {
        observed.add(el);
        resize.observe(el);
      }
    };
    function update() {
      frame = 0;
      const coach = panel.current;
      if (!coach) return;
      const dialog = embedded
        ? coach.closest<HTMLElement>('[data-slot="dialog-content"]')
        : null;
      const scope = dialog ?? document;
      highlighted.forEach((el) => el.classList.remove('machine-target'));
      highlighted = selector
        ? Array.from(scope.querySelectorAll<HTMLElement>(selector)).filter(
            (el) => el.getClientRects().length > 0,
          )
        : [];
      highlighted.forEach((el) => el.classList.add('machine-target'));
      const clear = new Set<HTMLElement>([coach]);
      for (const el of highlighted) {
        clear.add(el.closest('details') ?? el);
        el.querySelectorAll<HTMLElement>('.marker-caption').forEach((caption) =>
          clear.add(caption),
        );
        if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
          el.labels?.forEach((label) => clear.add(label));
        }
      }
      // Keep the whole machine available for the initial zoom/labels orientation.
      if (step === 0) {
        const photo = scope.querySelector<HTMLElement>('.equipment-photo');
        if (photo) clear.add(photo);
      }
      if (step === 4) {
        const settings = scope.querySelector<HTMLElement>('.calm-settings');
        if (settings) clear.add(settings);
        if (dialog && settings) clear.add(dialog);
      }
      if (step === 7) {
        const tube = scope.querySelector<HTMLElement>('.tube-row');
        if (tube) clear.add(tube);
      }
      // The dialog's title and exit remain readable, along with recovery messages.
      scope
        .querySelectorAll<HTMLElement>(
          '[data-slot="dialog-header"], [data-slot="dialog-title"], [data-slot="dialog-description"], [data-slot="dialog-close"], [role="alert"]',
        )
        .forEach((el) => clear.add(el));
      const focused = document.activeElement;
      if (
        focused instanceof HTMLElement &&
        focused !== document.body &&
        scope.contains(focused)
      ) {
        clear.add(focused.closest('details') ?? focused);
      }
      const width = document.documentElement.clientWidth;
      const height = window.innerHeight;
      const holes: Cutout[] = [];
      const header = document.querySelector<HTMLElement>('.calm-header');
      const workspaceTop = Math.max(
        coach.getBoundingClientRect().bottom,
        header?.getBoundingClientRect().bottom ?? 0,
      );
      for (const el of clear) {
        observe(el);
        const hole = visibleCutout(el, width, height, el === coach ? 0 : 8);
        if (
          hole &&
          !embedded &&
          el !== coach &&
          !coach.contains(el) &&
          !header?.contains(el)
        ) {
          const bottom = hole.y + hole.height;
          hole.y = Math.max(hole.y, workspaceTop);
          hole.height = Math.max(0, bottom - hole.y);
        }
        if (hole && hole.height > 0) holes.push(hole);
      }
      if (dialog) {
        // Treat the dialog heading and coach as one calm, readable area.
        const bounds = dialog.getBoundingClientRect();
        const bottom = Math.min(
          height,
          bounds.bottom,
          coach.getBoundingClientRect().bottom + 8,
        );
        const top = Math.max(0, bounds.top);
        if (bottom > top)
          holes.push({
            x: Math.max(0, bounds.left),
            y: top,
            width: Math.min(width, bounds.right) - Math.max(0, bounds.left),
            height: bottom - top,
          });
      }
      observe(document.body);
      if (dialog) observe(dialog);
      const next = { width, height, holes };
      const geometry = JSON.stringify(next);
      if (geometry !== lastGeometry) {
        lastGeometry = geometry;
        setSpotlight(next);
      }
      if (performance.now() < movingUntil) schedule();
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    function followMotion() {
      movingUntil = performance.now() + 350;
      schedule();
    }
    const mutation = new MutationObserver(followMotion);
    mutation.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'style',
        'open',
        'hidden',
        'data-state',
        'aria-expanded',
      ],
    });
    document.addEventListener('scroll', schedule, true);
    document.addEventListener('focusin', schedule);
    document.addEventListener('transitionrun', followMotion);
    document.addEventListener('animationstart', followMotion);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    followMotion();
    return () => {
      cancelAnimationFrame(frame);
      mutation.disconnect();
      resize.disconnect();
      document.removeEventListener('scroll', schedule, true);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('transitionrun', followMotion);
      document.removeEventListener('animationstart', followMotion);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
      highlighted.forEach((el) => el.classList.remove('machine-target'));
    };
  }, [panel, selector, embedded, step, enabled]);

  if (!enabled || !spotlight) return null;
  return createPortal(
    <svg
      className="machine-shade"
      aria-hidden="true"
      width={spotlight.width}
      height={spotlight.height}
    >
      <defs>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={spotlight.width}
          height={spotlight.height}
        >
          <rect width="100%" height="100%" fill="white" />
          {spotlight.holes.map((hole, index) => (
            <rect key={index} {...hole} rx="10" fill="black" />
          ))}
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(8, 21, 17, 0.56)"
        mask={`url(#${maskId})`}
      />
    </svg>,
    document.body,
  );
}
