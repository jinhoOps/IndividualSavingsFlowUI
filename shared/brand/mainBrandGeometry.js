export const MAIN_BRAND_GEOMETRY = {
  viewBox: 512,
  background: { from: '#ea5b2a', to: '#1e8b7c', radius: 96 },
  baseline: { x: 150, y: 334, width: 212, height: 38 },
  bars: [
    { id: 'bar-1', x: 150, y: 252, width: 48, height: 82 },
    { id: 'bar-2', x: 232, y: 191, width: 48, height: 143 },
    { id: 'bar-3', x: 314, y: 146, width: 48, height: 188 },
  ],
  trend: {
    stroke: '#173a3a',
    points: [
      { id: 'bar-1', x: 174, y: 236 },
      { id: 'dip-1-2', x: 215, y: 264 },
      { id: 'bar-2', x: 256, y: 204 },
      { id: 'variance-2-3', x: 297, y: 216 },
      { id: 'bar-3-final', x: 338, y: 132 },
    ],
  },
};

const BAR_FILL = '#ffffff';
const BASELINE_OPACITY = 0.85;
const TREND_STROKE_WIDTH = 14;
const TERMINAL_DOT_RADIUS = 14;

export function trendPointsAttribute() {
  return MAIN_BRAND_GEOMETRY.trend.points.map(({ x, y }) => `${x},${y}`).join(' ');
}

export function rectanglePath({ x, y, width, height }) {
  return `M${x} ${y}h${width}v${height}H${x}z`;
}

export function boundsAttribute({ x, y, width, height }) {
  return `${x} ${y} ${width} ${height}`;
}

export function trendBounds() {
  const points = MAIN_BRAND_GEOMETRY.trend.points;
  const xValues = points.map(({ x }) => x);
  const yValues = points.map(({ y }) => y);
  const minimumX = Math.min(...xValues);
  const minimumY = Math.min(...yValues);
  return {
    x: minimumX,
    y: minimumY,
    width: Math.max(...xValues) - minimumX,
    height: Math.max(...yValues) - minimumY,
  };
}

export function terminalDotBounds() {
  const terminalPoint = MAIN_BRAND_GEOMETRY.trend.points.at(-1);
  return {
    x: terminalPoint.x - TERMINAL_DOT_RADIUS,
    y: terminalPoint.y - TERMINAL_DOT_RADIUS,
    width: TERMINAL_DOT_RADIUS * 2,
    height: TERMINAL_DOT_RADIUS * 2,
  };
}

export function renderMainBrandSvg(size) {
  const { viewBox, background, baseline, bars, trend } = MAIN_BRAND_GEOMETRY;
  const colorData = `${background.from} ${background.to} ${trend.stroke}`;
  const trendPointData = trendPointsAttribute();
  const terminalPoint = trend.points.at(-1);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${viewBox} ${viewBox}" data-brand-colors="${colorData}">
  <defs><linearGradient id="main-brand-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${background.from}"/><stop offset="100%" stop-color="${background.to}"/></linearGradient></defs>
  <rect data-brand-background="" width="${viewBox}" height="${viewBox}" rx="${background.radius}" fill="url(#main-brand-gradient)"/>
  <path data-brand-baseline="" data-brand-essential-bounds="${boundsAttribute(baseline)}" d="${rectanglePath(baseline)}" fill="${BAR_FILL}" opacity="${BASELINE_OPACITY}"/>
  ${bars.map((bar) => `<path data-brand-bar="${bar.id}" data-brand-essential-bounds="${boundsAttribute(bar)}" d="${rectanglePath(bar)}" fill="${BAR_FILL}"/>`).join('\n  ')}
  <polyline data-brand-trend="${trendPointData}" data-brand-essential-bounds="${boundsAttribute(trendBounds())}" points="${trendPointData}" fill="none" stroke="${trend.stroke}" stroke-width="${TREND_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>
  <circle data-brand-terminal-dot="" data-brand-essential-bounds="${boundsAttribute(terminalDotBounds())}" cx="${terminalPoint.x}" cy="${terminalPoint.y}" r="${TERMINAL_DOT_RADIUS}" fill="${trend.stroke}"/>
</svg>\n`;
}

export const MAIN_BRAND_STYLE = {
  barFill: BAR_FILL,
  baselineOpacity: BASELINE_OPACITY,
  trendStrokeWidth: TREND_STROKE_WIDTH,
  terminalDotRadius: TERMINAL_DOT_RADIUS,
};
