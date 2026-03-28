export function floorToMinute(date = new Date()) {
  const d = new Date(date);
  d.setUTCSeconds(0, 0);
  return d;
}

export function timeframeToInterval(timeframe) {
  const map = {
    '1H': 60 * 60 * 1000,
    '1D': 24 * 60 * 60 * 1000,
    '1W': 7 * 24 * 60 * 60 * 1000,
    '1M': 30 * 24 * 60 * 60 * 1000,
    '3M': 90 * 24 * 60 * 60 * 1000,
    '1Y': 365 * 24 * 60 * 60 * 1000,
    ALL: 5 * 365 * 24 * 60 * 60 * 1000,
  };
  return map[timeframe] || map['1D'];
}
