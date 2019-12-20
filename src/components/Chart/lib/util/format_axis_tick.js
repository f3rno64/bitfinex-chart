
export default (tick) => {
  return tick.toLocaleString('en-US', {
    maximumFractionDigits: 8,
  })
}
