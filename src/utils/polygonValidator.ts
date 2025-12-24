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

// Convert polygon coordinates to Turf format [lng, lat][]
const toTurfCoordinates = (coords: PolygonCoordinate[]): [number, number][] => {
  const turfCoords = coords.map(c => [c.lng, c.lat] as [number, number]);
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
    
    // Shrink polygon by accuracy for safety margin (negative buffer)
    // Only apply buffer if accuracy > 10m to avoid over-shrinking
    let checkPolygon: ReturnType<typeof turf.polygon> = polygon;
    if (accuracy > 10) {
      const buffered = turf.buffer(polygon, -(accuracy / 1000), { units: 'kilometers' });
      if (buffered) {
        checkPolygon = buffered as ReturnType<typeof turf.polygon>;
      }
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
  if (coords.length < 3) return 0;
  
  try {
    const turfCoords = toTurfCoordinates(coords);
    const polygon = turf.polygon([turfCoords]);
    return turf.area(polygon);
  } catch (error) {
    console.error('Error calculating polygon area:', error);
    return 0;
  }
};

// Get the center of a polygon
export const getPolygonCenter = (coords: PolygonCoordinate[]): PolygonCoordinate | null => {
  if (coords.length < 3) return null;
  
  try {
    const turfCoords = toTurfCoordinates(coords);
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
