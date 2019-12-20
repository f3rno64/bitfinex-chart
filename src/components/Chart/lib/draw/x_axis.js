import moment from 'moment'
import _last from 'lodash/last'
import _max from 'lodash/max'
import _min from 'lodash/min'
import { TIME_FRAME_WIDTHS } from 'bfx-hf-util'

import drawLine from './line'
import {
  AXIS_COLOR,
  AXIS_TICK_COLOR,
  AXIS_LABEL_COLOR,
  AXIS_LABEL_FONT_NAME,
  AXIS_LABEL_FONT_SIZE_PX,
  AXIS_LABEL_MARGIN_PX,

  AXIS_X_TICK_COUNT,
} from '../config'

/**
 * Renders an X-axis at the specified y coord with dynamic tick rendering based
 * on the provided candle dataset.
 *
 * @param {HTML5Canvas} canvas - target canvas to render on
 * @param {Array[]} candles - candle set in bitfinex format
 * @param {number} y - y position of x axis in px
 * @param {number} width - width of x axis in px
 * @param {number} vpWidth - total viewport width in px
 */
export default (canvas, candles, y, width, vpWidth) => {
  const ctx = canvas.getContext('2d')

  ctx.font = `${AXIS_LABEL_FONT_SIZE_PX} ${AXIS_LABEL_FONT_NAME}`
  ctx.fillStyle = AXIS_LABEL_COLOR
  ctx.textAlign = 'center'

  drawLine(canvas, AXIS_COLOR, [
    { x: 0, y },
    { x: width, y }
  ])

  const rightMTS = _last(candles)[0]
  const leftMTS = candles[0][0]
  const rangeLengthMTS = rightMTS - leftMTS
  const tickWidthPX = vpWidth / AXIS_X_TICK_COUNT
  let ticks = []

  let tickDivisor = 60 * 1000 // 1min by default, overriden below
  const dayCount = rangeLengthMTS / TIME_FRAME_WIDTHS['1D']

  if (dayCount > 1 && dayCount < AXIS_X_TICK_COUNT) {
    tickDivisor = 24 * 60 * 60 * 1000
  } else {
    const hourCount = rangeLengthMTS / TIME_FRAME_WIDTHS['1h']

    if (hourCount > 1 && hourCount < AXIS_X_TICK_COUNT) {
      tickDivisor = 60 * 60 * 1000
    }
  }

  const paddedLeftMTS = leftMTS - (leftMTS % tickDivisor)

  for (let i = 0; i < AXIS_X_TICK_COUNT; i += 1) {
    ticks.push(paddedLeftMTS + (i * tickDivisor))

    if (paddedLeftMTS + ((i + 1) * tickDivisor) > rightMTS) {
      break
    }
  }

  for (let i = 0; i < AXIS_X_TICK_COUNT; i += 1) {
    const mts = ticks[i] // (tickWidthMTS * i) + leftMTS
    const tickX = (((width - (rightMTS - mts)) / width) * vpWidth)
    const tickY = y + AXIS_LABEL_FONT_SIZE_PX + AXIS_LABEL_MARGIN_PX
    const date = new Date(mts)
    let label

    // TODO: wip
    if (date.getHours() === 0) {
      label = `${date.getHours()}:${date.getMinutes()}`
    } else {
      label = moment(date).format('HH:mm')
    }

    ctx.fillText(label, tickX, tickY, tickWidthPX)

    // tick
    drawLine(canvas, AXIS_TICK_COLOR, [
      { x: tickX, y: tickY - AXIS_LABEL_FONT_SIZE_PX },
      { x: tickX, y: 0 },
    ])
  }
}
