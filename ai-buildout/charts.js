const GRID = '#e1e8df';
const MUTED = '#51615b';
const FONT = '11px "IBM Plex Mono", monospace';

export const COLORS = {
  green: '#18604a', orange: '#a75031', blue: '#375f91',
  light: '#9db4a2', pale: '#d1dfd3', gray: '#67766d',
};

export function legend(items, square = false) {
  return `<div class="legend">${items.map(([label, color]) =>
    `<span><i class="swatch ${square ? 'square' : ''}" style="--swatch:${color}" aria-hidden="true"></i>${label}</span>`).join('')}</div>`;
}

function makePlot(canvas, maximum, format, steps = 4) {
  const { width, height } = canvas.getBoundingClientRect();
  if (width === 0 || height === 0) return null;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.font = FONT;
  const left = Math.max(42, ctx.measureText(format(maximum)).width + 12);
  const right = width - 14;
  const top = 15;
  const bottom = height - 29;
  const y = value => bottom - (value / maximum) * (bottom - top);
  for (let index = 0; index <= steps; index += 1) {
    const value = index * maximum / steps;
    ctx.strokeStyle = GRID;
    ctx.beginPath();
    ctx.moveTo(left, y(value) + 0.5);
    ctx.lineTo(right, y(value) + 0.5);
    ctx.stroke();
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(format(value), left - 7, y(value));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  return { ctx, left, right, top, bottom, y };
}

function scaleFor(peak) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(peak, 1) / 4));
  const step = [1, 2, 2.5, 5, 10].map(m => m * magnitude).find(value => value >= peak / 4);
  return step * 4;
}

const trillions = billions => `$${Number((billions / 1000).toFixed(3))}T`;

export function plotRevenue(canvas, series, margin, hurdle, demand, min, max) {
  const maximum = scaleFor(Math.max(demand, ...series.map(line => line.values[0])) * 1.04);
  const plot = makePlot(canvas, maximum, trillions);
  if (!plot) return;
  const { ctx, left, right, top, bottom, y } = plot;
  const x = value => left + (right - left) * (value - min) / (max - min);
  const tickStep = (max - min) > 70 ? 20 : 10;
  for (let tick = Math.ceil(min / tickStep) * tickStep; tick <= max; tick += tickStep) {
    ctx.fillStyle = MUTED;
    ctx.fillText(`${tick}%`, x(tick), bottom + 8);
  }
  const referenceLines = [
    [left, y(demand), right, y(demand), COLORS.blue],
    [x(margin), top, x(margin), bottom, COLORS.gray],
  ];
  ctx.setLineDash([5, 5]);
  for (const [x1, y1, x2, y2, color] of referenceLines) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const line of series) {
    ctx.strokeStyle = line.color;
    ctx.lineWidth = line.active ? 2.8 : 1.6;
    ctx.beginPath();
    line.values.forEach((value, index) => {
      const position = x(index + min);
      if (index === 0) ctx.moveTo(position, y(value));
      else ctx.lineTo(position, y(value));
    });
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.fillStyle = COLORS.green;
  ctx.arc(x(margin), y(hurdle), 5, 0, 2 * Math.PI);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  return pixel => Math.max(min, Math.min(max, Math.round(min + (max - min) * (pixel - left) / (right - left))));
}

export function plotSpend(canvas, rows) {
  const maximum = scaleFor(Math.max(...rows.map(row => row.investment)) * 1.05);
  const plot = makePlot(canvas, maximum, trillions);
  if (!plot) return;
  const { ctx, left, right, bottom, y } = plot;
  const band = (right - left) / rows.length;
  const width = Math.min(46, band * 0.57);
  rows.forEach((row, index) => {
    const x = left + band * (index + 0.5);
    ctx.fillStyle = index < 2 ? COLORS.orange : COLORS.green;
    ctx.fillRect(x - width / 2, y(row.investment), width, bottom - y(row.investment));
    ctx.fillStyle = MUTED;
    ctx.fillText(row.year, x, bottom + 8);
  });
}

export function plotGpuRent(canvas, profile) {
  const serviceLife = profile.at(-1).end;
  const horizon = Math.ceil(Math.max(6, serviceLife));
  const peak = Math.max(100, ...profile.map(period => 100 * period.rent));
  const plot = makePlot(canvas, 100 * Math.ceil(peak / 100), value => `${value}%`);
  if (!plot) return;
  const { ctx, left, right, bottom, y } = plot;
  const x = age => left + (right - left) * age / horizon;
  const tickStep = horizon > 10 ? 4 : horizon > 6 ? 2 : 1;
  for (let age = 0; age <= horizon; age += tickStep) {
    ctx.fillStyle = MUTED;
    ctx.fillText(`${age} yr`, x(age), bottom + 8);
  }

  ctx.strokeStyle = COLORS.orange;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(x(0), y(100));
  ctx.lineTo(x(6), y(0));
  ctx.stroke();

  ctx.strokeStyle = COLORS.green;
  ctx.setLineDash([]);
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(x(0), y(100));
  for (const period of profile) {
    const rentY = y(100 * period.rent);
    ctx.lineTo(x(period.start), rentY);
    ctx.lineTo(x(period.end), rentY);
  }
  ctx.stroke();
  ctx.fillStyle = COLORS.green;
  ctx.beginPath();
  ctx.arc(x(serviceLife), y(100 * profile.at(-1).rent), 4, 0, 2 * Math.PI);
  ctx.fill();
}
