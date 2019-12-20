import _last from 'lodash/last'
import _max from 'lodash/max'
import _min from 'lodash/min'

import drawLine from './line'
import formatAxisTick from '../util/format_axis_tick'
import {
  AXIS_COLOR,
  AXIS_TICK_COLOR,
  AXIS_LABEL_COLOR,
  AXIS_LABEL_FONT_NAME,
  AXIS_LABEL_FONT_SIZE_PX,
  AXIS_LABEL_MARGIN_PX,

  AXIS_Y_TICK_COUNT,
} from '../config'

/**
 * Renders a Y-axis at the specified X coord with dynamic tick rendering based
 * on the provided candle dataset.
 *
 * @param {HTML5Canvas} canvas - target canvas to render on
 * @param {Array[]} candles - candle set in bitfinex format
 * @param {number} x - x position of y axis in px
 * @param {number} height - total axis height in px
 * @param {number} vpHeight - actual viewport height in px
 */
export default (canvas, candles, x, height, vpHeight) => {
  const ctx = canvas.getContext('2d')

  ctx.font = `${AXIS_LABEL_FONT_SIZE_PX} ${AXIS_LABEL_FONT_NAME}`
  ctx.fillStyle = AXIS_LABEL_COLOR
  ctx.textAlign = 'left'

  drawLine(canvas, AXIS_COLOR, [
    { x, y: 0 },
    { x, y: height },
  ])

  const maxP = _max(candles.map(ohlc => ohlc[3]))
  const minP = _min(candles.map(ohlc => ohlc[4]))
  const pd = maxP - minP

  const tickHeightPX = height / AXIS_Y_TICK_COUNT
  const tickHeightPrice = pd / AXIS_Y_TICK_COUNT

  for (let i = 0; i < AXIS_Y_TICK_COUNT; i += 1) {
    const tickY = vpHeight - (tickHeightPX * i)
    const tickX = x + AXIS_LABEL_MARGIN_PX
    const tick = Math.floor(minP + (tickHeightPrice * i))

    ctx.fillText(formatAxisTick(tick), tickX, tickY, canvas.width - x)

    // tick
    drawLine(canvas, AXIS_TICK_COLOR, [
      { x: tickX - 3, y: tickY - (AXIS_LABEL_FONT_SIZE_PX / 2) },
      { x: 0, y: tickY - (AXIS_LABEL_FONT_SIZE_PX / 2) },
    ])
  }
}
