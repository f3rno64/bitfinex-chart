import _isFunction from 'lodash/isFunction';
import _isFinite from 'lodash/isFinite';
import _last from 'lodash/last';
import _max from 'lodash/max';
import _min from 'lodash/min';
import randomColor from 'randomcolor';
import { Candle } from 'bfx-api-node-models';
import { TIME_FRAME_WIDTHS } from 'bfx-hf-util';
import mouseWheelListener from 'mouse-wheel';
import formatAxisTick from './util/format_axis_tick';
import drawLine from './draw/line';
import dataTransformer from './data_transformer';
import drawTransformedLineFromData from './draw/transformed_line_from_data';
import drawOHLCSeries from './draw/ohlc_series';
import drawXAxis from './draw/x_axis';
import drawYAxis from './draw/y_axis';
import CONFIG, { set as setConfig } from './config';
const {
  CROSSHAIR_COLOR,
  AXIS_COLOR,
  AXIS_MARGIN_BOTTOM,
  MARGIN_BOTTOM,
  MARGIN_RIGHT,
  TRADE_MARKER_BUY_COLOR,
  TRADE_MARKER_SELL_COLOR,
  TRADE_MARKER_RADIUS_PX,
  RISING_CANDLE_FILL,
  FALLING_CANDLE_FILL,
  ZOOM_CANDLE_STEP,
  ZOOM_MIN_LIMIT_CANDLES
} = CONFIG;
export default class BitfinexTradingChart {
  constructor({
    ohlcCanvas,
    axisCanvas,
    drawingCanvas,
    indicatorCanvas,
    crosshairCanvas,
    width,
    height,
    trades = [],
    orders = [],
    position,
    data,
    dataWidth,
    indicators = [],
    onLoadMoreCB,
    onHoveredCandleCB,
    onUpdateIndicatorSettingsCB,
    config = {}
  }) {
    Object.keys(config).forEach(key => {
      setConfig(key, config[key]);
    });
    this.ohlcCanvas = ohlcCanvas;
    this.axisCanvas = axisCanvas;
    this.drawingCanvas = drawingCanvas;
    this.indicatorCanvas = indicatorCanvas;
    this.crosshairCanvas = crosshairCanvas;
    this.width = width;
    this.height = height;
    this.trades = trades;
    this.orders = orders;
    this.position = position;
    this.dataWidth = TIME_FRAME_WIDTHS[dataWidth];
    this.onLoadMoreCB = onLoadMoreCB;
    this.onHoveredCandleCB = onHoveredCandleCB;
    this.onUpdateIndicatorSettingsCB = onUpdateIndicatorSettingsCB;
    this.viewportWidthCandles = 200; // TODO: extract

    this.candleWidthPX = Math.max(1, 7 - Math.floor(this.viewportWidthCandles / 50));
    this.isDragging = false;
    this.dragStart = null;
    this.mousePosition = {
      x: 0,
      y: 0
    };
    this.vp = {
      pan: {
        x: 0,
        y: 0
      },
      origin: {
        x: 0,
        y: 0
      },
      size: {
        w: width - MARGIN_RIGHT - 0.5,
        h: height - MARGIN_BOTTOM - AXIS_MARGIN_BOTTOM - 0.5
      }
    };
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.onMouseWheel = this.onMouseWheel.bind(this);
    this.crosshairCanvas.addEventListener('mouseup', this.onMouseUp);
    this.crosshairCanvas.addEventListener('mousedown', this.onMouseDown);
    this.crosshairCanvas.addEventListener('mousemove', this.onMouseMove);
    this.crosshairCanvas.addEventListener('mouseleave', this.onMouseLeave);
    mouseWheelListener(this.crosshairCanvas, this.onMouseWheel); // TODO: Refactor; this is experimental, mode data should be set on tool select
    // const testDrawing = new LineDrawing(this)
    // this.activeDrawing = testDrawing
    // this.drawings = [testDrawing]

    this.activeDrawing = null;
    this.drawings = [];
    this.externalIndicators = 0; // set in updateData()

    this.updateIndicators(indicators);
    this.updateData(data);
    this.clearAll(); // Add clip region for main viewport

    const drawingCTX = this.drawingCanvas.getContext('2d');
    const ohlcCTX = this.ohlcCanvas.getContext('2d');
    const vpHeight = this.getOHLCVPHeight();
    const clipRegion = new Path2D();
    clipRegion.rect(0, 0, this.vp.size.w, vpHeight);
    ohlcCTX.clip(clipRegion);
    drawingCTX.clip(clipRegion);
    this.renderAll();
  }

