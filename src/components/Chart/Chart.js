import React from 'react'
import ChartLib from './lib/chart'
import './Chart.css'

export default class Chart extends React.Component {
  constructor (props) {
    super(props)

    this.ohlcCanvasRef = React.createRef()
    this.axisCanvasRef = React.createRef()
    this.drawingCanvasRef = React.createRef()
    this.indicatorCanvasRef = React.createRef()
    this.chart = null
  }

  componentDidMount () {
    const { width, height } = this.props
    const ohlcCanvas = this.ohlcCanvasRef.current
    const axisCanvas = this.axisCanvasRef.current
    const drawingCanvas = this.drawingCanvasRef.current
    const indicatorCanvas = this.indicatorCanvasRef.current

    if (!ohlcCanvas || !axisCanvas || !drawingCanvas || !indicatorCanvas) {
      console.error('mounted without all canvases!')
      return
    }

    if (this.chart) {
      console.error('chart library initialized before mount!')
      return
    }

    const { candles, candleWidth } = this.props

    this.chart = new ChartLib({
      ohlcCanvas,
      axisCanvas,
      drawingCanvas,
      indicatorCanvas,
      data: candles,
      dataWidth: candleWidth,
      width,
      height,
    })
  }

  render () {
    const { width, height } = this.props

    return (
      <div className='bfxc__wrapper' style={{ width, height }}>
        <canvas
          width={width}
          height={height}
          ref={this.axisCanvasRef}
        />

        <canvas
          width={width}
          height={height}
          ref={this.ohlcCanvasRef}
        />

        <canvas
          width={width}
          height={height}
          ref={this.indicatorCanvasRef}
        />

        <canvas
          width={width}
          height={height}
          ref={this.drawingCanvasRef}
        />
      </div>
    )
  }
}
