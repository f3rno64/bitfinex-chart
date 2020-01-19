function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

import React from 'react';
import HFI from 'bfx-hf-indicators';
import Chart from './components/Chart';
import MockCandleData from './btc_candle_data.json';
MockCandleData.sort((a, b) => a[0] - b[0]);
export default class Demo extends React.PureComponent {
  constructor(props) {
    super(props);

    _defineProperty(this, "state", {
      indicators: [],
      drawings: []
    });

    this.onAddIndicator = this.onAddIndicator.bind(this);
    this.onAddDrawing = this.onAddDrawing.bind(this);
    this.chartRef = React.createRef();
  }

  onAddIndicator(i) {
    this.setState(({
      indicators
    }) => ({
      indicators: [...indicators, i]
    }));
  }

  onAddDrawing(D) {
    this.setState(({
      drawings
    }) => ({
      drawings: [new D(this.chartRef.current.chart), ...drawings]
    }));
  }

  render() {
    const {
      drawings,
      indicators
    } = this.state;
    return React.createElement("div", {
      id: "bitfinex-chart-demo__bfxc"
    }, React.createElement(Chart, {
      ref: this.chartRef,
      indicators: indicators,
      drawings: drawings,
      marketLabel: "BTC/USD",
      candles: MockCandleData,
      candleWidth: "1m",
      width: 1600,
      height: 900,
      onAddIndicator: this.onAddIndicator,
      onAddDrawing: this.onAddDrawing
    }));
  }

}