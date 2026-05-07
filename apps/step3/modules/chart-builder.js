/**
 * Step 3: Simple SVG Donut Chart Builder
 */

export const IsfChartBuilder = {
  /**
   * 도넛 차트를 생성하여 컨테이너에 삽입합니다.
   * @param {HTMLElement} container 
   * @param {Array} data [{ label, value, color }]
   */
  renderDonutChart(container, data) {
    if (!container) return;
    
    const size = 240;
    const center = size / 2;
    const radius = 80;
    const strokeWidth = 40;
    const total = data.reduce((sum, d) => sum + d.value, 0);

    if (total === 0) {
      container.innerHTML = '<div class="placeholder-chart">표시할 자산 데이터가 없습니다.</div>';
      return;
    }

    let currentAngle = -90; // Top
    const paths = data.map((d, i) => {
      const sliceAngle = (d.value / total) * 360;
      const path = this._describeArc(center, center, radius, currentAngle, currentAngle + sliceAngle);
      currentAngle += sliceAngle;
      return `<path d="${path}" fill="none" stroke="${d.color || this._getColor(i)}" stroke-width="${strokeWidth}" />`;
    }).join('');

    container.innerHTML = `
      <svg width="100%" height="100%" viewBox="0 0 ${size} ${size}" preserveAspectRatio="xMidYMid meet">
        ${paths}
        <circle cx="${center}" cy="${center}" r="${radius - strokeWidth/2 - 2}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
        <text x="${center}" y="${center}" text-anchor="middle" dominant-baseline="middle" fill="white" style="font-size: 14px; font-weight: 600;">
          Portfolio
        </text>
      </svg>
    `;
  },

  _describeArc(x, y, radius, startAngle, endAngle) {
    const start = this._polarToCartesian(x, y, radius, endAngle);
    const end = this._polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
      "M", start.x, start.y, 
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
  },

  _polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  },

  _getColor(index) {
    const colors = ['#ea5b2a', '#1e8b7c', '#3175b6', '#5d4fb3', '#c9573c', '#8c3d65'];
    return colors[index % colors.length];
  }
};
