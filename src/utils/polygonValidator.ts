// Polygon Geofence Validation using Turf.js
import * as turf from '@turf/turf';

export interface PolygonCoordinate {
  lat: number;
  lng: number;
}

export interface ValidationResult {
  isInside: boolean;
  distance?: number; // Distance to nearest edge in meters
  areaName?: string;
}

// Validate if a coordinate object is valid
const isValidCoordinate = (coord: unknown): coord is PolygonCoordinate => {
  if (!coord || typeof coord !== 'object') return false;
  const c = coord as Record<string, unknown>;
  return (
    typeof c.lat === 'number' &&
    typeof c.lng === 'number' &&
    !isNaN(c.lat) &&
    !isNaN(c.lng) &&
    isFinite(c.lat) &&
    isFinite(c.lng)
  );
};

// Sanitize coordinates array - filter out invalid ones
export const sanitizeCoordinates = (coords: unknown[]): PolygonCoordinate[] => {
  if (!Array.isArray(coords)) return [];
  return coords.filter(isValidCoordinate);
};

// Convert polygon coordinates to Turf format [lng, lat][]
const toTurfCoordinates = (coords: PolygonCoordinate[]): [number, number][] => {
  // First sanitize the coordinates
  const validCoords = sanitizeCoordinates(coords);
  if (validCoords.length < 3) return [];
  
  const turfCoords = validCoords.map(c => [c.lng, c.lat] as [number, number]);
  // Close the polygon by adding first point at the end if not already closed
  if (turfCoords.length > 0) {
    const first = turfCoords[0];
    const last = turfCoords[turfCoords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      turfCoords.push([...first] as [number, number]);
    }
  }
  return turfCoords;
};

// Check if a point is inside a polygon with accuracy buffer
export const isPointInPolygon = (
  userLat: number,
  userLng: number,
  accuracy: number,
  polygonCoords: PolygonCoordinate[]
): boolean => {
  if (polygonCoords.length < 3) return false;
  
  try {
    const userPoint = turf.point([userLng, userLat]);
    const turfCoords = toTurfCoordinates(polygonCoords);
    const polygon = turf.polygon([turfCoords]);
    
    // Calculate polygon area to determine if buffer should be applied
    const polygonArea = turf.area(polygon); // in square meters
    const polygonSize = Math.sqrt(polygonArea); // approximate "size" in meters
    
    console.log(`📏 Polygon size: ~${polygonSize.toFixed(0)}m, GPS accuracy: ${accuracy}m`);
    
    // Only apply negative buffer if:
    // 1. Accuracy > 10m
    // 2. Polygon is large enough (size > 100m)
    // 3. Buffer is capped at max 25m to avoid over-shrinking small polygons
    let checkPolygon: ReturnType<typeof turf.polygon> = polygon;
    if (accuracy > 10 && polygonSize > 100) {
      const bufferAmount = Math.min(accuracy * 0.5, 25); // Use 50% of accuracy, max 25m
      const buffered = turf.buffer(polygon, -(bufferAmount / 1000), { units: 'kilometers' });
      if (buffered && turf.area(buffered) > 0) {
        checkPolygon = buffered as ReturnType<typeof turf.polygon>;
        console.log(`📏 Applied buffer: -${bufferAmount.toFixed(0)}m (polygon still valid)`);
      } else {
        console.log(`📏 Buffer skipped: would invalidate polygon`);
      }
    } else {
      console.log(`📏 Buffer skipped: accuracy ≤ 10m or polygon too small`);
    }
    
    return turf.booleanPointInPolygon(userPoint, checkPolygon);
  } catch (error) {
    console.error('Error checking point in polygon:', error);
    return false;
  }
};

// Check if a point is inside any of the given polygons
export const isPointInAnyPolygon = (
  userLat: number,
  userLng: number,
  accuracy: number,
  polygons: { name: string; coordinates: PolygonCoordinate[] }[]
): { isInside: boolean; areaName?: string } => {
  for (const polygon of polygons) {
    if (isPointInPolygon(userLat, userLng, accuracy, polygon.coordinates)) {
      return { isInside: true, areaName: polygon.name };
    }
  }
  return { isInside: false };
};

// Calculate polygon area in square meters
export const calculatePolygonArea = (coords: PolygonCoordinate[]): number => {
  const validCoords = sanitizeCoordinates(coords);
  if (validCoords.length < 3) return 0;
  
  try {
    const turfCoords = toTurfCoordinates(validCoords);
    if (turfCoords.length < 4) return 0; // Need at least 4 points (3 + closing point)
    const polygon = turf.polygon([turfCoords]);
    return turf.area(polygon);
  } catch (error) {
    console.error('Error calculating polygon area:', error);
    return 0;
  }
};

// Get the center of a polygon
export const getPolygonCenter = (coords: PolygonCoordinate[]): PolygonCoordinate | null => {
  const validCoords = sanitizeCoordinates(coords);
  if (validCoords.length < 3) return null;
  
  try {
    const turfCoords = toTurfCoordinates(validCoords);
    if (turfCoords.length < 4) return null;
    const polygon = turf.polygon([turfCoords]);
    const center = turf.centroid(polygon);
    return {
      lat: center.geometry.coordinates[1],
      lng: center.geometry.coordinates[0],
    };
  } catch (error) {
    console.error('Error getting polygon center:', error);
    return null;
  }
};

// Get distance from point to polygon edge
export const getDistanceToPolygonEdge = (
  userLat: number,
  userLng: number,
  polygonCoords: PolygonCoordinate[]
): number => {
  if (polygonCoords.length < 3) return Infinity;
  
  try {
    const userPoint = turf.point([userLng, userLat]);
    const turfCoords = toTurfCoordinates(polygonCoords);
    const polygon = turf.polygon([turfCoords]);
    const line = turf.polygonToLine(polygon);
    
    // Distance in kilometers, convert to meters
    const distance = turf.pointToLineDistance(userPoint, line as any, { units: 'kilometers' });
    return distance * 1000;
  } catch (error) {
    console.error('Error calculating distance to polygon edge:', error);
    return Infinity;
  }
};

// Convert radius-based geofence to polygon (circle approximation)
export const circleToPolygon = (
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
  steps: number = 32
): PolygonCoordinate[] => {
  try {
    const center = turf.point([centerLng, centerLat]);
    const circle = turf.circle(center, radiusMeters / 1000, { units: 'kilometers', steps });
    
    const coords = circle.geometry.coordinates[0];
    return coords.map(c => ({ lat: c[1], lng: c[0] }));
  } catch (error) {
    console.error('Error converting circle to polygon:', error);
    return [];
  }
};
