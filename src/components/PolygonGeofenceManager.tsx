import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus, Trash2, Edit, Undo2, Save, X, Map } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { calculatePolygonArea, getPolygonCenter, PolygonCoordinate } from '@/utils/polygonValidator';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface GeofenceArea {
  id: string;
  name: string;
  center_lat: number | null;
  center_lng: number | null;
  radius: number | null;
  coordinates: PolygonCoordinate[] | null;
  is_active: boolean;
}

const PolygonGeofenceManager: React.FC = () => {
  const [geofences, setGeofences] = useState<GeofenceArea[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPolygon, setCurrentPolygon] = useState<PolygonCoordinate[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polygonLayerRef = useRef<L.Polygon | null>(null);
  const geofenceLayersRef = useRef<L.Polygon[]>([]);

  useEffect(() => {
    fetchGeofences();
  }, []);

  useEffect(() => {
    if (mapRef.current && !leafletMapRef.current) {
      initializeMap();
    }
    
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (leafletMapRef.current) {
      drawExistingGeofences();
    }
  }, [geofences]);

  const initializeMap = () => {
    if (!mapRef.current) return;
    
    // Default to Jakarta
    const defaultCenter: L.LatLngExpression = [-6.2088, 106.8456];
    
    leafletMapRef.current = L.map(mapRef.current).setView(defaultCenter, 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(leafletMapRef.current);
    
    // Try to get current location
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (leafletMapRef.current) {
          leafletMapRef.current.setView(
            [position.coords.latitude, position.coords.longitude],
            16
          );
        }
      },
      () => console.log('Could not get current location')
    );
  };

  const fetchGeofences = async () => {
    try {
      const { data, error } = await supabase
        .from('geofence_areas')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Parse coordinates from JSON
      const parsed = (data || []).map(g => ({
        ...g,
        coordinates: g.coordinates ? (g.coordinates as unknown as PolygonCoordinate[]) : null
      }));
      
      setGeofences(parsed);
    } catch (error) {
      console.error('Error fetching geofences:', error);
      toast({
        title: "Gagal",
        description: "Gagal memuat area geofence",
        variant: "destructive"
      });
    }
  };

  const drawExistingGeofences = () => {
    if (!leafletMapRef.current) return;
    
    // Clear existing layers
    geofenceLayersRef.current.forEach(layer => layer.remove());
    geofenceLayersRef.current = [];
    
    geofences.forEach(geofence => {
      if (geofence.coordinates && geofence.coordinates.length >= 3) {
        const latLngs = geofence.coordinates.map(c => [c.lat, c.lng] as L.LatLngTuple);
        const polygon = L.polygon(latLngs, {
          color: geofence.is_active ? '#22c55e' : '#9ca3af',
          fillColor: geofence.is_active ? '#22c55e' : '#9ca3af',
          fillOpacity: 0.2,
          weight: 2,
        }).addTo(leafletMapRef.current!);
        
        polygon.bindPopup(`<strong>${geofence.name}</strong><br/>Status: ${geofence.is_active ? 'Aktif' : 'Nonaktif'}`);
        geofenceLayersRef.current.push(polygon);
      } else if (geofence.center_lat && geofence.center_lng && geofence.radius) {
        // Draw circle for radius-based geofence
        const circle = L.circle([geofence.center_lat, geofence.center_lng], {
          radius: geofence.radius,
          color: geofence.is_active ? '#22c55e' : '#9ca3af',
          fillColor: geofence.is_active ? '#22c55e' : '#9ca3af',
          fillOpacity: 0.2,
          weight: 2,
        }).addTo(leafletMapRef.current!);
        
        circle.bindPopup(`<strong>${geofence.name}</strong><br/>Radius: ${geofence.radius}m<br/>Status: ${geofence.is_active ? 'Aktif' : 'Nonaktif'}`);
      }
    });
  };

  const startDrawing = () => {
    if (!leafletMapRef.current) return;
    
    setIsDrawing(true);
    setCurrentPolygon([]);
    clearDrawingLayers();
    
    leafletMapRef.current.on('click', handleMapClick);
    
    toast({
      title: "Mode Menggambar",
      description: "Klik pada peta untuk menambahkan titik polygon (min 3 titik)"
    });
  };

  const handleMapClick = useCallback((e: L.LeafletMouseEvent) => {
    if (!isDrawing || !leafletMapRef.current) return;
    
    const { lat, lng } = e.latlng;
    const newPoint: PolygonCoordinate = { lat, lng };
    
    setCurrentPolygon(prev => {
      const updated = [...prev, newPoint];
      
      // Add marker
      const marker = L.marker([lat, lng], {
        draggable: true,
      }).addTo(leafletMapRef.current!);
      
      marker.on('drag', (event) => {
        const newPos = (event.target as L.Marker).getLatLng();
        const markerIndex = markersRef.current.indexOf(marker);
        setCurrentPolygon(p => {
          const newPolygon = [...p];
          newPolygon[markerIndex] = { lat: newPos.lat, lng: newPos.lng };
          return newPolygon;
        });
      });
      
      markersRef.current.push(marker);
      
      // Update polygon layer
      updatePolygonLayer(updated);
      
      return updated;
    });
  }, [isDrawing]);

  useEffect(() => {
    if (leafletMapRef.current) {
      leafletMapRef.current.off('click');
      if (isDrawing) {
        leafletMapRef.current.on('click', handleMapClick);
      }
    }
  }, [isDrawing, handleMapClick]);

  const updatePolygonLayer = (coords: PolygonCoordinate[]) => {
    if (!leafletMapRef.current) return;
    
    if (polygonLayerRef.current) {
      polygonLayerRef.current.remove();
    }
    
    if (coords.length >= 3) {
      const latLngs = coords.map(c => [c.lat, c.lng] as L.LatLngTuple);
      polygonLayerRef.current = L.polygon(latLngs, {
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.3,
        weight: 2,
        dashArray: '5, 5',
      }).addTo(leafletMapRef.current);
    }
  };

  useEffect(() => {
    updatePolygonLayer(currentPolygon);
  }, [currentPolygon]);

  const clearDrawingLayers = () => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    
    if (polygonLayerRef.current) {
      polygonLayerRef.current.remove();
      polygonLayerRef.current = null;
    }
  };

  const undoLastPoint = () => {
    if (currentPolygon.length === 0) return;
    
    const lastMarker = markersRef.current.pop();
    if (lastMarker) lastMarker.remove();
    
    setCurrentPolygon(prev => prev.slice(0, -1));
  };

  const clearAll = () => {
    clearDrawingLayers();
    setCurrentPolygon([]);
  };

  const cancelDrawing = () => {
    setIsDrawing(false);
    clearDrawingLayers();
    setCurrentPolygon([]);
    setEditingId(null);
    setName('');
    
    if (leafletMapRef.current) {
      leafletMapRef.current.off('click');
    }
  };

  const savePolygon = async () => {
    if (currentPolygon.length < 3) {
      toast({
        title: "Gagal",
        description: "Polygon harus memiliki minimal 3 titik",
        variant: "destructive"
      });
      return;
    }
    
    if (!name.trim()) {
      toast({
        title: "Gagal",
        description: "Nama area harus diisi",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    
    try {
      const center = getPolygonCenter(currentPolygon);
      
      // Convert coordinates to JSON-compatible format
      const coordinatesJson = currentPolygon.map(c => ({ lat: c.lat, lng: c.lng }));
      
      const geofenceData = {
        name: name.trim(),
        coordinates: coordinatesJson as unknown as any,
        center_lat: center?.lat || null,
        center_lng: center?.lng || null,
        radius: null, // Polygon mode doesn't use radius
        is_active: true,
      };
      
      if (editingId) {
        const { error } = await supabase
          .from('geofence_areas')
          .update(geofenceData)
          .eq('id', editingId);
        
        if (error) throw error;
        
        toast({
          title: "Berhasil",
          description: "Area geofence berhasil diperbarui"
        });
      } else {
        const { error } = await supabase
          .from('geofence_areas')
          .insert([geofenceData]);
        
        if (error) throw error;
        
        toast({
          title: "Berhasil",
          description: "Area geofence baru berhasil dibuat"
        });
      }
      
      cancelDrawing();
      fetchGeofences();
    } catch (error) {
      console.error('Error saving geofence:', error);
      toast({
        title: "Gagal",
        description: "Gagal menyimpan area geofence",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const editGeofence = (geofence: GeofenceArea) => {
    setEditingId(geofence.id);
    setName(geofence.name);
    
    if (geofence.coordinates && geofence.coordinates.length >= 3) {
      setCurrentPolygon(geofence.coordinates);
      setIsDrawing(true);
      
      // Add markers for existing polygon
      clearDrawingLayers();
      geofence.coordinates.forEach(coord => {
        if (leafletMapRef.current) {
          const marker = L.marker([coord.lat, coord.lng], {
            draggable: true,
          }).addTo(leafletMapRef.current);
          
          marker.on('drag', (event) => {
            const newPos = (event.target as L.Marker).getLatLng();
            const markerIndex = markersRef.current.indexOf(marker);
            setCurrentPolygon(p => {
              const newPolygon = [...p];
              newPolygon[markerIndex] = { lat: newPos.lat, lng: newPos.lng };
              return newPolygon;
            });
          });
          
          markersRef.current.push(marker);
        }
      });
      
      // Zoom to polygon
      if (leafletMapRef.current) {
        const bounds = L.latLngBounds(geofence.coordinates.map(c => [c.lat, c.lng]));
        leafletMapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  };

  const deleteGeofence = async (id: string) => {
    if (!confirm('Yakin ingin menghapus area geofence ini?')) return;
    
    try {
      const { error } = await supabase
        .from('geofence_areas')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "Berhasil",
        description: "Area geofence berhasil dihapus"
      });
      
      fetchGeofences();
    } catch (error) {
      console.error('Error deleting geofence:', error);
      toast({
        title: "Gagal",
        description: "Gagal menghapus area geofence",
        variant: "destructive"
      });
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('geofence_areas')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "Berhasil",
        description: `Area geofence ${!currentStatus ? 'diaktifkan' : 'dinonaktifkan'}`
      });
      
      fetchGeofences();
    } catch (error) {
      console.error('Error updating geofence status:', error);
      toast({
        title: "Gagal",
        description: "Gagal memperbarui status geofence",
        variant: "destructive"
      });
    }
  };

  const polygonArea = calculatePolygonArea(currentPolygon);

  return (
    <div className="space-y-6">
      {/* Map Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Map className="h-5 w-5" />
            Polygon Geofence Editor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drawing Controls */}
          <div className="flex flex-wrap gap-2">
            {!isDrawing ? (
              <Button onClick={startDrawing}>
                <Plus className="h-4 w-4 mr-2" />
                Gambar Area Baru
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={undoLastPoint} disabled={currentPolygon.length === 0}>
                  <Undo2 className="h-4 w-4 mr-2" />
                  Undo
                </Button>
                <Button variant="outline" onClick={clearAll}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Hapus Semua
                </Button>
                <Button variant="outline" onClick={cancelDrawing}>
                  <X className="h-4 w-4 mr-2" />
                  Batal
                </Button>
              </>
            )}
          </div>
          
          {/* Name Input & Save (when drawing) */}
          {isDrawing && (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Label htmlFor="area-name">Nama Area</Label>
                <Input
                  id="area-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Kantor Pusat"
                />
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={savePolygon} 
                  disabled={currentPolygon.length < 3 || !name.trim() || loading}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {editingId ? 'Update' : 'Simpan'} Area
                </Button>
              </div>
            </div>
          )}
          
          {/* Polygon Info */}
          {currentPolygon.length > 0 && (
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>Titik: {currentPolygon.length}</span>
              {currentPolygon.length >= 3 && (
                <span>Luas: {polygonArea.toLocaleString('id-ID', { maximumFractionDigits: 0 })} m²</span>
              )}
            </div>
          )}
          
          {/* Map Container */}
          <div 
            ref={mapRef} 
            className="w-full h-[400px] rounded-lg border overflow-hidden"
            style={{ zIndex: 0 }}
          />
        </CardContent>
      </Card>
      
      {/* Existing Geofences List */}
      <Card>
        <CardHeader>
          <CardTitle>Area Geofence Tersimpan</CardTitle>
        </CardHeader>
        <CardContent>
          {geofences.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Belum ada area geofence
            </div>
          ) : (
            <div className="space-y-4">
              {geofences.map((geofence) => (
                <div
                  key={geofence.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{geofence.name}</h3>
                      {geofence.coordinates ? (
                        <p className="text-sm text-muted-foreground">
                          Polygon: {geofence.coordinates.length} titik
                          {geofence.coordinates.length >= 3 && (
                            <> • Luas: {calculatePolygonArea(geofence.coordinates).toLocaleString('id-ID', { maximumFractionDigits: 0 })} m²</>
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Radius: {geofence.radius}m
                        </p>
                      )}
                    </div>
                    <Badge 
                      variant={geofence.is_active ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => toggleActive(geofence.id, geofence.is_active)}
                    >
                      {geofence.is_active ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </div>
                  
                  <div className="flex gap-2">
                    {geofence.coordinates && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => editGeofence(geofence)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteGeofence(geofence.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Hapus
                    </Button>
                    {(geofence.center_lat && geofence.center_lng) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(
                          `https://www.google.com/maps?q=${geofence.center_lat},${geofence.center_lng}`,
                          '_blank'
                        )}
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        Lihat di Maps
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PolygonGeofenceManager;
