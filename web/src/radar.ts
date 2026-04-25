import type { Radar } from './model';

type RadarAxis = {
  key: keyof Radar;
  label: string;
  angle: number;
  color: string;
};

const CANVAS_SIZE = 240;
const CSS_SIZE = 120;
const CENTER = CANVAS_SIZE / 2;
const RADAR_BOUNDARY_VALUE = 10000;
const HEX_RADIUS = 54;

const AXES: RadarAxis[] = [
  { key: 'notes', label: 'NOTES', angle: -Math.PI / 2, color: '#00e5ff' },
  { key: 'peak', label: 'PEAK', angle: -Math.PI / 6, color: '#ff2d55' },
  { key: 'tsumami', label: 'TSUMAMI', angle: Math.PI / 6, color: '#ff00ff' },
  { key: 'tricky', label: 'TRICKY', angle: Math.PI / 2, color: '#ffff00' },
  { key: 'hand_trip', label: 'HAND TRIP', angle: 5 * Math.PI / 6, color: '#a855f7' },
  { key: 'one_handed', label: 'ONE HAND', angle: 7 * Math.PI / 6, color: '#00ff00' },
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
  drawDataPolygon(ctx, radar);
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

function drawDataPolygon(ctx: CanvasRenderingContext2D, radar: Radar): void {
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

  // Create a radial gradient: Natural Sea Blue -> Violet/Magenta leakage
  // The transition starts earlier to allow violet to 'leak' inside the scope
  const gradient = ctx.createRadialGradient(CENTER, CENTER, 0, CENTER, CENTER, HEX_RADIUS * 1.5);
  gradient.addColorStop(0, 'rgba(0, 110, 255, 0.85)');    // Deep Sea Blue center
  gradient.addColorStop(0.45, 'rgba(168, 85, 247, 0.9)'); // Violet leakage starts at 45%
  gradient.addColorStop(0.75, 'rgba(236, 72, 153, 0.9)'); // Magenta transitions towards boundary
  gradient.addColorStop(1, 'rgba(255, 0, 100, 0.9)');    // Deep Magenta extremities

  ctx.fillStyle = gradient;
  ctx.fill();
  
  // No stroke for in-game look
}

function drawAxisLabels(ctx: CanvasRenderingContext2D): void {
  ctx.font = 'bold 15px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const labelValue = RADAR_BOUNDARY_VALUE * ((HEX_RADIUS + 24) / HEX_RADIUS);
  for (const axis of AXES) {
    const [x, y] = getPoint(axis.angle, labelValue);
    ctx.fillStyle = axis.color;
    
    const lines = axis.label.split(' ');
    if (lines.length === 1) {
      ctx.fillText(axis.label, x, y);
    } else {
      // Draw multi-line labels (like ONE HAND)
      const lineHeight = 16;
      const startY = y - (lineHeight * (lines.length - 1)) / 2;
      lines.forEach((line, i) => {
        ctx.fillText(line, x, startY + i * lineHeight);
      });
    }
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
