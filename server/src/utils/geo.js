export function isInsideRect(position, rect) {
  return (
    position.lat >= rect.latMin &&
    position.lat <= rect.latMax &&
    position.lon >= rect.lonMin &&
    position.lon <= rect.lonMax
  );
}
