/**
 * Draw a line composed of multiple points
 *
 * @param {Canvas} canvas - target
 * @param {string} style - 2d ctx strokeStyle
 * @param {Object[]} points - array of { x, y } points
 */
export default function drawLine (canvas, style, points = []) {
  const ctx = canvas.getContext('2d')

  ctx.strokeStyle = style

  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)

  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y)
  }

  ctx.stroke()
  ctx.closePath()
}
