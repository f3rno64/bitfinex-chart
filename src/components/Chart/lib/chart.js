import _last from 'lodash/last'
import _max from 'lodash/max'
import _min from 'lodash/min'

import drawLine from './draw/line'

const CANDLE_WIDTH_PX = 10 // TODO: implement/extract into zoom

const CROSSHAIR_COLOR = '#666'

const AXIS_COLOR = '#333'
const AXIS_TICK_COLOR = '#222'
const AXIS_LABEL_COLOR = '#999'
const AXIS_LABEL_FONT_NAME = 'sans-serif'
const AXIS_LABEL_FONT_SIZE_PX = 12
const AXIS_LABEL_MARGIN_PX = 10

// TODO: refactor? testing
const AXIS_X_TICK_COUNT = 12
const AXIS_Y_TICK_COUNT = 8

export default class BitfinexTradingChart {
  constructor ({
    ohlcCanvas,
    axisCanvas,
    drawingCanvas,
    width,
    height,
    data,
    dataWidth
  }) {
    this.ohlcCanvas = ohlcCanvas
    this.axisCanvas = axisCanvas
    this.drawingCanvas = drawingCanvas
    this.width = width
    this.height = height
    this.data = data
    this.dataWidth = dataWidth
    this.viewportWidthCandles = 50 // TODO: extract
    this.isDragging = false
    this.dragStart = null
    this.mousePosition = { x: 0, y: 0 }
    this.vp = {
      pan: { x: 0, y: 0 },
      origin: { x: 0, y: 0 },
      size: { w: width - 100.5, h: height - 100.5 }
    }

    this.onMouseUp = this.onMouseUp.bind(this)
    this.onMouseDown = this.onMouseDown.bind(this)
    this.onMouseMove = this.onMouseMove.bind(this)

    this.drawingCanvas.addEventListener('mouseup', this.onMouseUp)
    this.drawingCanvas.addEventListener('mousedown', this.onMouseDown)
    this.drawingCanvas.addEventListener('mousemove', this.onMouseMove)

    this.clearAll()
    this.renderAll()
  }

  clearAll () {
    this.clear(this.ohlcCanvas)
    this.clear(this.axisCanvas)
    this.clear(this.drawingCanvas)
  }

  clear (canvas) {
    const ctx = canvas.getContext('2d')
    const { width, height } = this
    ctx.clearRect(0, 0, width, height)
  }

  // TODO: refactor to cache the slice on pan (called for both axis & OHLC)
  getCandlesInView () {
    const panX = this.vp.pan.x + this.vp.origin.x
    const candlePanOffset = panX > 0 ? Math.floor(panX / CANDLE_WIDTH_PX) : 0

    return this.data.slice(
      this.data.length - 1 - this.viewportWidthCandles - candlePanOffset,
      this.data.length - 1 - candlePanOffset
    )
  }

  renderAll () {
    this.renderOHLC()
    this.renderAxis()
    this.renderDrawings()
  }

  renderCrosshair () {
    const ctx = this.drawingCanvas.getContext('2d')
    const { width, height, mousePosition } = this

    drawLine(this.drawingCanvas, CROSSHAIR_COLOR, [
      { x: 0, y: mousePosition.y + 0.5 },
      { x: width, y: mousePosition.y + 0.5 },
    ])

    drawLine(this.drawingCanvas, CROSSHAIR_COLOR, [
      { x: mousePosition.x + 0.5, y: 0 },
      { x: mousePosition.x + 0.5, y: height },
    ])
  }

  renderDrawings () {
    this.renderCrosshair()
  }

