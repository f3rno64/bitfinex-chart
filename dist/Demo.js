import React from 'react';
import HFI from 'bfx-hf-indicators';
import Chart from './components/Chart';
import MockCandleData from './btc_candle_data.json';
MockCandleData.sort((a, b) => a[0] - b[0]);
export default class Demo extends React.PureComponent {
  render() {
    return React.createElement("div", {
      id: "bitfinex-chart-demo__bfxc"
    }, React.createElement(Chart, {
      indicators: [[HFI.EMA, [20]], [HFI.EMA, [100]], [HFI.RSI, [14]], [HFI.ROC, [20]], [HFI.Acceleration, [20]]],
      candles: MockCandleData,
      candleWidth: 60 * 1000,
      width: 800,
      height: 600
    }));
  }

}