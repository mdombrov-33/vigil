export interface CityLocation {
  id: number;
  x: number; // percentage from left
  y: number; // percentage from top
}

// Fixed gameplay slots spread across the map image
// These are anonymous positions — no district names, just coordinates
export const cityLocations: CityLocation[] = [
  { id: 1, x: 18, y: 26 },
  { id: 2, x: 42, y: 22 },
  { id: 3, x: 68, y: 28 },
  { id: 4, x: 82, y: 20 },
  { id: 5, x: 28, y: 40 },
  { id: 6, x: 55, y: 38 },
  { id: 7, x: 75, y: 44 },
  { id: 8, x: 12, y: 56 },
  { id: 9, x: 38, y: 58 },
  { id: 10, x: 62, y: 60 },
  { id: 11, x: 85, y: 62 },
  { id: 12, x: 22, y: 72 },
  { id: 13, x: 48, y: 74 },
  { id: 14, x: 72, y: 76 },
  { id: 15, x: 35, y: 84 },
  { id: 16, x: 58, y: 86 },
  { id: 17, x: 88, y: 82 },
];
