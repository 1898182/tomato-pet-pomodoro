import type { AvatarInteractiveRegion } from "../../shared/types";

const MAX_INTERACTIVE_REGIONS = 128;

export function normalizeInteractiveRegions(value: unknown): AvatarInteractiveRegion[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, MAX_INTERACTIVE_REGIONS).flatMap((region) => {
    if (!isRecord(region)) return [];
    const { x, y, width, height } = region;
    if (typeof x !== "number" || !Number.isFinite(x)
      || typeof y !== "number" || !Number.isFinite(y)
      || typeof width !== "number" || !Number.isFinite(width)
      || typeof height !== "number" || !Number.isFinite(height)) return [];
    if (width <= 0 || height <= 0) return [];
    return [{ x, y, width, height }];
  });
}

export function isPointInInteractiveRegions(point: { x: number; y: number }, regions: AvatarInteractiveRegion[]) {
  return regions.some((region) => (
    point.x >= region.x
    && point.x < region.x + region.width
    && point.y >= region.y
    && point.y < region.y + region.height
  ));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