  updateDrawings(drawings = []) {
    this.drawings = drawings;

    if (drawings[0] && drawings[0].isActive()) {
      this.activeDrawing = drawings[0];
    }
  }

  updateIndicators(indicators = []) {
    this.indicators = indicators;
    this.updateData(this.data);
    const ohlcHeight = this.getOHLCVPHeight();
    const slotHeight = (this.vp.size.h - ohlcHeight) / this.externalIndicators;

    if (this.onUpdateIndicatorSettingsCB) {
      this.onUpdateIndicatorSettingsCB(indicators, ohlcHeight, slotHeight);
    }
  }

  updateTrades(trades = []) {
    this.trades = trades;
    this.clearAll();
    this.renderAll();
  }

  updateOrders(orders = []) {
    this.orders = orders;
    this.clearAll();
    this.renderAll();
  }

  updatePosition(position) {
    this.position = position;
    this.clearAll();
    this.renderAll();
  }
  /**
   * Updates internal candle & indicator data sets
   *
   * @param {Array[]} data - candle dataset
   * @param {number?} dataWidth - candle width, default unchanged
   */


  updateData(data = [], dataWidth) {
    if (dataWidth) {
      this.dataWidth = TIME_FRAME_WIDTHS[dataWidth];
    }

    this.data = data;
    this.indicatorData = [];
    this.externalIndicators = 0;
    const indicatorInstances = [];

    for (let i = 0; i < this.indicators.length; i += 1) {
      const ind = new this.indicators[i][0](this.indicators[i][1]); // TODO: Handle colors for multiple lines

      this.indicators[i][1].__color = randomColor();

      if (ind.ui.position === 'external') {
        this.externalIndicators += 1;
      }

      indicatorInstances.push(ind);
    }

    for (let i = 0; i < data.length; i += 1) {
      for (let j = 0; j < indicatorInstances.length; j += 1) {
        const ind = indicatorInstances[j];

        if (ind.getDataType() === 'trade') {
          continue;
        }

        const c = new Candle(data[i]);

        if (ind.getDataKey() === '*') {
          ind.add(c);
        } else {
          ind.add(c[ind.getDataKey()]);
        }

        if (!this.indicatorData[j]) {
          this.indicatorData[j] = [];
        }

        this.indicatorData[j].push(_isFinite(ind.v()) ? ind.v() : 0);
      }
    }

    this.clearAll();
    this.renderAll();
  }

  updateDimensions(width, height) {
    this.width = width;
    this.height = height;
    this.vp.size.w = width - 50.5;
    this.vp.size.h = height - MARGIN_BOTTOM - AXIS_MARGIN_BOTTOM - 0.5;
    this.clearAll();
    this.renderAll();
  }

  clearAll() {
    this.clear(this.ohlcCanvas);
    this.clear(this.axisCanvas);
    this.clear(this.drawingCanvas);
    this.clear(this.indicatorCanvas);
    this.clear(this.crosshairCanvas);
  }

  clear(canvas) {
    const ctx = canvas.getContext('2d');
    const {
      width,
      height
    } = this;
    ctx.clearRect(0, 0, width, height);
  }

  getCandlesInView() {
    const panX = this.vp.pan.x + this.vp.origin.x;
    const candlePanOffset = panX > 0 ? Math.floor(panX / this.candleWidthPX) : 0;
    const start = this.data.length - 1 - this.viewportWidthCandles - candlePanOffset;
    const end = this.data.length - 1 - candlePanOffset;
    return this.data.slice(_max([0, start]), end);
  }

