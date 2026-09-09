/** Group photo targets whose 44px hit areas would crowd each other. */
export function clusterMarkers(
  points: { id: string; x: number; y: number }[],
  width: number,
  height: number,
  gap = 48,
) {
  const remaining = [...points],
    groups: (typeof points)[] = [];
  while (remaining.length) {
    const group = [remaining.shift()!];
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = remaining.length - 1; i >= 0; i--) {
        if (
          group.some(
            (p) =>
              Math.abs(((p.x - remaining[i].x) * width) / 100) < gap &&
              Math.abs(((p.y - remaining[i].y) * height) / 100) < gap,
          )
        ) {
          group.push(remaining.splice(i, 1)[0]);
          changed = true;
        }
      }
    }
    groups.push(group);
  }
  return groups.map((members) => ({
    members,
    x: members.reduce((a, p) => a + p.x, 0) / members.length,
    y: members.reduce((a, p) => a + p.y, 0) / members.length,
  }));
}
