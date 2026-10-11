const GRID_X_RANGE = [100_000, 300_000];
const GRID_Y_RANGE = [30_000, 300_000];
const MAX_RING_POSITIONS = 500;

const inBounds = ([x, y]) =>
    x >= GRID_X_RANGE[0] && x <= GRID_X_RANGE[1] && y >= GRID_Y_RANGE[0] && y <= GRID_Y_RANGE[1];

const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

function segmentsCross(a, b, c, d) {
    const d1 = cross(c, d, a);
    const d2 = cross(c, d, b);
    const d3 = cross(a, b, c);
    const d4 = cross(a, b, d);
    const onSegment = (p, q, r) =>
        q[0] >= Math.min(p[0], r[0]) && q[0] <= Math.max(p[0], r[0]) &&
        q[1] >= Math.min(p[1], r[1]) && q[1] <= Math.max(p[1], r[1]);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
    return (d1 === 0 && onSegment(c, a, d)) ||
        (d2 === 0 && onSegment(c, b, d)) ||
        (d3 === 0 && onSegment(a, c, b)) ||
        (d4 === 0 && onSegment(a, d, b));
}

/** A single, closed Polygon exterior ring in Palestine Grid, or null when it is not safe to store. */
export function parseLandPolygon(raw) {
    if (!raw || raw.type !== 'Polygon' || !Array.isArray(raw.coordinates) || raw.coordinates.length !== 1) return null;
    const ring = raw.coordinates[0];
    if (!Array.isArray(ring) || ring.length < 4 || ring.length > MAX_RING_POSITIONS) return null;

    const points = ring.map((p) =>
        Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === 'number' && Number.isFinite(v))
            ? [Number(p[0].toFixed(3)), Number(p[1].toFixed(3))]
            : null,
    );
    if (points.some((p) => !p || !inBounds(p))) return null;
    const first = points[0];
    const last = points[points.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) return null;
    if (points.slice(0, -1).some((p, i) => p[0] === points[i + 1][0] && p[1] === points[i + 1][1])) return null;

    const distinct = new Set(points.slice(0, -1).map((p) => `${p[0]},${p[1]}`));
    if (distinct.size < 3) return null;

    let twiceArea = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        twiceArea += a[0] * b[1] - b[0] * a[1];
    }
    if (twiceArea === 0) return null;

    const segmentCount = points.length - 1;
    for (let i = 0; i < segmentCount; i++) {
        for (let j = i + 1; j < segmentCount; j++) {
            if (j === i + 1 || (i === 0 && j === segmentCount - 1)) continue;
            if (segmentsCross(points[i], points[i + 1], points[j], points[j + 1])) return null;
        }
    }

    return { type: 'Polygon', coordinates: [points] };
}
