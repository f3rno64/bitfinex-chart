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
import ParallelLineDrawing from './lib/drawings/parallel_lines'
import LoadingBeeSpinner from '../LoadingBeeSpinner'
import IndicatorSettingsModal from '../IndicatorSettingsModal'

import './Chart.css'
import './icon_font/styles.css'

const TOPBAR_HEIGHT = 45
const TOOLBAR_HEIGHT = 45

export default class Chart extends React.Component {
  state = {
    hoveredCandle: null,
    indicatorSettings: [],

    settingsModalOpen: false,
    settingsModalIndicatorIndex: -1,
  }

  constructor (props) {
    super(props)

    this.onHoveredCandle = this.onHoveredCandle.bind(this)
    this.onCloseIndicatorSettings = this.onCloseIndicatorSettings.bind(this)
    this.onOpenIndicatorSettings = this.onOpenIndicatorSettings.bind(this)
    this.onUpdateIndicatorSettings = this.onUpdateIndicatorSettings.bind(this)
    this.onSaveIndicatorSettings = this.onSaveIndicatorSettings.bind(this)

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
      config, onTimeFrameChange, orders, position,
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
      onUpdateIndicatorSettingsCB: this.onUpdateIndicatorSettings,
      data: candles,
      dataWidth: candleWidth,
      trades,
      orders,
      position,
      width,
      height: height - this.getTopReservedSpace(),
      config,
    })
  }

  componentDidUpdate (prevProps) {
    const {
      candles, width, height, trades, indicators, drawings, candleWidth, orders,
      position, disableToolbar, disableTopbar
    } = this.props

    if (candles !== prevProps.candles || candleWidth !== prevProps.candleWidth) {
      this.chart.updateData(candles, candleWidth)
    }

    if (
      (width !== prevProps.width) ||
      (height !== prevProps.height) ||
      (disableToolbar !== prevProps.disableToolbar) ||
      (disableTopbar !== prevProps.disableTopbar)
    ) {
      this.chart.updateDimensions(width, this.getChartHeight())
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

    if (orders !== prevProps.orders) {
      this.chart.updateOrders(orders)
    }

    if (position !== prevProps.position) {
      this.chart.updatePosition(position)
    }
  }

  onHoveredCandle (hoveredCandle) {
    this.setState(() => ({ hoveredCandle }))
  }

  /**
   * @param {Array[]} indicators - array of [iClass, args]
   * @param {number} ohlcVPHeight - height of OHLC viewport
   * @param {number} slotHeight - external indicator slot height
   */
  onUpdateIndicatorSettings (indicators, ohlcVPHeight, slotHeight) {
    let currentExtSlot = 0
    let currentOverlaySlot = 0

    const indicatorSettings = indicators.map(([ Class, args ]) => {
      const { ui } = Class
      const { position } = ui

      return {
        args,
        argsDef: Class.args,
        position,
        name: new Class(args).getName(),
        y: position !== 'external'
          ? ohlcVPHeight - (32 * currentOverlaySlot++)
          : ohlcVPHeight + (slotHeight * ++currentExtSlot)
      }
    })

    this.setState(() => ({ indicatorSettings }))
  }

  onOpenIndicatorSettings (index) {
    this.setState(() => ({
      settingsModalOpen: true,
      settingsModalIndicatorIndex: index,
    }))
  }

  onCloseIndicatorSettings () {
    this.setState(() => ({
      settingsModalOpen: false,
      settingsModalIndicatorIndex: -1,
    }))
  }

  onSaveIndicatorSettings (args) {
    const { onUpdateIndicatorArgs } = this.props
    const { settingsModalIndicatorIndex } = this.state

    onUpdateIndicatorArgs(args, settingsModalIndicatorIndex)
    this.onCloseIndicatorSettings()
  }

  getTopReservedSpace () {
    const { disableTopbar, disableToolbar } = this.props
    let space = 0

    if (!disableToolbar) {
      space += TOOLBAR_HEIGHT
    }

    if (!disableTopbar) {
      space += TOPBAR_HEIGHT
    }

    return space
  }

  getChartHeight () {
    const { height } = this.props
    return height - this.getTopReservedSpace()
  }

  render () {
    const {
      indicatorSettings,
      settingsModalIndicatorIndex,
      settingsModalOpen,
    } = this.state

    const {
      width, height, marketLabel, bgColor = '#000', candleWidth, candles,
      onTimeFrameChange, onAddIndicator, onAddDrawing, isSyncing,
      disableToolbar, disableTopbar, onDeleteIndicator,
    } = this.props

    const { hoveredCandle } = this.state
    const topReservedSpace = this.getTopReservedSpace()
    const renderHeight = this.getChartHeight()
    const canvasStyle = {
      top: `${topReservedSpace}px`,
    }

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
            top: `${topReservedSpace}px`,
          }}
        />

        {!disableTopbar && (
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
              <Dropdown
                label={(
                  <p>
                    <i className='icon-indicators' />
                    Indicators
                    <i className='icon-chevron-down-passive' />
                  </p>
                )}
              >
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

            {isSyncing && (<div className='bfxc__topbar-spinner' />)}
          </div>
        )}

        {!disableToolbar && (
          <ul className='bfxc__toolbar'>
            <li onClick={() => onAddDrawing && onAddDrawing(LineDrawing)}>Line</li>
            <li onClick={() => onAddDrawing && onAddDrawing(HorizontalLineDrawing)}>HLine</li>
            <li onClick={() => onAddDrawing && onAddDrawing(VerticalLineDrawing)}>VLine</li>
            <li onClick={() => onAddDrawing && onAddDrawing(ParallelLineDrawing)}>PLines</li>
          </ul>
        )}

        <canvas
          width={width}
          height={renderHeight}
          ref={this.axisCanvasRef}
          style={canvasStyle}
        />

        <canvas
          width={width}
          height={renderHeight}
          ref={this.ohlcCanvasRef}
          style={canvasStyle}
        />

        <canvas
          width={width}
          height={renderHeight}
          ref={this.indicatorCanvasRef}
          style={canvasStyle}
        />

        <canvas
          width={width}
          height={renderHeight}
          ref={this.drawingCanvasRef}
          style={canvasStyle}
        />

        <canvas
          width={width}
          height={renderHeight}
          ref={this.crosshairCanvasRef}
          style={canvasStyle}
        />

        {indicatorSettings.length > 0 && (
          <ul className='bfxc__overlaysettings-wrapper'>
            {indicatorSettings.map((settings, i) => (
              <li
                key={i}
                style={{
                  borderColor: `${settings.args.__color}99`,
                  top: settings.y,
                  left: 32,
                }}
              >
                <p>{settings.name}</p>

                <i
                  className='icon-settings-icon'
                  onClick={() => this.onOpenIndicatorSettings(i)}
                />

                <i
                  className='icon-cancel'
                  onClick={() => onDeleteIndicator(i)}
                />
              </li>
            ))}
          </ul>
        )}

        {settingsModalOpen && (
          <IndicatorSettingsModal
            settings={indicatorSettings[settingsModalIndicatorIndex]}
            onClose={this.onCloseIndicatorSettings}
            onSave={this.onSaveIndicatorSettings}
            onDelete={() => {
              onDeleteIndicator(settingsModalIndicatorIndex)
              this.onCloseIndicatorSettings()
            }}
          />
        )}

        {candles.length === 0 && (
          <LoadingBeeSpinner />
        )}
      </div>
    )
  }
}
