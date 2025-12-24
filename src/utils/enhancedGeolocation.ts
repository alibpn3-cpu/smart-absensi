// Enhanced Geolocation Utility with Multiple Readings
// Provides better accuracy through averaging and fallbacks

export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  readingsCount: number;
}

export interface EnhancedLocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  multipleReadings?: boolean;
  readingsCount?: number;
  readingInterval?: number;
}

const DEFAULT_OPTIONS: EnhancedLocationOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
  multipleReadings: true,
  readingsCount: 3,
  readingInterval: 500,
};

// Cache for debouncing
let locationCache: { result: LocationResult; timestamp: number } | null = null;
const CACHE_DURATION = 2000; // 2 seconds

const getSinglePosition = (options: PositionOptions): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
};

const getPositionWithWatchFallback = (options: PositionOptions): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    // First try getCurrentPosition
    const timeoutId = setTimeout(() => {
      // Fallback to watchPosition
      console.log('📍 getCurrentPosition timed out, using watchPosition fallback');
      
      let watchId: number;
      const watchTimeout = setTimeout(() => {
        navigator.geolocation.clearWatch(watchId);
        reject(new Error('Location acquisition failed'));
      }, 5000);

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          clearTimeout(watchTimeout);
          navigator.geolocation.clearWatch(watchId);
          resolve(position);
        },
        (error) => {
          clearTimeout(watchTimeout);
          navigator.geolocation.clearWatch(watchId);
          reject(error);
        },
        options
      );
    }, options.timeout || 10000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId);
        resolve(position);
      },
      (error) => {
        // Let timeout handler try watchPosition
        if (error.code !== error.TIMEOUT) {
          clearTimeout(timeoutId);
          reject(error);
        }
      },
      options
    );
  });
};

const getMultipleReadings = async (
  count: number,
  interval: number,
  positionOptions: PositionOptions
): Promise<GeolocationPosition[]> => {
  const readings: GeolocationPosition[] = [];
  
  for (let i = 0; i < count; i++) {
    try {
      const position = await getSinglePosition(positionOptions);
      readings.push(position);
      console.log(`📍 Reading ${i + 1}/${count}: ${position.coords.latitude}, ${position.coords.longitude} (accuracy: ${position.coords.accuracy}m)`);
      
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    } catch (error) {
      console.warn(`📍 Reading ${i + 1} failed:`, error);
    }
  }
  
  return readings;
};

const averageReadings = (readings: GeolocationPosition[]): LocationResult => {
  if (readings.length === 0) {
    throw new Error('No readings available');
  }
  
  const totalLat = readings.reduce((sum, r) => sum + r.coords.latitude, 0);
  const totalLng = readings.reduce((sum, r) => sum + r.coords.longitude, 0);
  const totalAcc = readings.reduce((sum, r) => sum + r.coords.accuracy, 0);
  
  return {
    latitude: totalLat / readings.length,
    longitude: totalLng / readings.length,
    accuracy: totalAcc / readings.length,
    timestamp: Date.now(),
    readingsCount: readings.length,
  };
};

export const getEnhancedLocation = async (
  customOptions?: EnhancedLocationOptions
): Promise<LocationResult> => {
  const options = { ...DEFAULT_OPTIONS, ...customOptions };
  
  // Check cache for debouncing
  if (locationCache && Date.now() - locationCache.timestamp < CACHE_DURATION) {
    console.log('📍 Using cached location (debounce)');
    return locationCache.result;
  }
  
  const positionOptions: PositionOptions = {
    enableHighAccuracy: options.enableHighAccuracy,
    timeout: options.timeout,
    maximumAge: options.maximumAge,
  };
  
  try {
    let result: LocationResult;
    
    if (options.multipleReadings && options.readingsCount && options.readingsCount > 1) {
      // Get multiple readings and average them
      console.log(`📍 Getting ${options.readingsCount} location readings...`);
      const readings = await getMultipleReadings(
        options.readingsCount,
        options.readingInterval || 500,
        positionOptions
      );
      
      if (readings.length === 0) {
        // Fallback to watch position
        console.log('📍 No readings, trying watchPosition fallback...');
        const position = await getPositionWithWatchFallback(positionOptions);
        result = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now(),
          readingsCount: 1,
        };
      } else {
        result = averageReadings(readings);
        console.log(`📍 Averaged ${readings.length} readings: ${result.latitude}, ${result.longitude} (avg accuracy: ${result.accuracy.toFixed(1)}m)`);
      }
    } else {
      // Single reading with fallback
      const position = await getPositionWithWatchFallback(positionOptions);
      result = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: Date.now(),
        readingsCount: 1,
      };
    }
    
    // Cache the result
    locationCache = { result, timestamp: Date.now() };
    
    return result;
  } catch (error) {
    console.error('📍 Enhanced location failed:', error);
    throw error;
  }
};

export const getAccuracyLevel = (accuracy: number): 'excellent' | 'good' | 'poor' => {
  if (accuracy <= 10) return 'excellent';
  if (accuracy <= 30) return 'good';
  return 'poor';
};

export const getAccuracyMessage = (accuracy: number): string => {
  if (accuracy <= 10) return 'Lokasi sangat akurat';
  if (accuracy <= 30) return 'Lokasi cukup akurat';
  return 'Sinyal GPS lemah, mohon pindah ke area terbuka atau dekat jendela';
};

export const clearLocationCache = (): void => {
  locationCache = null;
};
