import {
  boundsAttribute,
  MAIN_BRAND_GEOMETRY,
  MAIN_BRAND_STYLE,
  rectanglePath,
  terminalDotBounds,
  trendBounds,
  trendPointsAttribute,
} from '../../../../shared/brand/mainBrandGeometry.js';

export function MainBrandIcon() {
  const { viewBox, background, baseline, bars, trend } = MAIN_BRAND_GEOMETRY;
  const trendPointData = trendPointsAttribute();
  const terminalPoint = trend.points.at(-1)!;

  return (
    <svg viewBox={`0 0 ${viewBox} ${viewBox}`} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="main-brand-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={background.from} />
          <stop offset="100%" stopColor={background.to} />
        </linearGradient>
      </defs>
      <rect data-brand-background width={viewBox} height={viewBox} rx={background.radius} fill="url(#main-brand-gradient)" />
      <path
        data-brand-baseline
        data-brand-essential-bounds={boundsAttribute(baseline)}
        d={rectanglePath(baseline)}
        fill={MAIN_BRAND_STYLE.barFill}
        opacity={MAIN_BRAND_STYLE.baselineOpacity}
      />
      {bars.map((bar) => (
        <path
          key={bar.id}
          data-brand-bar={bar.id}
          data-brand-essential-bounds={boundsAttribute(bar)}
          d={rectanglePath(bar)}
          fill={MAIN_BRAND_STYLE.barFill}
        />
      ))}
      <polyline
        data-brand-trend={trendPointData}
        data-brand-essential-bounds={boundsAttribute(trendBounds())}
        points={trendPointData}
        fill="none"
        stroke={trend.stroke}
        strokeWidth={MAIN_BRAND_STYLE.trendStrokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        data-brand-terminal-dot
        data-brand-essential-bounds={boundsAttribute(terminalDotBounds())}
        cx={terminalPoint.x}
        cy={terminalPoint.y}
        r={MAIN_BRAND_STYLE.terminalDotRadius}
        fill={trend.stroke}
      />
    </svg>
  );
}
