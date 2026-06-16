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

    container.innerHTML = ""; // Clear container

    if (total === 0) {
      const placeholder = document.createElement("div");
      placeholder.className = "placeholder-chart";
      placeholder.textContent = "표시할 자산 데이터가 없습니다.";
      container.appendChild(placeholder);
      return;
    }

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    let currentAngle = -90; // Top
    data.forEach((d, i) => {
      const sliceAngle = (d.value / total) * 360;
      const pathData = this._describeArc(center, center, radius, currentAngle, currentAngle + sliceAngle);
      
      const path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", pathData);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", d.color || this._getColor(i));
      path.setAttribute("stroke-width", strokeWidth.toString());
      svg.appendChild(path);

      currentAngle += sliceAngle;
    });

    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", center.toString());
    circle.setAttribute("cy", center.toString());
    circle.setAttribute("r", (radius - strokeWidth/2 - 2).toString());
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", "rgba(255,255,255,0.05)");
    circle.setAttribute("stroke-width", "1");
    svg.appendChild(circle);

    const text = document.createElementNS(svgNS, "text");
    text.setAttribute("x", center.toString());
    text.setAttribute("y", center.toString());
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("fill", "white");
    text.style.fontSize = "14px";
    text.style.fontWeight = "600";
    text.textContent = "Portfolio";
    svg.appendChild(text);

    container.appendChild(svg);
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
