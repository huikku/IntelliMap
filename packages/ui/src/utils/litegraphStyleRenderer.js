/**
 * LiteGraph-Style Node Renderer for IntelliMap
 *
 * Renders nodes with:
 * - Colored title bar at top
 * - Embedded sparklines and metrics
 * - Dynamic connection ports (top/bottom OR left/right based on layout)
 */

export class LiteGraphStyleNodeRenderer {
  constructor(options = {}) {
    this.width = options.width || 180;
    this.height = options.height || 80;
    this.titleHeight = options.titleHeight || 22;
    this.portSize = options.portSize || 6;
    this.portDirection = options.portDirection || 'vertical'; // 'vertical' or 'horizontal'
    this.cache = new Map(); // Cache rendered images
  }

  /**
   * Set port direction based on layout algorithm
   */
  setPortDirection(direction) {
    this.portDirection = direction;
    this.cache.clear(); // Clear cache when direction changes
  }

  /**
   * Main render function
   */
  render(nodeData, zoomLevel = 1) {
    // Create cache key
    const cacheKey = `${nodeData.id}_${Math.round(zoomLevel * 10)}_${this.portDirection}`;

    // Return cached version if available
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Create fresh canvas for crisp rendering
    const canvas = document.createElement('canvas');
    const dpr = 3; // Fixed 3x scale for super crisp rendering

    // Set canvas size with DPI scaling
    canvas.width = this.width * dpr;
    canvas.height = this.height * dpr;
    canvas.style.width = this.width + 'px';
    canvas.style.height = this.height + 'px';

    const ctx = canvas.getContext('2d', { alpha: true });

    // Enable image smoothing for better quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.scale(dpr, dpr);

    // Store context for drawing methods
    this.ctx = ctx;
    this.canvas = canvas;

    // Draw components
    this.drawBackground();
    this.drawTitleBar(nodeData);
    this.drawContent(nodeData, zoomLevel);
    this.drawConnectionPorts(nodeData);

    const dataURL = canvas.toDataURL('image/png');

    // Cache the result (limit cache size)
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(cacheKey, dataURL);

    return dataURL;
  }

  /**
   * Draw node background
   */
  drawBackground() {
    // Main body background
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, this.titleHeight, this.width, this.height - this.titleHeight);

