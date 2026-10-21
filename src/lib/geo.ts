import type { Coordinates } from '@/types';

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const haversineKm = (a: Coordinates, b: Coordinates): number => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude));
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
