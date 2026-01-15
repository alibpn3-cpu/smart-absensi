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

// Parse a value to number (handles string or number)
const parseCoordValue = (value: unknown): number | null => {
  if (typeof value === 'number' && isFinite(value) && !isNaN(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (isFinite(parsed) && !isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
};

// Validate if a coordinate object is valid (supports both number and string lat/lng)
const isValidCoordinate = (coord: unknown): boolean => {
  if (!coord || typeof coord !== 'object') return false;
  const c = coord as Record<string, unknown>;
  const lat = parseCoordValue(c.lat);
  const lng = parseCoordValue(c.lng);
  return lat !== null && lng !== null;
};

// Convert raw coordinate to PolygonCoordinate (handles string values)
const toPolygonCoordinate = (coord: unknown): PolygonCoordinate | null => {
  if (!coord || typeof coord !== 'object') return null;
  const c = coord as Record<string, unknown>;
  const lat = parseCoordValue(c.lat);
  const lng = parseCoordValue(c.lng);
  if (lat !== null && lng !== null) {
    return { lat, lng };
  }
  return null;
};

// Sanitize coordinates array - filter out invalid ones and convert to proper format
export const sanitizeCoordinates = (coords: unknown[]): PolygonCoordinate[] => {
  if (!Array.isArray(coords)) return [];
  const result: PolygonCoordinate[] = [];
  for (const coord of coords) {
    const parsed = toPolygonCoordinate(coord);
    if (parsed) {
      result.push(parsed);
    }
  }
  console.log(`🔍 sanitizeCoordinates: input ${coords.length} points → output ${result.length} valid points`);
  return result;
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

// Check if a point is inside a polygon with GPS accuracy tolerance
// Uses "inclusive tolerance" approach instead of shrinking polygon
export const isPointInPolygon = (
  userLat: number,
  userLng: number,
  accuracy: number,
  polygonCoords: PolygonCoordinate[]
): boolean => {
  console.log(`🔍 isPointInPolygon called: user(${userLat.toFixed(6)}, ${userLng.toFixed(6)}), accuracy: ${accuracy}m, coords: ${polygonCoords.length} points`);
  
  if (polygonCoords.length < 3) {
    console.log(`❌ Polygon invalid: less than 3 coordinates`);
    return false;
  }
  
  try {
    const userPoint = turf.point([userLng, userLat]);
    const turfCoords = toTurfCoordinates(polygonCoords);
    
    if (turfCoords.length < 4) {
      console.log(`❌ Polygon invalid after sanitization: ${turfCoords.length} points (need at least 4 including closing)`);
      return false;
    }
    
    const polygon = turf.polygon([turfCoords]);
    
    // Calculate polygon metrics for logging
    const polygonArea = turf.area(polygon);
    const polygonSize = Math.sqrt(polygonArea);
    console.log(`📏 Polygon size: ~${polygonSize.toFixed(0)}m (area: ${polygonArea.toFixed(0)}m²)`);
    
    // Step 1: Check if point is directly inside polygon (raw check)
    const isInsideRaw = turf.booleanPointInPolygon(userPoint, polygon);
    console.log(`📍 Raw point-in-polygon check: ${isInsideRaw ? 'INSIDE ✅' : 'OUTSIDE'}`);
    
    if (isInsideRaw) {
      return true;
    }
    
    // Step 2: If outside, check distance to edge with GPS tolerance
    // This handles cases where GPS inaccuracy puts user just outside boundary
    const distanceToEdge = getDistanceToPolygonEdge(userLat, userLng, polygonCoords);
    
    // Tolerance: 30% of accuracy, capped at 20m max
    const toleranceMeters = Math.min(accuracy * 0.3, 20);
    
    console.log(`📏 Distance to edge: ${distanceToEdge.toFixed(1)}m, tolerance: ${toleranceMeters.toFixed(1)}m`);
    
    if (distanceToEdge <= toleranceMeters) {
      console.log(`✅ Within tolerance - considering INSIDE`);
      return true;
    }
    
    console.log(`❌ Outside polygon and beyond tolerance`);
    return false;
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
