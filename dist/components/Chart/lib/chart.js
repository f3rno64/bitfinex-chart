import _isFunction from 'lodash/isFunction';
import _isFinite from 'lodash/isFinite';
import _last from 'lodash/last';
import _max from 'lodash/max';
import _min from 'lodash/min';
import randomColor from 'randomcolor';
import moment from 'moment';
import { Candle } from 'bfx-api-node-models';
import { TIME_FRAME_WIDTHS } from 'bfx-hf-util';
import drawLine from './draw/line';
import dataTransformer from './data_transformer';
import drawTransformedLineFromData from './draw/transformed_line_from_data';
const CANDLE_WIDTH_PX = 5; // TODO: implement/extract into zoom

const CROSSHAIR_COLOR = '#666';
const AXIS_COLOR = '#333';
const AXIS_TICK_COLOR = '#222';
const AXIS_LABEL_COLOR = '#999';
const AXIS_LABEL_FONT_NAME = 'sans-serif';
const AXIS_LABEL_FONT_SIZE_PX = 12;
const AXIS_LABEL_MARGIN_PX = 10;
const AXIS_X_TICK_COUNT = 12;
const AXIS_Y_TICK_COUNT = 8;
const MARGIN_BOTTOM = 25;
const AXIS_MARGIN_BOTTOM = 50;
const INDICATOR_LABEL_X = 25;
const RISING_CANDLE_FILL = '#0f0';
const RISING_VOL_FILL = 'rgba(0, 255, 0, 0.3)';
const FALLING_CANDLE_FILL = '#f00';
const FALLING_VOL_FILL = 'rgba(255, 0, 0, 0.3)';
export default class BitfinexTradingChart {
  constructor({
    ohlcCanvas,
    axisCanvas,
    drawingCanvas,
    indicatorCanvas,
    width,
    height,
    data,
    dataWidth,
    indicators,
    onLoadMoreCB
  }) {
    this.ohlcCanvas = ohlcCanvas;
    this.axisCanvas = axisCanvas;
    this.drawingCanvas = drawingCanvas;
    this.indicatorCanvas = indicatorCanvas;
    this.width = width;
    this.height = height;
    this.dataWidth = dataWidth;
    this.onLoadMoreCB = onLoadMoreCB;
    this.viewportWidthCandles = 200; // TODO: extract

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
        w: width - 50.5,
        h: height - MARGIN_BOTTOM - AXIS_MARGIN_BOTTOM - 0.5
      }
    };
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.drawingCanvas.addEventListener('mouseup', this.onMouseUp);
    this.drawingCanvas.addEventListener('mousedown', this.onMouseDown);
    this.drawingCanvas.addEventListener('mousemove', this.onMouseMove);
    this.indicators = indicators;
    this.externalIndicators = 0; // set in updateData()

    this.updateData(data);
    this.clearAll(); // Add clip region for main viewport

    const clipRegion = new Path2D();
    const ohlcCTX = this.ohlcCanvas.getContext('2d');
    clipRegion.rect(0, 0, this.vp.size.w, this.vp.size.h);
    ohlcCTX.clip(clipRegion);
    this.renderAll();
  }
  /**
   * Updates internal candle & indicator data sets
   *
   * @param {Array[]} data - candle dataset
   */


  updateData(data = []) {
    this.data = data;
    this.indicatorData = [];
    this.indicatorColors = [];
    this.externalIndicators = 0;
    const indicatorInstances = [];

    for (let i = 0; i < this.indicators.length; i += 1) {
      const ind = new this.indicators[i][0](this.indicators[i][1]);

      if (ind.ui.position === 'external') {
        this.externalIndicators += 1;
      }

      indicatorInstances.push(ind);
      this.indicatorColors.push(randomColor());
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
    const candlePanOffset = panX > 0 ? Math.floor(panX / CANDLE_WIDTH_PX) : 0;
    const start = this.data.length - 1 - this.viewportWidthCandles - candlePanOffset;
    const end = this.data.length - 1 - candlePanOffset;
    return this.data.slice(_max([0, start]), end);
  }

  getIndicatorDataInView() {
    const panX = this.vp.pan.x + this.vp.origin.x;
    const candlePanOffset = panX > 0 ? Math.floor(panX / CANDLE_WIDTH_PX) : 0;
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
    this.renderIndicators();
    this.renderAxis();
  }

  renderIndicators() {
    const indicatorData = this.getIndicatorDataInView();
    let currentExtSlot = 0;

    for (let i = 0; i < this.indicators.length; i += 1) {
      const color = this.indicatorColors[i];
      const indicator = this.indicators[i];
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
          this.renderOverlayLineIndicator(indicator, data, color);
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
      xSize: this.vp.size.w - CANDLE_WIDTH_PX / 2,
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
      xSize: this.vp.size.w - CANDLE_WIDTH_PX / 2,
      yOffset: slotY + slotHeight,
      xOffset: 0
    });
    this.renderExternalSlotMeta(transformer, iInstance.getName(), [0], exSlot);
  }

  renderExternalSlotLabel(label, exSlot) {
    const ctx = this.indicatorCanvas.getContext('2d');
    const vpHeight = this.getOHLCVPHeight();
    const slotHeight = (this.vp.size.h - vpHeight) / this.externalIndicators;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(label, INDICATOR_LABEL_X, vpHeight + slotHeight * exSlot + AXIS_MARGIN_BOTTOM);
  }

  renderExternalSlotMeta(transformer, label, xAxes, exSlot) {
    const vpHeight = this.getOHLCVPHeight();
    const slotHeight = (this.vp.size.h - vpHeight) / this.externalIndicators;
    const slotY = vpHeight + slotHeight * exSlot + AXIS_MARGIN_BOTTOM;
    const ctx = this.indicatorCanvas.getContext('2d');
    this.renderExternalSlotLabel(label, exSlot);

    for (let i = 0; i < xAxes.length; i += 1) {
      const axis = xAxes[i];
      const axisY = transformer.y(axis, slotHeight);
      this.drawHorizontalVPLine(this.indicatorCanvas, AXIS_COLOR, slotY + slotHeight - axisY);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(axis, this.vp.size.w + 5, slotY + slotHeight - axisY + 3);
    }
  }

  renderOverlayLineIndicator(indicator, data, color) {
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
      const x = (vWidth - (rightMTS - mts)) / vWidth * (this.vp.size.w - CANDLE_WIDTH_PX / 2);
      linePoints.push({
        x,
        y: vpHeight - y
      });
    }

    drawLine(this.ohlcCanvas, color, linePoints);
  }

  renderCrosshair() {
    const {
      width,
      height,
      mousePosition
    } = this;
    drawLine(this.drawingCanvas, CROSSHAIR_COLOR, [{
      x: 0,
      y: mousePosition.y + 0.5
    }, {
      x: width,
      y: mousePosition.y + 0.5
    }]);
    drawLine(this.drawingCanvas, CROSSHAIR_COLOR, [{
      x: mousePosition.x + 0.5,
      y: 0
    }, {
      x: mousePosition.x + 0.5,
      y: height
    }]);
    const ctx = this.drawingCanvas.getContext('2d');
    const candlesInView = this.getCandlesInView();

    const rightMTS = _last(candlesInView)[0];

    const leftMTS = candlesInView[0][0];
    const mtsPerPX = (rightMTS - leftMTS) / this.vp.size.w;
    const label = new Date(Math.floor(leftMTS + mtsPerPX * mousePosition.x)).toLocaleString();
    const labelWidth = ctx.measureText(label).width;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ccc';
    ctx.fillRect(mousePosition.x - labelWidth / 2, height - 17, labelWidth, 14);
    ctx.fillStyle = '#000';
    ctx.fillText(label, mousePosition.x, height - 5);
  }

  renderDrawings() {
    this.renderCrosshair();
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
    const ctx = this.axisCanvas.getContext('2d');
    const candles = this.getCandlesInView();
    const vWidth = this.viewportWidthCandles * this.dataWidth;
    const vpHeight = this.getOHLCVPHeight();
    ctx.font = `${AXIS_LABEL_FONT_SIZE_PX} ${AXIS_LABEL_FONT_NAME}`;
    ctx.fillStyle = AXIS_LABEL_COLOR; // x

    ctx.textAlign = 'center';
    drawLine(this.axisCanvas, AXIS_COLOR, [{
      x: 0,
      y: vpHeight
    }, {
      x: this.vp.size.w,
      y: vpHeight
    }]);

    const rightMTS = _last(candles)[0];

    const leftMTS = candles[0][0];
    const rangeLengthMTS = rightMTS - leftMTS;
    const tickWidthMTS = Math.floor(rangeLengthMTS / AXIS_X_TICK_COUNT);
    const tickWidthPX = this.vp.size.w / AXIS_X_TICK_COUNT;
    let ticks = [];
    let tickDivisor = 60 * 1000; // 1min by default, overriden below

    const dayCount = rangeLengthMTS / TIME_FRAME_WIDTHS['1D'];

    if (dayCount > 1 && dayCount < AXIS_X_TICK_COUNT) {
      tickDivisor = 24 * 60 * 60 * 1000;
    } else {
      const hourCount = rangeLengthMTS / TIME_FRAME_WIDTHS['1h'];

      if (hourCount > 1 && hourCount < AXIS_X_TICK_COUNT) {
        tickDivisor = 60 * 60 * 1000;
      }
    }

    const paddedLeftMTS = leftMTS - leftMTS % tickDivisor;

    for (let i = 0; i < AXIS_X_TICK_COUNT; i += 1) {
      ticks.push(paddedLeftMTS + i * tickDivisor);

      if (paddedLeftMTS + (i + 1) * tickDivisor > rightMTS) {
        break;
      }
    }

    for (let i = 0; i < AXIS_X_TICK_COUNT; i += 1) {
      const mts = ticks[i]; // (tickWidthMTS * i) + leftMTS

      const x = (vWidth - (rightMTS - mts)) / vWidth * this.vp.size.w;
      const y = vpHeight + AXIS_LABEL_FONT_SIZE_PX + AXIS_LABEL_MARGIN_PX;
      const date = new Date(mts);
      let label; // TODO: wip

      if (date.getHours() === 0) {
        label = `${date.getHours()}:${date.getMinutes()}`;
      } else {
        label = moment(date).format('HH:mm');
      }

      ctx.fillText(label, x, y, tickWidthPX); // tick

      drawLine(this.axisCanvas, AXIS_TICK_COLOR, [{
        x,
        y: y - AXIS_LABEL_FONT_SIZE_PX
      }, {
        x,
        y: 0
      }]);
    } // y


    ctx.textAlign = 'left';
    drawLine(this.axisCanvas, AXIS_COLOR, [{
      x: this.vp.size.w,
      y: 0
    }, {
      x: this.vp.size.w,
      y: this.height
    }]);

    const maxP = _max(candles.map(ohlc => ohlc[3]));

    const minP = _min(candles.map(ohlc => ohlc[4]));

    const pd = maxP - minP;
    const tickHeightPX = this.vp.size.h / AXIS_Y_TICK_COUNT;
    const tickHeightPrice = pd / AXIS_Y_TICK_COUNT;

    for (let i = 0; i < AXIS_Y_TICK_COUNT; i += 1) {
      const y = vpHeight - tickHeightPX * i;
      const x = this.vp.size.w + AXIS_LABEL_MARGIN_PX;
      ctx.fillText(Math.floor(minP + tickHeightPrice * i), x, y, this.width - this.vp.size.w); // tick

      drawLine(this.axisCanvas, AXIS_TICK_COLOR, [{
        x: x - 3,
        y: y - AXIS_LABEL_FONT_SIZE_PX / 2
      }, {
        x: 0,
        y: y - AXIS_LABEL_FONT_SIZE_PX / 2
      }]);
    }
  }

  getOHLCVPHeight() {
    return this.vp.size.h - _min([this.vp.size.h / 2, this.externalIndicators * 100]);
  }

  renderOHLC() {
    const ctx = this.ohlcCanvas.getContext('2d');
    const candlesToRender = this.getCandlesInView();
    const vpHeight = this.getOHLCVPHeight();

    const rightMTS = _last(candlesToRender)[0];

    const vWidth = this.viewportWidthCandles * this.dataWidth;

    const maxVol = _max(candlesToRender.map(ohlc => ohlc[5]));

    const maxP = _max(candlesToRender.map(ohlc => ohlc[3]));

    const minP = _min(candlesToRender.map(ohlc => ohlc[4]));

    const pd = maxP - minP;

    for (let i = 0; i < candlesToRender.length; i += 1) {
      const d = candlesToRender[i];
      const [mts, o, c, h, l, v] = d;
      const oPX = (o - minP) / pd * vpHeight;
      const hPX = (h - minP) / pd * vpHeight;
      const lPX = (l - minP) / pd * vpHeight;
      const cPX = (c - minP) / pd * vpHeight;
      const x = (vWidth - (rightMTS - mts)) / vWidth * (this.vp.size.w - CANDLE_WIDTH_PX / 2);

      const y = vpHeight - _max([oPX, cPX]); // volume


      ctx.fillStyle = c >= o ? RISING_VOL_FILL : FALLING_VOL_FILL;
      ctx.fillRect(x - CANDLE_WIDTH_PX / 2, vpHeight, CANDLE_WIDTH_PX, -(v / maxVol * vpHeight));
      ctx.fillStyle = c >= o ? RISING_CANDLE_FILL : FALLING_CANDLE_FILL;
      ctx.strokeStyle = ctx.fillStyle; // body

      ctx.fillRect(x - CANDLE_WIDTH_PX / 2, y, CANDLE_WIDTH_PX, _max([oPX, cPX]) - _min([oPX, cPX])); // wicks

      ctx.beginPath();
      ctx.moveTo(x, vpHeight - _max([oPX, cPX]));
      ctx.lineTo(x, vpHeight - hPX);
      ctx.stroke();
      ctx.closePath();
      ctx.beginPath();
      ctx.moveTo(x, vpHeight - _min([oPX, cPX]));
      ctx.lineTo(x, vpHeight - lPX);
      ctx.stroke();
      ctx.closePath();
    }
  }

  onMouseUp(e) {
    this.isDragging = false;
    this.dragStart = null;
    this.vp.origin.x += this.vp.pan.x;
    this.vp.origin.y += this.vp.pan.y;
    this.vp.pan.x = 0;
    this.vp.pan.y = 0;
  }

  onMouseDown(e) {
    this.isDragging = true;
    this.dragStart = {
      x: e.pageX - this.ohlcCanvas.offsetLeft,
      y: e.pageY - this.ohlcCanvas.offsetTop
    };
  }

  onMouseMove(e) {
    const rect = e.target.getBoundingClientRect();
    this.mousePosition = {
      x: e.pageX - rect.left,
      y: e.pageY - rect.top
    };

    if (this.isDragging) {
      this.vp.pan.x = e.pageX - this.dragStart.x;
      this.clearAll();
      this.renderAll();

      if (_isFunction(this.onLoadMoreCB)) {
        const panX = this.vp.pan.x + this.vp.origin.x;
        const candlePanOffset = panX > 0 ? Math.floor(panX / CANDLE_WIDTH_PX) : 0;

        if (candlePanOffset + this.viewportWidthCandles > this.data.length) {
          this.onLoadMoreCB(this.viewportWidthCandles);
        }
      }
    } else {
      this.clear(this.drawingCanvas, 'rgba(0, 0, 0, 0)');
      this.renderDrawings();
    }
  }

}