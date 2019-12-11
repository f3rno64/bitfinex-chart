import _max from 'lodash/max'
import _min from 'lodash/min'

/**
 * Returns a transformer object with methods to map X & Y coords to a certain
 * viewport.
 *
 * @param {number[]} data - complete dataset for min/max bounds
 * @param {number} vWidth - viewport width in pixels
 * @param {number} rightMTS - right-most timestamp
 * @return {Object} transformer
 */
export default function (data, vWidth, rightMTS) {
  const maxP = _max(data)
  const minP = _min(data)
  const pd = maxP - minP

  const x = (dX, targetWidth) => {
    return ((vWidth - (rightMTS - dX)) / vWidth) * targetWidth
  }

  const y = (dY, targetHeight) => {
    return ((dY - minP) / pd) * targetHeight
  }

  return { x, y }
}