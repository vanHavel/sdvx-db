import type { Radar } from './model';

type RadarAxis = {
  key: keyof Radar;
  label: string;
  angle: number;
};

const CANVAS_SIZE = 240;
const CSS_SIZE = 120;
const CENTER = CANVAS_SIZE / 2;
const RADAR_BOUNDARY_VALUE = 10000;
const HEX_RADIUS = 54;

const AXES: RadarAxis[] = [
  { key: 'notes', label: 'NOTES', angle: -Math.PI / 2 },
  { key: 'peak', label: 'PEAK', angle: -Math.PI / 2 + Math.PI / 3 },
  { key: 'tsumami', label: 'LASER', angle: -Math.PI / 2 + 2 * Math.PI / 3 },
  { key: 'one_handed', label: '1HAND', angle: Math.PI / 2 },
  { key: 'hand_trip', label: 'HTRIP', angle: Math.PI / 2 + Math.PI / 3 },
  { key: 'tricky', label: 'TRICK', angle: Math.PI / 2 + 2 * Math.PI / 3 },
];

export function drawRadar(canvas: HTMLCanvasElement, radar: Radar, color: string): void {
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  canvas.style.width = `${CSS_SIZE}px`;
  canvas.style.height = `${CSS_SIZE}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  drawGrid(ctx);
  drawDataPolygon(ctx, radar, color);
  drawAxisLabels(ctx);
}

function drawGrid(ctx: CanvasRenderingContext2D): void {
  drawHexagon(ctx, RADAR_BOUNDARY_VALUE, 'rgba(255, 255, 255, 0.15)', 1);
  drawHexagon(ctx, RADAR_BOUNDARY_VALUE / 2, 'rgba(255, 255, 255, 0.08)', 0.5);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 0.5;

  for (const axis of AXES) {
    const [x, y] = getPoint(axis.angle, RADAR_BOUNDARY_VALUE);
    ctx.beginPath();
    ctx.moveTo(CENTER, CENTER);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
}

function drawHexagon(
  ctx: CanvasRenderingContext2D,
  value: number,
  strokeStyle: string,
  lineWidth: number,
): void {
  ctx.beginPath();
  AXES.forEach((axis, index) => {
    const [x, y] = getPoint(axis.angle, value);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.closePath();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawDataPolygon(ctx: CanvasRenderingContext2D, radar: Radar, color: string): void {
  ctx.beginPath();
  AXES.forEach((axis, index) => {
    const [x, y] = getPoint(axis.angle, radar[axis.key]);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.closePath();

  ctx.fillStyle = colorWithAlpha(color, 0.25);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawAxisLabels(ctx: CanvasRenderingContext2D): void {
  ctx.font = '18px Inter, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const labelValue = RADAR_BOUNDARY_VALUE * ((HEX_RADIUS + 22) / HEX_RADIUS);
  for (const axis of AXES) {
    const [x, y] = getPoint(axis.angle, labelValue);
    ctx.fillText(axis.label, x, y);
  }
}

function valueToRadius(value: number): number {
  if (value <= RADAR_BOUNDARY_VALUE) {
    return (value / RADAR_BOUNDARY_VALUE) * HEX_RADIUS;
  }
  // Above 10k: growth rate is halved
  const excess = value - RADAR_BOUNDARY_VALUE;
  return HEX_RADIUS + (excess / RADAR_BOUNDARY_VALUE) * HEX_RADIUS * 0.5;
}

function getPoint(angle: number, value: number): [number, number] {
  const radius = valueToRadius(value);
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)];
}

function colorWithAlpha(hex: string, alpha: number): string {
  const normalizedHex = normalizeHexColor(hex);
  if (!normalizedHex) {
    return hex;
  }

  const r = parseInt(normalizedHex.slice(1, 3), 16);
  const g = parseInt(normalizedHex.slice(3, 5), 16);
  const b = parseInt(normalizedHex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function normalizeHexColor(color: string): string | null {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color;
  }

  if (/^#[0-9a-f]{3}$/i.test(color)) {
    const [, r, g, b] = color;
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  return null;
}