  getIndicatorDataInView() {
    const panX = this.vp.pan.x + this.vp.origin.x;
    const candlePanOffset = panX > 0 ? Math.floor(panX / this.candleWidthPX) : 0;
    const dataInView = [];

    for (let i = 0; i < this.indicatorData.length; i += 1) {
      const start = this.indicatorData[i].length - 1 - this.viewportWidthCandles - candlePanOffset;
      const end = this.indicatorData[i].length - 1 - candlePanOffset;
      dataInView.push(this.indicatorData[i].slice(_max([0, start]), end));
    }

    return dataInView;
  }

  renderAll() {
    this.renderOHLC();
    this.renderTrades();
    this.renderIndicators();
    this.renderAxis();
    this.renderDrawings();
    this.renderOrders();
    this.renderPosition();
  }

  renderIndicators() {
    if (this.data.length < 2) {
      return;
    }

    const indicatorData = this.getIndicatorDataInView();
    let currentExtSlot = 0;
    let currentOverlaySlot = 0;

    for (let i = 0; i < this.indicators.length; i += 1) {
      const indicator = this.indicators[i];
      const color = indicator[1].__color;
      const data = indicatorData[i];
      const iClass = indicator[0];
      const {
        ui
      } = iClass;
      const {
        position,
        type
      } = ui;

      if (position === 'external') {
        if (type === 'rsi') {
          this.renderRSIIndicator(indicator, data, color, currentExtSlot++);
        } else if (type === 'line') {
          this.renderExternalLineIndicator(indicator, data, color, currentExtSlot++);
        }
      } else if (position === 'overlay') {
        if (type === 'line') {
          this.renderOverlayLineIndicator(indicator, data, color, currentOverlaySlot++);
        }
      }
    }
  }

  renderRSIIndicator(indicator, data, color, exSlot) {
    const iInstance = new indicator[0](indicator[1]);
    const candlesToRender = this.getCandlesInView();
    const vpHeight = this.getOHLCVPHeight();
    const slotHeight = (this.vp.size.h - vpHeight) / this.externalIndicators;
    const slotY = vpHeight + slotHeight * exSlot + AXIS_MARGIN_BOTTOM;

    const rightMTS = _last(candlesToRender)[0];

    const vWidth = this.viewportWidthCandles * this.dataWidth;
    const transformer = dataTransformer(data, vWidth, rightMTS);
    drawTransformedLineFromData(this.indicatorCanvas, color, transformer, {
      yData: data,
      xData: candlesToRender.map(c => c[0]),
      ySize: slotHeight,
      xSize: this.vp.size.w - this.candleWidthPX / 2,
      yOffset: slotHeight + slotY,
      xOffset: 0
    });
    this.renderExternalSlotMeta(transformer, iInstance.getName(), [30, 70], exSlot);
  }

  renderExternalLineIndicator(indicator, data, color, exSlot) {
    const iInstance = new indicator[0](indicator[1]);
    const candlesToRender = this.getCandlesInView();
    const vpHeight = this.getOHLCVPHeight();
    const slotHeight = (this.vp.size.h - vpHeight) / this.externalIndicators;
    const slotY = vpHeight + slotHeight * exSlot + AXIS_MARGIN_BOTTOM;

    const rightMTS = _last(candlesToRender)[0];

    const vWidth = this.viewportWidthCandles * this.dataWidth;
    const transformer = dataTransformer(data, vWidth, rightMTS);
    drawTransformedLineFromData(this.indicatorCanvas, color, transformer, {
      yData: data,
      xData: candlesToRender.map(c => c[0]),
      ySize: slotHeight,
      xSize: this.vp.size.w - this.candleWidthPX / 2,
      yOffset: slotY + slotHeight,
      xOffset: 0
    });
    this.renderExternalSlotMeta(transformer, iInstance.getName(), [0], exSlot);
  }

  renderExternalSlotMeta(transformer, label, xAxes, exSlot) {
    const vpHeight = this.getOHLCVPHeight();
    const slotHeight = (this.vp.size.h - vpHeight) / this.externalIndicators;
    const slotY = vpHeight + slotHeight * exSlot + AXIS_MARGIN_BOTTOM;
    const ctx = this.indicatorCanvas.getContext('2d');

    for (let i = 0; i < xAxes.length; i += 1) {
      const axis = xAxes[i];
      const axisY = transformer.y(axis, slotHeight);
      this.drawHorizontalVPLine(this.indicatorCanvas, AXIS_COLOR, slotY + slotHeight - axisY);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(formatAxisTick(axis), this.vp.size.w + 5, slotY + slotHeight - axisY + 3);
    }
  }

