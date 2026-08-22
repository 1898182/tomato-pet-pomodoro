export type Rectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function clampToWorkArea(x: number, y: number, width: number, height: number, area: Rectangle): { x: number; y: number } {
  const maxX = area.x + Math.max(0, area.width - width);
  const maxY = area.y + Math.max(0, area.height - height);
  return {
    x: Math.min(Math.max(x, area.x), maxX),
    y: Math.min(Math.max(y, area.y), maxY)
  };
}

export function getBottomRightBounds(width: number, height: number, area: Rectangle, inset = 12): Rectangle {
  return {
    x: area.x + area.width - width - inset,
    y: area.y + area.height - height - inset,
    width,
    height
  };
}
