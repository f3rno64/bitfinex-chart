function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

import React from 'react';
import ClassNames from 'classnames';
import Scrollbars from 'react-custom-scrollbars';
import { TIME_FRAME_WIDTHS } from 'bfx-hf-util';
import HFI from 'bfx-hf-indicators';
import Dropdown from '../Dropdown';
import ChartLib from './lib/chart';
import formatAxisTick from './lib/util/format_axis_tick';
import './Chart.css';
const TOP_RESERVED_SPACE_PX = 90; // for toolbar and topbar

export default class Chart extends React.Component {
  constructor(props) {
    super(props);

    _defineProperty(this, "state", {
      hoveredCandle: null
    });

    this.onHoveredCandle = this.onHoveredCandle.bind(this);
    this.ohlcCanvasRef = React.createRef();
    this.axisCanvasRef = React.createRef();
    this.drawingCanvasRef = React.createRef();
    this.indicatorCanvasRef = React.createRef();
    this.crosshairCanvasRef = React.createRef();
    this.chart = null;
  }

  componentDidMount() {
    const {
      width,
      height,
      onLoadMore,
      indicators,
      candles,
      candleWidth,
      trades,
      config,
      onTimeFrameChange
    } = this.props;
    const ohlcCanvas = this.ohlcCanvasRef.current;
    const axisCanvas = this.axisCanvasRef.current;
    const drawingCanvas = this.drawingCanvasRef.current;
    const indicatorCanvas = this.indicatorCanvasRef.current;
    const crosshairCanvas = this.crosshairCanvasRef.current;

    if (!ohlcCanvas || !axisCanvas || !drawingCanvas || !indicatorCanvas || !crosshairCanvas) {
      console.error('mounted without all canvases!');
      return;
    }

    if (this.chart) {
      console.error('chart library initialized before mount!');
      return;
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
      config
    });
  }

  componentDidUpdate(prevProps) {
    const {
      candles,
      width,
      height,
      trades,
      indicators
    } = this.props;

    if (candles !== prevProps.candles) {
      this.chart.updateData(candles);
    }

    if (width !== prevProps.width || height !== prevProps.height) {
      this.chart.updateDimensions(width, height);
    }

    if (trades !== prevProps.trades) {
      this.chart.updateTrades(trades);
    }

    if (indicators !== prevProps.indicators) {
      this.chart.updateIndicators(indicators);
    }
  }

  onHoveredCandle(hoveredCandle) {
    this.setState(() => ({
      hoveredCandle
    }));
  }

  render() {
    const {
      width,
      height,
      marketLabel,
      bgColor = '#000',
      candleWidth,
      onTimeFrameChange,
      onAddIndicator
    } = this.props;
    const {
      hoveredCandle
    } = this.state;
    const renderHeight = height - TOP_RESERVED_SPACE_PX;
    return React.createElement("div", {
      className: "bfxc__wrapper",
      style: {
        width: `${width}px`,
        height: `${height}px`
      }
    }, React.createElement("div", {
      className: "bfxc__bg",
      style: {
        width,
        height: renderHeight,
        background: bgColor
      }
    }), React.createElement("div", {
      className: "bfxc__topbar"
    }, React.createElement("p", {
      className: "bfxcs__topbar-market"
    }, marketLabel), React.createElement("div", {
      className: "bfxcs__topbar-ohlc bfxcs__topbar-section"
    }, React.createElement("div", {
      className: "bfxcs__topbar-ohlc-entry"
    }, React.createElement("p", null, "O"), React.createElement("p", null, hoveredCandle ? formatAxisTick(hoveredCandle[1]) : '-')), React.createElement("div", {
      className: "bfxcs__topbar-ohlc-entry"
    }, React.createElement("p", null, "H"), React.createElement("p", null, hoveredCandle ? formatAxisTick(hoveredCandle[3]) : '-')), React.createElement("div", {
      className: "bfxcs__topbar-ohlc-entry"
    }, React.createElement("p", null, "L"), React.createElement("p", null, hoveredCandle ? formatAxisTick(hoveredCandle[4]) : '-')), React.createElement("div", {
      className: "bfxcs__topbar-ohlc-entry"
    }, React.createElement("p", null, "C"), React.createElement("p", null, hoveredCandle ? formatAxisTick(hoveredCandle[2]) : '-'))), React.createElement("div", {
      className: "bfxcs__topbar-tfs bfxcs__topbar-section"
    }, Object.keys(TIME_FRAME_WIDTHS).map(tf => React.createElement("p", {
      key: tf,
      className: ClassNames({
        active: tf === candleWidth
      }),
      onClick: () => onTimeFrameChange && onTimeFrameChange(tf)
    }, tf))), React.createElement("div", {
      className: "bfxc__topbar-indicators"
    }, React.createElement(Dropdown, {
      label: "Indicators"
    }, React.createElement("ul", null, Object.values(HFI).filter(i => !!i.label).map(i => React.createElement("li", {
      key: i.id,
      onClick: () => onAddIndicator && onAddIndicator([i, i.args.map(a => a.default)])
    }, i.humanLabel)))))), React.createElement("div", {
      className: "bfxc__toolbar"
    }), React.createElement("canvas", {
      width: width,
      height: renderHeight,
      ref: this.axisCanvasRef
    }), React.createElement("canvas", {
      width: width,
      height: renderHeight,
      ref: this.ohlcCanvasRef
    }), React.createElement("canvas", {
      width: width,
      height: renderHeight,
      ref: this.indicatorCanvasRef
    }), React.createElement("canvas", {
      width: width,
      height: renderHeight,
      ref: this.drawingCanvasRef
    }), React.createElement("canvas", {
      width: width,
      height: renderHeight,
      ref: this.crosshairCanvasRef
    }));
  }

}