  renderOverlayLineIndicator(indicator, data, color, slot) {
    const iInstance = new indicator[0](indicator[1]);
    const candlesToRender = this.getCandlesInView();
    const vpHeight = this.getOHLCVPHeight();

    const rightMTS = _last(candlesToRender)[0];

    const vWidth = this.viewportWidthCandles * this.dataWidth;

    const maxP = _max(candlesToRender.map(ohlc => ohlc[3]));

    const minP = _min(candlesToRender.map(ohlc => ohlc[4]));

    const pd = maxP - minP;
    const linePoints = [];

    for (let i = 0; i < candlesToRender.length; i += 1) {
      const d = candlesToRender[i];
      const [mts] = d;
      const y = (data[i] - minP) / pd * vpHeight;
      const x = (vWidth - (rightMTS - mts)) / vWidth * (this.vp.size.w - this.candleWidthPX / 2);
      linePoints.push({
        x,
        y: vpHeight - y
      });
    }

    drawLine(this.ohlcCanvas, color, linePoints);
  }
  /**
   * Renders the crosshair and updates the toolbar OHLC stats
   */


  renderCrosshair() {
    if (this.data.length < 2) {
      return;
    }

    const {
      width,
      height,
      mousePosition
    } = this;
    drawLine(this.crosshairCanvas, CROSSHAIR_COLOR, [{
      x: 0,
      y: mousePosition.y + 0.5
    }, {
      x: width,
      y: mousePosition.y + 0.5
    }]);
    drawLine(this.crosshairCanvas, CROSSHAIR_COLOR, [{
      x: mousePosition.x + 0.5,
      y: 0
    }, {
      x: mousePosition.x + 0.5,
      y: height
    }]);
    const ctx = this.crosshairCanvas.getContext('2d');
    const candlesInView = this.getCandlesInView();

    const rightMTS = _last(candlesInView)[0];

    const leftMTS = candlesInView[0][0];
    const mtsPerPX = (rightMTS - leftMTS) / this.vp.size.w;
    const mouseMTS = Math.floor(leftMTS + mtsPerPX * mousePosition.x);
    const label = new Date(mouseMTS).toLocaleString();
    const labelWidth = ctx.measureText(label).width;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ccc';
    ctx.fillRect(mousePosition.x - labelWidth / 2, height - 17, labelWidth, 14);
    ctx.fillStyle = '#000';
    ctx.fillText(label, mousePosition.x, height - 5); // Find nearest candle

    if (this.onHoveredCandleCB) {
      const candleDistances = candlesInView.map((c, i) => [Math.abs(c[0] - mouseMTS), i]);
      candleDistances.sort((a, b) => a[0] - b[0]);
      this.onHoveredCandleCB(candlesInView[candleDistances[0][1]]);
    }
  }

  renderDrawings() {
    for (let i = 0; i < this.drawings.length; i += 1) {
      this.drawings[i].render();
    }
  }