  renderAxis () {
    const ctx = this.axisCanvas.getContext('2d')
    const candles = this.getCandlesInView()
    const vWidth = this.viewportWidthCandles * this.dataWidth

    ctx.font = `${AXIS_LABEL_FONT_SIZE_PX} ${AXIS_LABEL_FONT_NAME}`
    ctx.fillStyle = AXIS_LABEL_COLOR

    // x
    ctx.textAlign = 'center'

    drawLine(this.axisCanvas, AXIS_COLOR, [
      { x: 0, y: this.vp.size.h },
      { x: this.vp.size.w, y: this.vp.size.h }
    ])

    const rightMTS = _last(candles)[0]
    const leftMTS = candles[0][0]
    const rangeLengthMTS = rightMTS - leftMTS
    const tickWidthMTS = Math.floor(rangeLengthMTS / AXIS_X_TICK_COUNT)
    const tickWidthPX = this.vp.size.w / AXIS_X_TICK_COUNT

    for (let i = 0; i < AXIS_X_TICK_COUNT; i += 1) {
      const mts = (tickWidthMTS * i) + leftMTS
      const x = (((vWidth - (rightMTS - mts)) / vWidth) * this.vp.size.w)
      const y = this.vp.size.h + AXIS_LABEL_FONT_SIZE_PX + AXIS_LABEL_MARGIN_PX

      // TODO: scale rendering min/h/etc
      ctx.fillText(new Date(mts).getMinutes(), x, y, tickWidthPX)

      // tick
      drawLine(this.axisCanvas, AXIS_TICK_COLOR, [
        { x, y: y - AXIS_LABEL_FONT_SIZE_PX },
        { x, y: 0 },
      ])
    }

    // y
    ctx.textAlign = 'left'

    drawLine(this.axisCanvas, AXIS_COLOR, [
      { x: this.vp.size.w, y: 0 },
      { x: this.vp.size.w, y: this.vp.size.h },
    ])

    const maxP = _max(candles.map(ohlc => ohlc[3]))
    const minP = _min(candles.map(ohlc => ohlc[4]))
    const pd = maxP - minP

    const tickHeightPX = this.vp.size.h / AXIS_Y_TICK_COUNT
    const tickHeightPrice = pd / AXIS_Y_TICK_COUNT

    for (let i = 0; i < AXIS_Y_TICK_COUNT; i += 1) {
      const y = this.vp.size.h - (tickHeightPX * i)
      const x = this.vp.size.w + AXIS_LABEL_MARGIN_PX

      // TODO: floor is temp
      ctx.fillText(Math.floor(minP + (tickHeightPrice * i)), x, y, this.width - this.vp.size.w)

      // tick
      drawLine(this.axisCanvas, AXIS_TICK_COLOR, [
        { x: x - 3, y: y - (AXIS_LABEL_FONT_SIZE_PX / 2) },
        { x: 0, y: y - (AXIS_LABEL_FONT_SIZE_PX / 2) },
      ])
    }
  }

  renderOHLC () {
    const ctx = this.ohlcCanvas.getContext('2d')
    const candlesToRender = this.getCandlesInView()

    const rightMTS = _last(candlesToRender)[0]
    const vWidth = this.viewportWidthCandles * this.dataWidth
    const maxP = _max(candlesToRender.map(ohlc => ohlc[3]))
    const minP = _min(candlesToRender.map(ohlc => ohlc[4]))
    const pd = maxP - minP

    for (let i = 0; i < candlesToRender.length; i += 1) {
      const d = candlesToRender[i]
      const [mts, o, c, h, l, v] = d

      const oPX = ((o - minP) / pd) * this.vp.size.h
      const hPX = ((h - minP) / pd) * this.vp.size.h
      const lPX = ((l - minP) / pd) * this.vp.size.h
      const cPX = ((c - minP) / pd) * this.vp.size.h

      const x = (((vWidth - (rightMTS - mts)) / vWidth) * (this.vp.size.w - (CANDLE_WIDTH_PX / 2)))
      const y = this.vp.size.h - _max([oPX, cPX])

      ctx.fillStyle = c >= o ? '#0f0' : '#f00'
      ctx.strokeStyle = c >= o ? '#0f0' : '#f00'

      // body
      ctx.fillRect(
        x - (CANDLE_WIDTH_PX / 2),
        y,
        CANDLE_WIDTH_PX,
        _max([oPX, cPX]) - _min([oPX, cPX])
      )

      // wicks
      ctx.beginPath()
      ctx.moveTo(x, this.vp.size.h - _max([oPX, cPX]))
      ctx.lineTo(x, this.vp.size.h - hPX)
      ctx.stroke()
      ctx.closePath()

      ctx.beginPath()
      ctx.moveTo(x, this.vp.size.h - _min([oPX, cPX]))
      ctx.lineTo(x, this.vp.size.h - lPX)
      ctx.stroke()
      ctx.closePath()
    }
  }

  onMouseUp (e) {
    this.isDragging = false
    this.dragStart = null

    this.vp.origin.x += this.vp.pan.x
    this.vp.origin.y += this.vp.pan.y
    this.vp.pan.x = 0
    this.vp.pan.y = 0
  }

  onMouseDown (e) {
    this.isDragging = true
    this.dragStart = {
      x: e.pageX - this.ohlcCanvas.offsetLeft,
      y: e.pageY - this.ohlcCanvas.offsetTop,
    }
  }

  onMouseMove (e) {
    const rect = e.target.getBoundingClientRect()

    this.mousePosition = {
      x: e.pageX - rect.left,
      y: e.pageY - rect.top
    }

    if (this.isDragging) {
      this.vp.pan.x = e.pageX - this.dragStart.x
      this.clearAll()
      this.renderAll()
    } else {
      this.clear(this.drawingCanvas, 'rgba(0, 0, 0, 0)')
      this.renderDrawings()
    }
  }
}
