import React from 'react'
import ClassNames from 'classnames'
import Scrollbars from 'react-custom-scrollbars'
import { TIME_FRAME_WIDTHS } from 'bfx-hf-util'
import HFI from 'bfx-hf-indicators'

import Dropdown from '../Dropdown'
import ChartLib from './lib/chart'
import formatAxisTick from './lib/util/format_axis_tick'
import LineDrawing from './lib/drawings/line'
import HorizontalLineDrawing from './lib/drawings/horizontal_line'
import VerticalLineDrawing from './lib/drawings/vertical_line'
import './Chart.css'

const TOP_RESERVED_SPACE_PX = 90 // for toolbar and topbar

export default class Chart extends React.Component {
  state = {
    hoveredCandle: null,
  }

  constructor (props) {
    super(props)

    this.onHoveredCandle = this.onHoveredCandle.bind(this)

    this.ohlcCanvasRef = React.createRef()
    this.axisCanvasRef = React.createRef()
    this.drawingCanvasRef = React.createRef()
    this.indicatorCanvasRef = React.createRef()
    this.crosshairCanvasRef = React.createRef()
    this.chart = null
  }

  componentDidMount () {
    const {
      width, height, onLoadMore, indicators, candles, candleWidth, trades,
      config, onTimeFrameChange,
    } = this.props

    const ohlcCanvas = this.ohlcCanvasRef.current
    const axisCanvas = this.axisCanvasRef.current
    const drawingCanvas = this.drawingCanvasRef.current
    const indicatorCanvas = this.indicatorCanvasRef.current
    const crosshairCanvas = this.crosshairCanvasRef.current

    if (
      !ohlcCanvas || !axisCanvas || !drawingCanvas || !indicatorCanvas ||
      !crosshairCanvas
    ) {
      console.error('mounted without all canvases!')
      return
    }

    if (this.chart) {
      console.error('chart library initialized before mount!')
      return
    }

    this.chart = new ChartLib({
      ohlcCanvas,
      axisCanvas,
      drawingCanvas,
      indicatorCanvas,
      crosshairCanvas,
      indicators,
      onLoadMoreCB: onLoadMore,
      onTimeFrameChangeCB: onTimeFrameChange,
      onHoveredCandleCB: this.onHoveredCandle,
      data: candles,
      dataWidth: candleWidth,
      trades,
      width,
      height: height - TOP_RESERVED_SPACE_PX,
      config,
    })
  }

  componentDidUpdate (prevProps) {
    const {
      candles, width, height, trades, indicators, drawings
    } = this.props

    if (candles !== prevProps.candles) {
      this.chart.updateData(candles)
    }

    if (width !== prevProps.width || height !== prevProps.height) {
      this.chart.updateDimensions(width, height)
    }

    if (trades !== prevProps.trades) {
      this.chart.updateTrades(trades)
    }

    if (indicators !== prevProps.indicators) {
      this.chart.updateIndicators(indicators)
    }

    if (drawings !== prevProps.drawings) {
      this.chart.updateDrawings(drawings)
    }
  }

  onHoveredCandle (hoveredCandle) {
    this.setState(() => ({ hoveredCandle }))
  }

  render () {
    const {
      width, height, marketLabel, bgColor = '#000', candleWidth,
      onTimeFrameChange, onAddIndicator, onAddDrawing
    } = this.props

    const { hoveredCandle } = this.state
    const renderHeight = height - TOP_RESERVED_SPACE_PX

    return (
      <div
        className='bfxc__wrapper'
        style={{
          width: `${width}px`,
          height: `${height}px`,
        }}
      >
        <div
          className='bfxc__bg'
          style={{
            width,
            height: renderHeight,
            background: bgColor,
          }}
        />

        <div className='bfxc__topbar'>
          <p className='bfxcs__topbar-market'>
            {marketLabel}
          </p>

          <div className='bfxcs__topbar-ohlc bfxcs__topbar-section'>
            <div className='bfxcs__topbar-ohlc-entry'>
              <p>O</p>
              <p>{hoveredCandle ? formatAxisTick(hoveredCandle[1]) : '-'}</p>
            </div>
            <div className='bfxcs__topbar-ohlc-entry'>
              <p>H</p>
              <p>{hoveredCandle ? formatAxisTick(hoveredCandle[3]) : '-'}</p>
            </div>
            <div className='bfxcs__topbar-ohlc-entry'>
              <p>L</p>
              <p>{hoveredCandle ? formatAxisTick(hoveredCandle[4]) : '-'}</p>
            </div>
            <div className='bfxcs__topbar-ohlc-entry'>
              <p>C</p>
              <p>{hoveredCandle ? formatAxisTick(hoveredCandle[2]) : '-'}</p>
            </div>
          </div>

          <div className='bfxcs__topbar-tfs bfxcs__topbar-section'>
            {Object.keys(TIME_FRAME_WIDTHS).map(tf => (
              <p
                key={tf}
                className={ClassNames({ active: tf === candleWidth })}
                onClick={() => onTimeFrameChange && onTimeFrameChange(tf)}
              >{tf}</p>
            ))}
          </div>

          <div className='bfxc__topbar-indicators'>
            <Dropdown label='Indicators'>
              <ul>
                {Object.values(HFI).filter(i => !!i.label).map(i => (
                  <li
                    key={i.id}
                    onClick={() => onAddIndicator && onAddIndicator([i, i.args.map(a => a.default)])}
                  >{i.humanLabel}</li>
                ))}
              </ul>
            </Dropdown>
          </div>
        </div>

        <ul className='bfxc__toolbar'>
          <li onClick={() => onAddDrawing && onAddDrawing(LineDrawing)}>Line</li>
          <li onClick={() => onAddDrawing && onAddDrawing(HorizontalLineDrawing)}>HLine</li>
          <li onClick={() => onAddDrawing && onAddDrawing(VerticalLineDrawing)}>VLine</li>
        </ul>

        <canvas
          width={width}
          height={renderHeight}
          ref={this.axisCanvasRef}
        />

        <canvas
          width={width}
          height={renderHeight}
          ref={this.ohlcCanvasRef}
        />

        <canvas
          width={width}
          height={renderHeight}
          ref={this.indicatorCanvasRef}
        />

        <canvas
          width={width}
          height={renderHeight}
          ref={this.drawingCanvasRef}
        />

        <canvas
          width={width}
          height={renderHeight}
          ref={this.crosshairCanvasRef}
        />
      </div>
    )
  }
}
