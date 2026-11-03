/** Use saved property addresses without guessing a city from a street address. */
export function propertyLocation(addresses: readonly (string | null)[]): string | null {
  const locations = addresses
    .map((address) => address?.trim())
    .filter((address): address is string => Boolean(address));
  return [...new Set(locations)].join(" / ") || null;
}
