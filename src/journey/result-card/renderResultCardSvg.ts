import type { ResultCardModel } from './model';

const width = 1080;
const height = 1440;

/** Fixed SVG avoids DOM screenshots and only receives the already-redacted model. */
export function renderResultCardSvg(model: ResultCardModel): string {
  const monthlyRows = model.monthly.rows.map((row, index) => rowText(row, 208 + index * 48)).join('');
  const allocationRows = model.allocation.rows.map((row, index) => {
    const column = index % 2;
    const rowIndex = Math.floor(index / 2);
    const x = column === 0 ? 52 : 562;
    const y = 1022 + rowIndex * 60;
    const name = nameLines(row.name).map((line, lineIndex) =>
      `<tspan x="${x + 26}" dy="${lineIndex === 0 ? 0 : 26}">${escapeXml(line)}</tspan>`).join('');
    return `<circle cx="${x + 8}" cy="${y - 8}" r="7" fill="${row.color}"/><text x="${x + 26}" y="${y}" class="allocation-name">${name}</text><text x="${x + 450}" y="${y}" text-anchor="end" class="allocation-value">${escapeXml(row.percentage)}</text>${row.amount ? `<text x="${x + 450}" y="${y + 26}" text-anchor="end" class="allocation-detail">${escapeXml(row.amount)}</text>` : ''}`;
  }).join('');
  const bar = model.monthly.segments.reduce(({ cursor, svg }, segment) => ({
    cursor: cursor + Math.max(0, segment.ratio) * 980,
    svg: `${svg}<rect x="${cursor}" y="168" width="${Math.max(0, segment.ratio) * 980}" height="32" fill="${segment.color}"/>`,
  }), { cursor: 50, svg: '' }).svg;
  const chart = path(model.growth.points, 'plan', 570, 660, 440, 170, false);
  const baseline = path(model.growth.points, 'baseline', 570, 660, 440, 170, true);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="나의 자금 계획">
  <style>.title{font:700 48px sans-serif;fill:#173633}.section{font:400 26px sans-serif;fill:#647a76}.body{font:400 25px sans-serif;fill:#173633}.value{font:700 32px sans-serif;fill:#173633}.detail{font:400 20px sans-serif;fill:#647a76}.headline{font:700 42px sans-serif;fill:#173633}.allocation-name{font:400 24px sans-serif;fill:#173633}.allocation-value{font:700 28px sans-serif;fill:#173633}.allocation-detail{font:400 22px sans-serif;fill:#647a76}.line{stroke:#d7dfda;stroke-width:2}</style>
  <rect width="1080" height="1440" fill="#f8f6f1"/>
  <text x="50" y="76" class="title">ISF / 나의 자금 계획</text><text x="1030" y="76" text-anchor="end" class="section">${escapeXml(model.basisDate)}</text>
  <line x1="50" x2="1030" y1="116" y2="116" class="line"/>
  <text x="50" y="158" class="section">01 이번 달</text><text x="1030" y="158" text-anchor="end" class="body">${escapeXml(model.monthly.headline)}</text>
  <rect x="50" y="168" width="980" height="32" rx="16" fill="#a4b0b6"/>${bar}${monthlyRows}
  <line x1="50" x2="1030" y1="510" y2="510" class="line"/>
  <text x="50" y="560" class="section">02 미래 자산</text><text x="50" y="625" class="headline">${escapeXml(model.growth.headline)}</text>
  ${model.growth.rows.map((row, index) => `<text x="50" y="${680 + index * 52}" class="body">${escapeXml(row.label)}</text><text x="500" y="${680 + index * 52}" text-anchor="end" class="value">${escapeXml(row.value)}</text>`).join('')}
  <line x1="570" x2="1010" y1="830" y2="830" class="line"/><path d="${baseline}" fill="none" stroke="#a4b0b6" stroke-width="6" stroke-dasharray="12 12"/><path d="${chart}" fill="none" stroke="#247f79" stroke-width="8"/>
  <line x1="50" x2="1030" y1="880" y2="880" class="line"/>
  <text x="50" y="930" class="section">03 투자 배분</text><text x="50" y="980" class="headline">${escapeXml(model.allocation.headline)}</text>${allocationRows}
  <line x1="50" x2="1030" y1="1370" y2="1370" class="line"/><text x="50" y="1410" class="detail">${escapeXml(model.notes.join(' · '))}</text>
</svg>`;
}

function rowText(row: {label: string; value: string}, y: number): string {
  return `<text x="50" y="${y + 40}" class="body">${escapeXml(row.label)}</text><text x="1030" y="${y + 40}" text-anchor="end" class="value">${escapeXml(row.value)}</text>`;
}

/** Reserve at most 11 full-width glyphs per line; never stretch or shrink names. */
function nameLines(name: string): string[] {
  const letters = Array.from(new Intl.Segmenter('ko', {granularity: 'grapheme'}).segment(name), part => part.segment);
  if (letters.length <= 11) return [name];
  const second = letters.length > 22 ? [...letters.slice(11, 21), '…'] : letters.slice(11);
  return [letters.slice(0, 11).join(''), second.join('')];
}
function path(points: Array<{x: number; plan: number; baseline: number}>, key: 'plan' | 'baseline', left: number, top: number, chartWidth: number, chartHeight: number, _dashed: boolean): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${left + point.x * chartWidth} ${top + chartHeight - point[key] * chartHeight}`).join(' ');
}
function escapeXml(value: string): string {
  return value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;' })[char]!);
}
