// The NSW Fuel API covers New South Wales (including the ACT) and Tasmania. These are rough
// bounding boxes used only to explain an empty result, never to block a request.
const COVERAGE_BOXES = [
  { minLat: -37.6, maxLat: -28.0, minLon: 140.9, maxLon: 153.7 },
  { minLat: -43.8, maxLat: -39.4, minLon: 143.5, maxLon: 148.6 }
];

export const isLikelyOutsideCoverage = (latitude: number, longitude: number): boolean =>
  !COVERAGE_BOXES.some(
    (box) =>
      latitude >= box.minLat && latitude <= box.maxLat && longitude >= box.minLon && longitude <= box.maxLon
  );

export const OUTSIDE_COVERAGE_MESSAGE =
  'OnlyFuel currently covers New South Wales, the ACT and Tasmania only, and this location looks to be outside that area.';