  renderOrders() {
    if (this.data.length < 2) {
      return;
    }

    const candles = this.getCandlesInView();

    const maxP = _max(candles.map(ohlc => ohlc[3]));

    const minP = _min(candles.map(ohlc => ohlc[4]));

    const visibleOrders = this.orders.filter(({
      price
    }) => price >= minP && price <= maxP);

    if (visibleOrders.length === 0) {
      return;
    }

    const ctx = this.drawingCanvas.getContext('2d');
    const transformer = this.getOHLCTransformer();
    visibleOrders.forEach(o => {
      const color = o.amount < 0 ? FALLING_CANDLE_FILL : RISING_CANDLE_FILL;
      const label = `${formatAxisTick(o.amount)} @ ${formatAxisTick(o.price)}`;
      const labelWidth = ctx.measureText(label).width;
      const y = transformer.y(o.price);
      const labelX = this.vp.size.w - MARGIN_RIGHT * 0.5 - labelWidth;
      drawLine(this.drawingCanvas, color, [{
        x: 0,
        y
      }, {
        x: this.vp.size.w,
        y
      }], true);
      ctx.font = `${CONFIG.AXIS_LABEL_FONT_SIZE_PX} ${CONFIG.AXIS_LABEL_FONT_NAME}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = color;
      ctx.fillRect(labelX, y - 8, labelWidth + 16, 16);
      ctx.fillStyle = '#000';
      ctx.fillText(label, labelX + 8, y + 4);
    });
  }

  renderPosition() {
    if (this.data.length < 2 || !this.position) {
      return;
    }

    const candles = this.getCandlesInView();

    const maxP = _max(candles.map(ohlc => ohlc[3]));

    const minP = _min(candles.map(ohlc => ohlc[4]));

    const {
      basePrice,
      amount
    } = this.position;

    if (basePrice < minP || basePrice > maxP) {
      return;
    }

    const ctx = this.drawingCanvas.getContext('2d');
    const transformer = this.getOHLCTransformer();
    const color = amount < 0 ? FALLING_CANDLE_FILL : RISING_CANDLE_FILL;
    const label = `${formatAxisTick(amount)} @ ${formatAxisTick(basePrice)}`;
    const labelWidth = ctx.measureText(label).width;
    const y = transformer.y(basePrice);
    const labelX = this.vp.size.w - MARGIN_RIGHT * 0.5 - labelWidth;
    drawLine(this.drawingCanvas, color, [{
      x: 0,
      y
    }, {
      x: this.vp.size.w,
      y
    }]);
    ctx.font = `${CONFIG.AXIS_LABEL_FONT_SIZE_PX} ${CONFIG.AXIS_LABEL_FONT_NAME}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = color;
    ctx.fillRect(labelX, y - 8, labelWidth + 16, 16);
    ctx.fillStyle = '#000';
    ctx.fillText(label, labelX + 8, y + 4);
  }

  getMTSForRawX(x) {
    const candlesInView = this.getCandlesInView();

    const rightMTS = _last(candlesInView)[0];

    const leftMTS = candlesInView[0][0];
    const mtsPerPX = (rightMTS - leftMTS) / this.vp.size.w;
    return leftMTS + mtsPerPX * x;
  }

  getPriceForRawY(y) {
    const candlesInView = this.getCandlesInView();
    const vpHeight = this.getOHLCVPHeight();

    const high = _max(candlesInView.map(c => c[3]));

    const low = _min(candlesInView.map(c => c[4]));

    const pricePerPX = (high - low) / vpHeight;
    return high - pricePerPX * y;
  }

  getOHLCTransformer() {
    const candlesToRender = this.getCandlesInView();
    const vpHeight = this.getOHLCVPHeight();

    const rightMTS = _last(candlesToRender)[0];

    const vWidth = this.viewportWidthCandles * this.dataWidth;

    const maxP = _max(candlesToRender.map(ohlc => ohlc[3]));

    const minP = _min(candlesToRender.map(ohlc => ohlc[4]));

    const transformer = dataTransformer([maxP, minP], vWidth, rightMTS);
    transformer.setTargetWidth(this.vp.size.w);
    transformer.setTargetHeight(vpHeight);
    transformer.setYModifier(y => vpHeight - y);
    return transformer;
  }

  drawHorizontalVPLine(canvas, color, y) {
    drawLine(canvas, color, [{
      x: 0,
      y
    }, {
      x: this.vp.size.w,
      y
    }]);
  }

  renderAxis() {
    if (this.data.length < 2) {
      return;
    }

    const candles = this.getCandlesInView();
    const vpWidth = this.viewportWidthCandles * this.dataWidth;
    const vpHeight = this.getOHLCVPHeight();
    drawXAxis(this.axisCanvas, candles, vpHeight, vpWidth, this.vp.size.w);
    drawYAxis(this.axisCanvas, candles, this.vp.size.w, this.height, vpHeight);
  }

  getOHLCVPHeight() {
    return this.vp.size.h - _min([this.vp.size.h / 2, this.externalIndicators * 100]);
  }

  renderOHLC() {
    if (this.data.length < 2) {
      return;
    }

    const ctx = this.ohlcCanvas.getContext('2d');
    const candles = this.getCandlesInView();
    const vpHeight = this.getOHLCVPHeight();
    const vpWidth = this.viewportWidthCandles * this.dataWidth;
    drawOHLCSeries(ctx, candles, this.candleWidthPX, vpWidth, vpHeight, this.vp.size.w);
  }

  renderTrades() {
    if (this.data.length === 0 || this.trades.length === 0) {
      return;
    }

    const ctx = this.ohlcCanvas.getContext('2d');
    const transformer = this.getOHLCTransformer();

    for (let i = 0; i < this.trades.length; i += 1) {
      ctx.strokeStyle = this.trades[i].amount > 0 ? TRADE_MARKER_BUY_COLOR : TRADE_MARKER_SELL_COLOR;
      ctx.beginPath();
      ctx.arc(transformer.x(this.trades[i].mts), transformer.y(this.trades[i].price), TRADE_MARKER_RADIUS_PX, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }

  getOHLCMousePosition() {
    return {
      mts: this.getMTSForRawX(this.mousePosition.x),
      price: this.getPriceForRawY(this.mousePosition.y)
    };
  }

  onMouseLeave() {
    this.clear(this.crosshairCanvas);
    this.isDragging = false;
  }

  onMouseUp(e) {
    this.isDragging = false;
    this.dragStart = null;
    this.vp.origin.x += this.vp.pan.x;
    this.vp.origin.y += this.vp.pan.y;
    this.vp.pan.x = 0;
    this.vp.pan.y = 0;

    if (this.activeDrawing) {
      this.activeDrawing.onMouseUp();
    }
  }

  onMouseDown(e) {
    const rect = this.ohlcCanvas.getBoundingClientRect();
    const x = e.pageX - rect.left;
    const y = e.pageY - rect.top; // Drawings can prevent drag-start (i.e. when editing)

    if (this.activeDrawing) {
      if (this.activeDrawing.onMouseDown(x, y)) {
        return;
      }
    }

    this.isDragging = true;
    this.dragStart = {
      x,
      y
    };
  }

  onMouseMove(e) {
    const rect = e.target.getBoundingClientRect();
    this.mousePosition = {
      x: e.pageX - rect.left,
      y: e.pageY - rect.top
    };

    if (this.activeDrawing) {
      this.activeDrawing.onMouseMove(this.mousePosition.x, this.mousePosition.y);
    }

    this.crosshairCanvas.style.cursor = this.activeDrawing && this.activeDrawing.isActive() ? 'crosshair' : 'default';

    if (this.isDragging && (!this.activeDrawing || !this.activeDrawing.isActive())) {
      this.vp.pan.x = this.mousePosition.x - this.dragStart.x;
      this.clearAll();
      this.renderAll();

      if (_isFunction(this.onLoadMoreCB)) {
        const panX = this.vp.pan.x + this.vp.origin.x;
        const candlePanOffset = panX > 0 ? Math.floor(panX / this.candleWidthPX) : 0;

        if (candlePanOffset + this.viewportWidthCandles > this.data.length) {
          this.onLoadMoreCB(this.viewportWidthCandles);
        }
      }
    } else {
      this.clear(this.crosshairCanvas, 'rgba(0, 0, 0, 0)');
      this.clear(this.drawingCanvas, 'rgba(0, 0, 0, 0)');
      this.renderCrosshair();
      this.renderDrawings();
      this.renderOrders();
      this.renderPosition();
    }
  }

  onMouseWheel(dx, dy, dz, ev) {
    // differing values in Chrome/FF, normalize
    const delta = dy < 0 ? -ZOOM_CANDLE_STEP : ZOOM_CANDLE_STEP;
    this.viewportWidthCandles += delta;

    if (this.viewportWidthCandles < ZOOM_MIN_LIMIT_CANDLES) {
      this.viewportWidthCandles = ZOOM_MIN_LIMIT_CANDLES;
    }

    this.candleWidthPX = Math.max(1, 7 - Math.floor(this.viewportWidthCandles / 50));
    this.clearAll();
    this.renderAll();
    ev.preventDefault();
    ev.stopPropagation();
  }

}