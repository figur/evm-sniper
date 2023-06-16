const blessed = require('blessed'),
      Node = blessed.Node,
      Canvas = require('./canvas'),
      { arrayMax, getColorCode } = require('./utils'),
      InnerCanvas = require('./drawille-canvas').Canvas;

function Line(options) {
  if (!(this instanceof Node)) {
    return new Line(options);
  }

  options.showNthLabel = options.showNthLabel || 1;
  options.style = options.style || {};
  options.xLabelPadding = options.xLabelPadding || 5;
  options.xPadding = options.xPadding || 10;
  options.numYLabels = options.numYLabels || 5;
  options.legend = options.legend || {};
  options.wholeNumbersOnly = options.wholeNumbersOnly || false;
  options.minY = options.minY || 0;

  Canvas.call(this, options);
}

Line.prototype.calcSize = function () {
 this.canvasSize = { width: this.width * 2, height: this.height * 4 };
}

Line.prototype.__proto__ = Canvas.prototype;

Line.prototype.type = 'line';

Line.prototype.resize = function (data) {
  this.calcSize();
  this._canvas = new InnerCanvas(this.canvasSize.width, this.canvasSize.height);
  this.ctx = this._canvas.getContext();
}

Line.prototype.setData = function (data) {
  if (!this.ctx) {
    throw 'error: canvas context does not exist. setData() for line charts must be called after the chart has been added to the screen via screen.append()';
  }

  // compatability with older API
  if (!Array.isArray(data)) data = [data];

  var self = this;
  var xLabelPadding = this.options.xLabelPadding;
  var yLabelPadding = 6;
  var xPadding = this.options.xPadding;
  var yPadding = 8;
  var c = this.ctx;
  var labels = data[0].x;

  function addLegend() {
    if (!self.options.showLegend) return;
    if (self.legend) self.remove(self.legend);
    var legendWidth = self.options.legend.width || 15;
    self.legend = blessed.box({
      height: data.length + 2,
      top: 1,
      width: legendWidth + 2,
      left: self.width - legendWidth - 2,
      content: '',
      tags: true,
      border: {
        type: 'line',
        fg: 'black',
      },
      style: {
        fg: 'blue',
      },
      screen: self.screen,
    });

    var legendText = '';
    var maxChars = legendWidth;
    for (var i = 0; i < data.length; i++) {
      var style = data[i].style || {};
      var color = getColorCode(style.line || self.options.style.line);
      legendText += '{' + color + '-fg}' + data[i].title.substring(0, maxChars) + '{/' + color + '-fg}\r\n';
    }
    self.legend.setContent(legendText);
    self.append(self.legend);
  }

  function getMax(v, i) {
    return parseFloat(v);
  }

  //for some reason this loop does not properly get the maxY if there are multiple datasets (was doing 4 datasets that differred wildly)
  function getMaxY() {
    var max = 0;
    var setMax = [];

    for (var i = 0; i < data.length; i++) {
      if (data[i].y.length) {
        setMax[i] = arrayMax(data[i].y, getMax);
      }

      for (var j = 0; j < data[i].y.length; j++) {
        if (data[i].y[j] > max) {
          max = data[i].y[j];
        }
      }
    }

    var m = arrayMax(setMax, getMax);
    max = m * 1.2;
    max *= 1.2;
    if (self.options.maxY) {
      return Math.max(max, self.options.maxY);
    }
    if (max === self.options.minY) {
      return 10;
    }
    return max;
  }

  function formatYLabel(value, max, min, numLabels, wholeNumbersOnly, abbreviate) {
    var fixed = (max / numLabels < 1 && value != 0 && !wholeNumbersOnly) ? 2 : 0;
    var res = value.toFixed(fixed);
    if (typeof abbreviate === 'function') {
      return abbreviate(res);
    } else {
      return res;
    }
  }

  var yLabelIncrement = (getMaxY() - this.options.minY) / this.options.numYLabels;
  if (this.options.wholeNumbersOnly) yLabelIncrement = Math.floor(yLabelIncrement);
  //if (getMaxY()>=10) {
  //  yLabelIncrement = yLabelIncrement + (10 - yLabelIncrement % 10);
  //}
  //yLabelIncrement = Math.max(yLabelIncrement, 1); // should not be zero
  if (yLabelIncrement == 0) yLabelIncrement = 1;

  function getMaxXLabelPadding(numLabels, wholeNumbersOnly, abbreviate, min) {
    var maxY = getMaxY();
    var maxLabel = 0;
    for (var i = min; i < maxY; i += yLabelIncrement) {
      maxLabel = Math.max(maxLabel, formatYLabel(i, maxY, min, numLabels, wholeNumbersOnly, abbreviate).length);
    }
    return 2 * (maxLabel + 1);
  }

  var maxPadding = getMaxXLabelPadding(this.options.numYLabels, this.options.wholeNumbersOnly, this.options.abbreviate, this.options.minY);
  if (xLabelPadding < maxPadding) {
    xLabelPadding = maxPadding;
  };

  if ((xPadding - xLabelPadding) < 0) {
    xPadding = xLabelPadding;
  }

  function getMaxX() {
    var maxLength = 0;

    for (var i = 0; i < labels.length; i++) {
      if (labels[i] === undefined) {
        console.log('label[' + i + '] is undefined');
      } else if (labels[i].length > maxLength) {
        maxLength = labels[i].length;
      }
    }

    return maxLength;
  }

  function getXPixel(val) {
    return ((self.canvasSize.width - xPadding) / labels.length) * val + (xPadding * 1.0) + 2;
  }

  function getYPixel(val, minY) {
    var res = self.canvasSize.height - yPadding - (((self.canvasSize.height - yPadding) / (getMaxY() - minY)) * (val - minY));
    res -= 2; //to separate the baseline and the data line to separate chars so canvas will show separate colors
    return res;
  }

  // Draw the line graph
  function drawLine(values, style, minY) {
    style = style || {};
    var color = self.options.style.line;
    c.strokeStyle = style.line || color;

    c.moveTo(0, 0);
    c.beginPath();
    c.lineTo(getXPixel(0), getYPixel(values[0], minY));

    for (var k = 1; k < values.length; k++) {
      c.lineTo(getXPixel(k), getYPixel(values[k], minY));
    }

    c.stroke();
  }

  addLegend();

  c.fillStyle = this.options.style.text;
  c.clearRect(0, 0, this.canvasSize.width, this.canvasSize.height);

  // Draw the Y value texts
  var maxY = getMaxY();
  for (var i = this.options.minY; i < maxY; i += yLabelIncrement) {
    c.fillText(formatYLabel(i, maxY, this.options.minY, this.options.numYLabels, this.options.wholeNumbersOnly, this.options.abbreviate), xPadding - xLabelPadding, getYPixel(i, this.options.minY));
  }

  for (var h = 0; h < data.length; h++) {
    drawLine(data[h].y, data[h].style, this.options.minY);
  }

  c.strokeStyle = this.options.style.baseline;

  // Draw the axises
  c.beginPath();

  c.lineTo(xPadding, 0);
  c.lineTo(xPadding, this.canvasSize.height - yPadding);
  c.lineTo(this.canvasSize.width, this.canvasSize.height - yPadding);

  c.stroke();

  // Draw the X value texts
  var charsAvailable = (this.canvasSize.width - xPadding) / 2;
  var maxLabelsPossible = charsAvailable / (getMaxX() + 2);
  var pointsPerMaxLabel = Math.ceil(data[0].y.length / maxLabelsPossible);
  var showNthLabel = this.options.showNthLabel;
  if (showNthLabel < pointsPerMaxLabel) {
    showNthLabel = pointsPerMaxLabel;
  }

  for (var i = 0; i < labels.length; i += showNthLabel) {
    if ((getXPixel(i) + (labels[i].length * 2)) <= this.canvasSize.width) {
      c.fillText(labels[i], getXPixel(i), this.canvasSize.height - yPadding + yLabelPadding);
    }
  }
}

module.exports = Line;
