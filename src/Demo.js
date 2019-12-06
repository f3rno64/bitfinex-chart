import React from 'react'
import Chart from './components/Chart'
import MockCandleData from './btc_candle_data.json'

MockCandleData.sort((a, b) => a[0] - b[0])

export default class Demo extends React.PureComponent {

  render () {
    return (
      <div id="bitfinex-chart-demo__bfxc">
        <Chart
          candles={MockCandleData}
          candleWidth={60 * 1000}
          width={800}
          height={600}
        />
      </div>
    )
  }
}
