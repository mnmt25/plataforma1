export function nowUtc() {
  return new Date().toISOString();
}

export function addMinutes(dateIso, minutes) {
  const date = new Date(dateIso);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

export function isExpired(dateIso) {
  return new Date(dateIso) <= new Date();
}