    // Outer border
    this.ctx.strokeStyle = '#2a2a2a';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(0, 0, this.width, this.height);
  }

  /**
   * Draw colored title bar with icon and badges
   */
  drawTitleBar(data) {
    const titleColor = this.getTitleColor(data);

    // Title bar gradient background
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.titleHeight);
    gradient.addColorStop(0, titleColor);
    gradient.addColorStop(1, this.darken(titleColor, 0.2));

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.titleHeight);

    // Title bar bottom border
    this.ctx.strokeStyle = this.darken(titleColor, 0.4);
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.titleHeight);
    this.ctx.lineTo(this.width, this.titleHeight);
    this.ctx.stroke();

    // Icon
    this.ctx.font = '12px Arial';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textBaseline = 'middle';
    const icon = this.getIcon(data);
    this.ctx.fillText(icon, 5, this.titleHeight / 2);

    // Title text
    this.ctx.font = 'bold 11px monospace';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textBaseline = 'middle';

    // Truncate long titles
    const maxTitleWidth = this.width - 50;
    const truncatedTitle = this.truncateText(data.label || data.id, maxTitleWidth);
    this.ctx.fillText(truncatedTitle, 20, this.titleHeight / 2);

    // Status badges (right side) - simplified
    let badgeX = this.width - 6;

    if (data.status?.hotspot) {
      this.ctx.font = '11px Arial';
      this.ctx.fillText('🔥', badgeX - 14, this.titleHeight / 2);
      badgeX -= 18;
    }

    if (data.changed) {
      this.ctx.font = '11px Arial';
      this.ctx.fillText('📝', badgeX - 14, this.titleHeight / 2);
    }
  }

  /**
   * Draw content area with metrics
   */
  drawContent(data, zoomLevel) {
    const padding = 8;
    let y = this.titleHeight + padding;

    if (zoomLevel < 0.5) {
      this.renderCompactContent(data, y, padding);
    } else if (zoomLevel < 1.5) {
      this.renderStandardContent(data, y, padding);
    } else {
      this.renderExpandedContent(data, y, padding);
    }
  }

  /**
   * Compact view for low zoom
   */
  renderCompactContent(data, startY, padding) {
    this.ctx.fillStyle = '#9a9a9a';
    this.ctx.font = '8px monospace';
    this.ctx.textBaseline = 'top';

    this.ctx.fillText(`LOC: ${data.metrics?.loc || 0}`, padding, startY);
    this.ctx.fillText(`Cx: ${data.metrics?.complexity || 0}`, padding, startY + 10);
  }

  /**
   * Standard view for mid zoom - SIMPLIFIED
   */
  renderStandardContent(data, startY, padding) {
    let y = startY;

    // Just show LOC and Complexity as simple text
    const loc = Math.round(data.metrics?.loc || 0);
    const complexity = Math.round(data.metrics?.complexity || 0);

    this.ctx.fillStyle = '#b0b0b0';
    this.ctx.font = '10px monospace';
    this.ctx.textBaseline = 'top';

    this.ctx.fillText(`LOC: ${loc}`, padding, y);
    y += 14;

    this.ctx.fillText(`Complexity: ${complexity}`, padding, y);
    y += 14;

    // Show fan-in/fan-out
    const fanin = data.metrics?.fanin || 0;
    const fanout = data.metrics?.fanout || 0;

    this.ctx.fillStyle = '#8a8a8a';
    this.ctx.font = '9px monospace';
    this.ctx.fillText(`In: ${fanin} | Out: ${fanout}`, padding, y);
  }

  /**
   * Expanded view for high zoom
   */
  renderExpandedContent(data, startY, padding) {
    let y = startY;

    // Performance indicator
    if (data.metrics?.avgTime) {
      this.ctx.fillStyle = '#6a6a6a';
      this.ctx.font = '9px monospace';
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(`Avg Time: ${data.metrics.avgTime}ms`, padding, y);
      y += 14;
    }

    // Standard content
    this.renderStandardContent(data, y, padding);

    // Additional metrics
    y = this.height - 30;
    this.ctx.fillStyle = '#4a4a4a';
    this.ctx.font = '8px monospace';
    this.ctx.fillText(
      `Fanin: ${data.metrics?.fanin || 0}  Fanout: ${data.metrics?.fanout || 0}  Depth: ${data.metrics?.depth || 0}`,
      padding,
      y
    );
  }

  /**
   * Draw connection ports based on layout direction
   */
  drawConnectionPorts(data) {
    const inputCount = data.metrics?.fanin || 0;
    const outputCount = data.metrics?.fanout || 0;

    if (this.portDirection === 'vertical') {
      // Vertical layout: input ports on top, output ports on bottom
      this.drawVerticalPorts(inputCount, outputCount);
    } else {
      // Horizontal layout: input ports on left, output ports on right
      this.drawHorizontalPorts(inputCount, outputCount);
    }
  }

  /**
   * Draw ports for vertical layout (top/bottom)
   */
  drawVerticalPorts(inputCount, outputCount) {
    // Input ports (top edge)
    const maxInputPorts = Math.min(inputCount, 5);
    for (let i = 0; i < maxInputPorts; i++) {
      const x = this.width * (i + 1) / (maxInputPorts + 1);
      this.drawPort(x, 0, 'input');
    }

    if (inputCount > 5) {
      const x = this.width * 0.5;
      this.drawPortLabel(x, 12, `+${inputCount - 5}`);
    }

    // Output ports (bottom edge)
    const maxOutputPorts = Math.min(outputCount, 5);
    for (let i = 0; i < maxOutputPorts; i++) {
      const x = this.width * (i + 1) / (maxOutputPorts + 1);
      this.drawPort(x, this.height, 'output');
    }

    if (outputCount > 5) {
      const x = this.width * 0.5;
      this.drawPortLabel(x, this.height - 8, `+${outputCount - 5}`);
    }
  }

  /**
   * Draw ports for horizontal layout (left/right)
   */
  drawHorizontalPorts(inputCount, outputCount) {
    // Input ports (left edge)
    const maxInputPorts = Math.min(inputCount, 5);
    for (let i = 0; i < maxInputPorts; i++) {
      const y = this.titleHeight + (this.height - this.titleHeight) * (i + 1) / (maxInputPorts + 1);
      this.drawPort(0, y, 'input');
    }

    if (inputCount > 5) {
      const y = this.titleHeight + (this.height - this.titleHeight) * 0.5;
      this.drawPortLabel(15, y + 3, `+${inputCount - 5}`);
    }

    // Output ports (right edge)
    const maxOutputPorts = Math.min(outputCount, 5);
    for (let i = 0; i < maxOutputPorts; i++) {
      const y = this.titleHeight + (this.height - this.titleHeight) * (i + 1) / (maxOutputPorts + 1);
      this.drawPort(this.width, y, 'output');
    }

    if (outputCount > 5) {
      const y = this.titleHeight + (this.height - this.titleHeight) * 0.5;
      this.drawPortLabel(this.width - 25, y + 3, `+${outputCount - 5}`);
    }
  }

  /**
   * Draw a single port dot
   */
  drawPort(x, y, type) {
    const isInput = type === 'input';

    // Port circle
    this.ctx.beginPath();
    this.ctx.arc(x, y, this.portSize / 2, 0, 2 * Math.PI);
    this.ctx.fillStyle = isInput ? '#4a9eff' : '#4ade80';
    this.ctx.fill();

    // White border
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }

  /**
   * Draw port count label
   */
  drawPortLabel(x, y, text) {
    this.ctx.fillStyle = '#6a6a6a';
    this.ctx.font = 'bold 8px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, x, y);
  }

  /**
   * Draw sparkline chart
   */
  drawSparkline(values, x, y, width, height, color = '#8b7355') {
    if (!values || values.length < 2) return;

    const max = Math.max(...values, 1);
    const min = Math.min(...values);
    const range = max - min || 1;
    const stepX = width / (values.length - 1);

    // Line
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();

    values.forEach((value, i) => {
      const px = x + i * stepX;
      const py = y + height - ((value - min) / range) * height;

      if (i === 0) {
        this.ctx.moveTo(px, py);
      } else {
        this.ctx.lineTo(px, py);
      }
    });

    this.ctx.stroke();

    // Fill area under line
    this.ctx.lineTo(x + width, y + height);
    this.ctx.lineTo(x, y + height);
    this.ctx.closePath();
    this.ctx.fillStyle = color + '22'; // 22 = ~13% opacity
    this.ctx.fill();
  }

  /**
   * Draw horizontal bar chart
   */
  drawBar(value, max, x, y, width, height, fillColor = '#4a9eff', bgColor = '#2a2a2a') {
    // Background
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(x, y, width, height);

    // Filled portion
    const fillWidth = (value / max) * width;
    this.ctx.fillStyle = fillColor;
    this.ctx.fillRect(x, y, fillWidth, height);

    // Border
    this.ctx.strokeStyle = '#3a3a3a';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, width, height);
  }

  /**
   * Get title bar color based on node type
   */
  getTitleColor(data) {
    const lang = data.lang || 'unknown';
    const env = data.env || 'unknown';

    const colors = {
      // TypeScript
      'ts-frontend': '#5a7a9a',
      'ts-backend': '#4a7a6a',

      // JavaScript
      'js-frontend': '#9a9a5a',
      'js-backend': '#7a9a5a',

      // Python
      'py-backend': '#5a6a9a',
      'py-frontend': '#7a5a9a',

      // By environment only
      'frontend': '#5a5a8a',
      'backend': '#5a8a5a',
      'test': '#9a5a7a',

      // Default
      'default': '#4a4a4a'
    };

    return colors[`${lang}-${env}`] || colors[env] || colors.default;
  }

  /**
   * Get icon based on node environment/type
   */
  getIcon(data) {
    const env = data.env || '';
    const label = (data.label || '').toLowerCase();

    // Check file name patterns first
    if (label.includes('test') || label.includes('spec')) return '🧪';
    if (label.includes('config')) return '⚙️';
    if (label.includes('util') || label.includes('helper')) return '🔧';
    if (label.includes('type') || label.includes('interface')) return '📋';
    if (label.includes('api') || label.includes('service')) return '🔌';
    if (label.includes('component')) return '🎨';

    // Fall back to environment
    const icons = {
      'frontend': '🎨',
      'backend': '⚙️',
      'test': '🧪'
    };

    return icons[env] || '📄';
  }

  /**
   * Get color for complexity bar
   */
  getComplexityColor(complexity) {
    if (complexity > 75) return '#ef4444'; // Red
    if (complexity > 50) return '#f59e0b'; // Orange
    if (complexity > 25) return '#eab308'; // Yellow
    return '#4ade80'; // Green
  }

  /**
   * Get color for coverage bar
   */
  getCoverageColor(coverage) {
    if (coverage > 80) return '#4ade80'; // Green
    if (coverage > 60) return '#eab308'; // Yellow
    if (coverage > 40) return '#f59e0b'; // Orange
    return '#ef4444'; // Red
  }

  /**
   * Darken a hex color
   */
  darken(color, amount) {
    const num = parseInt(color.slice(1), 16);
    const r = Math.max(0, (num >> 16) - Math.floor(255 * amount));
    const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.floor(255 * amount));
    const b = Math.max(0, (num & 0x0000FF) - Math.floor(255 * amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  /**
   * Truncate text to fit width
   */
  truncateText(text, maxWidth) {
    this.ctx.font = 'bold 11px monospace';

    if (this.ctx.measureText(text).width <= maxWidth) {
      return text;
    }

    let truncated = text;
    while (this.ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }

    return truncated + '...';
  }
}

/**
 * Cached renderer instance with cache management
 */
class CachedNodeRenderer {
  constructor(options) {
    this.renderer = new LiteGraphStyleNodeRenderer(options);
    this.cache = new Map();
    this.maxCacheSize = 500;
  }

  setPortDirection(direction) {
    // Clear cache when changing port direction
    this.cache.clear();
    this.renderer.setPortDirection(direction);
  }

  render(nodeData, zoomLevel) {
    // Round zoom to 0.1 precision for caching
    const zoomKey = Math.round(zoomLevel * 10) / 10;
    const cacheKey = `${nodeData.id}_${zoomKey}_${this.renderer.portDirection}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const image = this.renderer.render(nodeData, zoomLevel);
    this.cache.set(cacheKey, image);

    // Limit cache size (FIFO eviction)
    if (this.cache.size > this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    return image;
  }

  clearCache() {
    this.cache.clear();
  }
}

// Export singleton with caching
export const nodeRenderer = new CachedNodeRenderer({
  width: 240,
  height: 120,
  titleHeight: 30,
  portSize: 10
});
