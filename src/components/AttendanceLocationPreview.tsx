import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, XCircle, MapPin, Loader2 } from 'lucide-react';
import { PolygonCoordinate } from '@/utils/polygonValidator';

interface AttendanceLocationPreviewProps {
  userLat: number;
  userLng: number;
  accuracy: number;
  isInsideGeofence: boolean;
  geofenceName?: string;
  polygonCoords?: PolygonCoordinate[];
  className?: string;
}

const AttendanceLocationPreview: React.FC<AttendanceLocationPreviewProps> = ({
  userLat,
  userLng,
  accuracy,
  isInsideGeofence,
  geofenceName,
  polygonCoords,
  className,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const LRef = useRef<any>(null);

  useEffect(() => {
    const loadMap = async () => {
      if (!mapRef.current) return;
      
      try {
        // Dynamically import Leaflet
        const L = await import('leaflet');
        await import('leaflet/dist/leaflet.css');
        
        LRef.current = L.default || L;
        
        // Initialize map
        leafletMapRef.current = LRef.current.map(mapRef.current, {
          zoomControl: false,
          attributionControl: false,
          dragging: false,
          touchZoom: false,
          doubleClickZoom: false,
          scrollWheelZoom: false,
        }).setView([userLat, userLng], 17);

        LRef.current.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(leafletMapRef.current);
        
        setLoading(false);
        updateMapLayers();
      } catch (error) {
        console.error('Failed to load map:', error);
        setLoading(false);
      }
    };
    
    loadMap();

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  const updateMapLayers = () => {
    if (!leafletMapRef.current || !LRef.current) return;
    
    const L = LRef.current;
    const map = leafletMapRef.current;

    // Clear existing layers
    map.eachLayer((layer: any) => {
      if (!(layer._url)) { // Keep tile layer
        layer.remove();
      }
    });

    // Draw polygon geofence if available
    if (polygonCoords && polygonCoords.length >= 3) {
      const latLngs = polygonCoords.map(c => [c.lat, c.lng]);
      L.polygon(latLngs, {
        color: '#22c55e',
        fillColor: '#22c55e',
        fillOpacity: 0.2,
        weight: 2,
      }).addTo(map);
    }

    // Draw accuracy circle
    L.circle([userLat, userLng], {
      radius: accuracy,
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.1,
      weight: 1,
      dashArray: '4, 4',
    }).addTo(map);

    // Custom user marker
    const userIcon = L.divIcon({
      html: `
        <div style="
          width: 20px;
          height: 20px;
          background: #3b82f6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        "></div>
      `,
      className: '',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    L.marker([userLat, userLng], { icon: userIcon }).addTo(map);

    // Fit bounds
    if (polygonCoords && polygonCoords.length >= 3) {
      const bounds = L.latLngBounds([
        [userLat, userLng],
        ...polygonCoords.map(c => [c.lat, c.lng])
      ]);
      map.fitBounds(bounds, { padding: [30, 30] });
    } else {
      map.setView([userLat, userLng], 17);
    }
  };

  useEffect(() => {
    if (!loading && leafletMapRef.current) {
      updateMapLayers();
    }
  }, [userLat, userLng, accuracy, polygonCoords, loading]);

  return (
    <Card className={className}>
      <CardContent className="p-0 overflow-hidden rounded-lg">
        {/* Map */}
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          <div ref={mapRef} className="w-full h-[200px]" style={{ zIndex: 0 }} />
        </div>
        
        {/* Status Bar */}
        <div className={`p-3 flex items-center gap-3 ${
          isInsideGeofence 
            ? 'bg-green-50 border-t border-green-200' 
            : 'bg-red-50 border-t border-red-200'
        }`}>
          {isInsideGeofence ? (
            <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
          ) : (
            <XCircle className="h-5 w-5 text-red-600 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${isInsideGeofence ? 'text-green-700' : 'text-red-700'}`}>
              {isInsideGeofence 
                ? `Anda berada di dalam area ${geofenceName || 'kantor'} ✓` 
                : 'Anda berada di luar area kantor ✗'
              }
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Akurasi: {accuracy.toFixed(0)}m
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendanceLocationPreview;
