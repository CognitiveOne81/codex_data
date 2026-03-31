export function floorToMinute(date = new Date()) {
  const d = new Date(date);
  d.setUTCSeconds(0, 0);
  return d;
}

export function timeframeStart(timeframe, now = new Date()) {
  const ts = now.getTime();
  const map = {
    '1D': ts - 24 * 60 * 60 * 1000,
    '1W': ts - 7 * 24 * 60 * 60 * 1000,
    '1M': ts - 30 * 24 * 60 * 60 * 1000,
    '1Y': ts - 365 * 24 * 60 * 60 * 1000,
    ALL: 0,
  };
  return new Date(map[timeframe] || map['1D']);
}

export function bucketSecondsForTimeframe(timeframe) {
  const map = {
    '1D': 5 * 60,
    '1W': 60 * 60,
    '1M': 6 * 60 * 60,
    '1Y': 24 * 60 * 60,
    ALL: 7 * 24 * 60 * 60,
  };
  return map[timeframe] || map['1D'];
}

export function rollingWindowPoints(window, bucketSeconds) {
  const seconds = {
    '1H': 60 * 60,
    '24H': 24 * 60 * 60,
    '7D': 7 * 24 * 60 * 60,
  }[window] || 60 * 60;

  return Math.max(1, Math.round(seconds / bucketSeconds));
}
