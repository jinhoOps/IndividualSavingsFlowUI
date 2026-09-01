import {
  pathsForVisualGeometry,
  type VisualChartGeometry,
} from './chartMotionGeometry';

export interface MotionPaths {
  area: SVGPathElement;
  current: SVGPathElement;
  savings: SVGPathElement;
}

export function findMotionPaths(root: HTMLElement): MotionPaths | null {
  const area = root.querySelector<SVGPathElement>('[data-motion-series="area"]');
  const current = root.querySelector<SVGPathElement>('[data-motion-series="current"]');
  const savings = root.querySelector<SVGPathElement>('[data-motion-series="savings"]');
  return area === null || current === null || savings === null
    ? null
    : { area, current, savings };
}

export function setVisualFrame(
  paths: MotionPaths,
  geometry: VisualChartGeometry,
  geometryRef: { current: VisualChartGeometry | null },
): void {
  geometryRef.current = geometry;
  const values = pathsForVisualGeometry(geometry);
  paths.area.setAttribute('d', values.area);
  paths.current.setAttribute('d', values.current);
  paths.savings.setAttribute('d', values.savings);
}

export function setRevealWidth(
  clip: SVGRectElement,
  width: number,
  widthRef: { current: number },
): void {
  widthRef.current = width;
  clip.setAttribute('width', String(width));
}
