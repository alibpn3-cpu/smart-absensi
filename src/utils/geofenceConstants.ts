// Shared geofence constants for consistent tolerance logic across the application

export const GEOFENCE_CONSTANTS = {
  MIN_TOLERANCE: 10,           // Minimum baseline tolerance (meters)
  MAX_ABSOLUTE_TOLERANCE: 150, // Maximum cap to prevent abuse (meters)
  GPS_TOLERANCE_FACTOR: 0.5,   // 50% of GPS accuracy becomes tolerance
  MAX_ACCEPTABLE_ACCURACY: 200 // Reject GPS readings worse than this (meters)
};

/**
 * Calculate adaptive tolerance based on GPS accuracy and admin settings.
 * 
 * Logic:
 * 1. Calculate GPS-based tolerance = max(accuracy * 0.5, 10m minimum)
 * 2. Use the LARGER of GPS-based tolerance or admin-set tolerance
 * 3. Cap at absolute maximum (150m) to prevent abuse
 * 
 * This ensures:
 * - Indoor users with poor GPS (e.g., 65m accuracy) can still clock in
 * - Outdoor users with good GPS maintain precision
 * - Maximum tolerance is capped for security
 * 
 * @param gpsAccuracy - GPS accuracy in meters from device
 * @param adminTolerance - Admin-set tolerance from geofence settings
 * @returns Calculated adaptive tolerance in meters
 */
export const calculateAdaptiveTolerance = (
  gpsAccuracy: number,
  adminTolerance: number
): { finalTolerance: number; gpsTolerance: number } => {
  const { MIN_TOLERANCE, MAX_ABSOLUTE_TOLERANCE, GPS_TOLERANCE_FACTOR } = GEOFENCE_CONSTANTS;
  
  // Step 1: Calculate GPS-based tolerance (50% of accuracy, minimum 10m)
  const gpsTolerance = Math.max(gpsAccuracy * GPS_TOLERANCE_FACTOR, MIN_TOLERANCE);
  
  // Step 2: Use the LARGER of GPS-based or admin-set tolerance
  const rawTolerance = Math.max(gpsTolerance, adminTolerance);
  
  // Step 3: Cap at absolute maximum
  const finalTolerance = Math.min(rawTolerance, MAX_ABSOLUTE_TOLERANCE);
  
  console.log(`📏 Toleransi Adaptif: GPS=${gpsTolerance.toFixed(0)}m, Admin=${adminTolerance}m → Final=${finalTolerance.toFixed(0)}m`);
  
  return { finalTolerance, gpsTolerance };
};
