// GPS Validator - Anti Fake GPS Algorithm

export interface GPSValidationResult {
  isValid: boolean;
  isMocked: boolean;
  reason?: string;
  confidenceScore: number;
}

interface PositionHistory {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy: number;
}

// Store position history for movement analysis
const positionHistory: PositionHistory[] = [];
const MAX_HISTORY_SIZE = 10;

export const addPositionToHistory = (position: GeolocationPosition) => {
  positionHistory.push({
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    timestamp: position.timestamp,
    accuracy: position.coords.accuracy
  });
  
  // Keep only last N positions
  if (positionHistory.length > MAX_HISTORY_SIZE) {
    positionHistory.shift();
  }
};

export const clearPositionHistory = () => {
  positionHistory.length = 0;
};

// Haversine formula for distance calculation
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export const validateGPSPosition = async (
  position: GeolocationPosition
): Promise<GPSValidationResult> => {
  const checks: string[] = [];
  let confidenceScore = 100;

  // 1. Check accuracy - fake GPS often has perfect accuracy (<3m)
  const accuracy = position.coords.accuracy;
  if (accuracy < 3) {
    checks.push('Akurasi GPS terlalu sempurna');
    confidenceScore -= 25;
  } else if (accuracy > 100) {
    // Very poor accuracy might indicate indoor or GPS spoofing
    checks.push('Akurasi GPS sangat buruk');
    confidenceScore -= 10;
  }

  // 2. Check timestamp freshness - data should be recent
  const timeDiff = Date.now() - position.timestamp;
  if (timeDiff > 30000) { // >30 seconds old
    checks.push('Data lokasi terlalu lama');
    confidenceScore -= 20;
  }

  // 3. Check altitude - real GPS usually has altitude data
  // Note: Some devices/browsers don't provide altitude, so this is a soft check
  const altitude = position.coords.altitude;
  const altitudeAccuracy = position.coords.altitudeAccuracy;
  
  if (altitude === null && altitudeAccuracy === null) {
    // No altitude data - minor flag
    confidenceScore -= 5;
  } else if (altitude !== null) {
    // Check for suspicious altitude values
    if (altitude < -500 || altitude > 10000) {
      checks.push('Ketinggian GPS tidak wajar');
      confidenceScore -= 15;
    }
  }

  // 4. Check for impossible movement (teleportation)
  if (positionHistory.length > 0) {
    const lastPos = positionHistory[positionHistory.length - 1];
    const timeDeltaSeconds = (position.timestamp - lastPos.timestamp) / 1000;
    
    if (timeDeltaSeconds > 0 && timeDeltaSeconds < 60) {
      const distance = calculateDistance(
        lastPos.lat, lastPos.lng,
        position.coords.latitude, position.coords.longitude
      );
      
      // Speed in m/s
      const speed = distance / timeDeltaSeconds;
      
      // Human walking ~1.4m/s, running ~5m/s, driving ~30m/s
      // Teleportation detection: >100 m/s = 360 km/h (impossible for pedestrian)
      if (speed > 100) {
        checks.push('Perpindahan lokasi tidak wajar (teleportasi)');
        confidenceScore -= 40;
      } else if (speed > 50 && accuracy < 10) {
        // High speed with high accuracy - suspicious
        checks.push('Kecepatan tinggi dengan akurasi sempurna');
        confidenceScore -= 20;
      }
    }
  }

  // 5. Check for coordinate consistency
  // Fake GPS often produces coordinates with too many decimal places of precision
  // or coordinates that don't change at all
  if (positionHistory.length >= 3) {
    const recentPositions = positionHistory.slice(-3);
    const allSame = recentPositions.every(p => 
      p.lat === position.coords.latitude && 
      p.lng === position.coords.longitude
    );
    
    if (allSame && accuracy < 5) {
      checks.push('Posisi tidak berubah dengan akurasi tinggi');
      confidenceScore -= 15;
    }
  }

  // 6. Speed consistency check
  const speed = position.coords.speed;
  if (speed !== null) {
    // Speed is available
    if (speed < 0) {
      checks.push('Kecepatan GPS negatif');
      confidenceScore -= 30;
    } else if (speed > 100) {
      // >360 km/h - suspicious for ground vehicle
      checks.push('Kecepatan GPS tidak wajar');
      confidenceScore -= 20;
    }
  }

  // Add current position to history
  addPositionToHistory(position);

  // Determine if mocked based on confidence score
  const isMocked = confidenceScore < 50;
  
  return {
    isValid: !isMocked,
    isMocked,
    reason: checks.length > 0 ? checks.join(', ') : undefined,
    confidenceScore
  };
};

// Quick validation without history tracking (for kiosk mode)
export const quickValidateGPS = (position: GeolocationPosition): boolean => {
  // Only check basic indicators
  const accuracy = position.coords.accuracy;
  const timeDiff = Date.now() - position.timestamp;
  
  // Reject if accuracy is impossibly good or data is stale
  if (accuracy < 2 || timeDiff > 60000) {
    return false;
  }
  
  return true;
};
