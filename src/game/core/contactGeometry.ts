export interface ContactBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface ContactPoint {
  readonly x: number;
  readonly y: number;
}

const EPSILON = 0.001;

export function rectangleBounds(
  x: number,
  y: number,
  width: number,
  height: number,
): ContactBounds {
  return {
    left: x - width / 2,
    top: y - height / 2,
    right: x + width / 2,
    bottom: y + height / 2,
  };
}

export function boundsOverlap(a: ContactBounds, b: ContactBounds): boolean {
  return !(
    a.right < b.left - EPSILON ||
    a.left > b.right + EPSILON ||
    a.bottom < b.top - EPSILON ||
    a.top > b.bottom + EPSILON
  );
}

export function circleOverlapsBounds(
  bounds: ContactBounds,
  x: number,
  y: number,
  radius: number,
): boolean {
  const nearestX = Math.max(bounds.left, Math.min(x, bounds.right));
  const nearestY = Math.max(bounds.top, Math.min(y, bounds.bottom));
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy <= radius * radius + EPSILON;
}

export function ellipseOverlapsBounds(
  bounds: ContactBounds,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
): boolean {
  if (radiusX <= 0 || radiusY <= 0) return false;
  const nearestX = Math.max(bounds.left, Math.min(x, bounds.right));
  const nearestY = Math.max(bounds.top, Math.min(y, bounds.bottom));
  const normalizedX = (x - nearestX) / radiusX;
  const normalizedY = (y - nearestY) / radiusY;
  return normalizedX * normalizedX + normalizedY * normalizedY <= 1 + EPSILON;
}

function pointInsideBounds(point: ContactPoint, bounds: ContactBounds): boolean {
  return (
    point.x >= bounds.left - EPSILON &&
    point.x <= bounds.right + EPSILON &&
    point.y >= bounds.top - EPSILON &&
    point.y <= bounds.bottom + EPSILON
  );
}

function signedArea(a: ContactPoint, b: ContactPoint, c: ContactPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function pointInsideTriangle(
  point: ContactPoint,
  a: ContactPoint,
  b: ContactPoint,
  c: ContactPoint,
): boolean {
  const ab = signedArea(a, b, point);
  const bc = signedArea(b, c, point);
  const ca = signedArea(c, a, point);
  const hasNegative = ab < -EPSILON || bc < -EPSILON || ca < -EPSILON;
  const hasPositive = ab > EPSILON || bc > EPSILON || ca > EPSILON;
  return !(hasNegative && hasPositive);
}

function orientation(a: ContactPoint, b: ContactPoint, c: ContactPoint): number {
  const value = signedArea(a, b, c);
  if (Math.abs(value) <= EPSILON) return 0;
  return value > 0 ? 1 : -1;
}

function pointOnSegment(a: ContactPoint, b: ContactPoint, point: ContactPoint): boolean {
  return (
    point.x >= Math.min(a.x, b.x) - EPSILON &&
    point.x <= Math.max(a.x, b.x) + EPSILON &&
    point.y >= Math.min(a.y, b.y) - EPSILON &&
    point.y <= Math.max(a.y, b.y) + EPSILON
  );
}

function segmentsIntersect(
  a: ContactPoint,
  b: ContactPoint,
  c: ContactPoint,
  d: ContactPoint,
): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && pointOnSegment(a, b, c)) return true;
  if (o2 === 0 && pointOnSegment(a, b, d)) return true;
  if (o3 === 0 && pointOnSegment(c, d, a)) return true;
  return o4 === 0 && pointOnSegment(c, d, b);
}

export function triangleOverlapsBounds(
  bounds: ContactBounds,
  a: ContactPoint,
  b: ContactPoint,
  c: ContactPoint,
): boolean {
  if ([a, b, c].some((point) => pointInsideBounds(point, bounds))) return true;

  const corners: readonly ContactPoint[] = [
    { x: bounds.left, y: bounds.top },
    { x: bounds.right, y: bounds.top },
    { x: bounds.right, y: bounds.bottom },
    { x: bounds.left, y: bounds.bottom },
  ];
  if (corners.some((point) => pointInsideTriangle(point, a, b, c))) return true;

  const triangleEdges: readonly (readonly [ContactPoint, ContactPoint])[] = [
    [a, b],
    [b, c],
    [c, a],
  ];
  const boundsEdges: readonly (readonly [ContactPoint, ContactPoint])[] = [
    [corners[0]!, corners[1]!],
    [corners[1]!, corners[2]!],
    [corners[2]!, corners[3]!],
    [corners[3]!, corners[0]!],
  ];
  return triangleEdges.some(([start, end]) =>
    boundsEdges.some(([otherStart, otherEnd]) =>
      segmentsIntersect(start, end, otherStart, otherEnd),
    ),
  );
}
