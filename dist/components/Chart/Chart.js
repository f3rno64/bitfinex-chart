import React from 'react';
import ChartLib from './lib/chart';
import './Chart.css';
export default class Chart extends React.Component {
  constructor(props) {
    super(props);
    this.ohlcCanvasRef = React.createRef();
    this.axisCanvasRef = React.createRef();
    this.drawingCanvasRef = React.createRef();
    this.indicatorCanvasRef = React.createRef();
    this.chart = null;
  }

  componentDidMount() {
    const {
      width,
      height,
      onLoadMore
    } = this.props;
    const ohlcCanvas = this.ohlcCanvasRef.current;
    const axisCanvas = this.axisCanvasRef.current;
    const drawingCanvas = this.drawingCanvasRef.current;
    const indicatorCanvas = this.indicatorCanvasRef.current;

    if (!ohlcCanvas || !axisCanvas || !drawingCanvas || !indicatorCanvas) {
      console.error('mounted without all canvases!');
      return;
    }

    if (this.chart) {
      console.error('chart library initialized before mount!');
      return;
    }

    const {
      indicators,
      candles,
      candleWidth
    } = this.props;
    this.chart = new ChartLib({
      ohlcCanvas,
      axisCanvas,
      drawingCanvas,
      indicatorCanvas,
      indicators,
      onLoadMoreCB: onLoadMore,
      data: candles,
      dataWidth: candleWidth,
      width,
      height
    });
  }

  componentDidUpdate(prevProps) {
    const {
      candles,
      width,
      height
    } = this.props;

    if (candles !== prevProps.candles) {
      this.chart.updateData(candles);
    }

    if (width !== prevProps.width || height !== prevProps.height) {
      this.chart.updateDimensions(width, height);
    }
  }

  render() {
    const {
      width,
      height
    } = this.props;
    return React.createElement("div", {
      className: "bfxc__wrapper",
      style: {
        width: `${width + 32}px`,
        height: `${height + 32}px`
      }
    }, React.createElement("div", {
      className: "bfxc__bg",
      style: {
        width,
        height
      }
    }), React.createElement("div", {
      className: "bfxc__topbar"
    }), React.createElement("div", {
      className: "bfxc__sidebar"
    }), React.createElement("canvas", {
      width: width,
      height: height,
      ref: this.axisCanvasRef
    }), React.createElement("canvas", {
      width: width,
      height: height,
      ref: this.ohlcCanvasRef
    }), React.createElement("canvas", {
      width: width,
      height: height,
      ref: this.indicatorCanvasRef
    }), React.createElement("canvas", {
      width: width,
      height: height,
      ref: this.drawingCanvasRef
    }));
  }

}