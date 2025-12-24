import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus, Trash2, Edit, Undo2, Save, X, Map, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { calculatePolygonArea, getPolygonCenter, PolygonCoordinate, sanitizeCoordinates } from '@/utils/polygonValidator';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  const [mapLoading, setMapLoading] = useState(true);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polygonLayerRef = useRef<any>(null);
  const geofenceLayersRef = useRef<any[]>([]);
  const LRef = useRef<any>(null);

  useEffect(() => {
    fetchGeofences();
    loadLeaflet();
  }, []);

  const loadLeaflet = async () => {
    try {
      // Dynamically import Leaflet
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      
      // Fix default marker icons
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });
      
      LRef.current = L.default || L;
      setLeafletLoaded(true);
      setMapLoading(false);
    } catch (error) {
      console.error('Failed to load Leaflet:', error);
      setMapLoading(false);
    }
  };

  useEffect(() => {
    if (leafletLoaded && mapRef.current && !leafletMapRef.current) {
      initializeMap();
    }
    
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [leafletLoaded]);

  useEffect(() => {
    if (leafletMapRef.current && leafletLoaded) {
      drawExistingGeofences();
    }
  }, [geofences, leafletLoaded]);

  const initializeMap = () => {
    if (!mapRef.current || !LRef.current) return;
    
    const L = LRef.current;
    const defaultCenter = [-6.2088, 106.8456];
    
    leafletMapRef.current = L.map(mapRef.current).setView(defaultCenter, 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(leafletMapRef.current);
    
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
      
      const parsed = (data || []).map(g => {
        // Sanitize coordinates from database
        let coords: PolygonCoordinate[] | null = null;
        if (g.coordinates) {
          const rawCoords = g.coordinates as unknown as any[];
          coords = sanitizeCoordinates(rawCoords);
          if (coords.length < 3) coords = null;
        }
        return {
          ...g,
          coordinates: coords
        };
      });
      
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
    if (!leafletMapRef.current || !LRef.current) return;
    
    const L = LRef.current;
    
    geofenceLayersRef.current.forEach(layer => layer.remove());
    geofenceLayersRef.current = [];
    
    geofences.forEach(geofence => {
      // Skip the currently editing geofence
      if (geofence.id === editingId) return;
      
      if (geofence.coordinates && geofence.coordinates.length >= 3) {
        // Validate coordinates before drawing
        const validCoords = sanitizeCoordinates(geofence.coordinates);
        if (validCoords.length < 3) return;
        
        const latLngs = validCoords.map(c => [c.lat, c.lng]);
        const polygon = L.polygon(latLngs, {
          color: geofence.is_active ? '#22c55e' : '#9ca3af',
          fillColor: geofence.is_active ? '#22c55e' : '#9ca3af',
          fillOpacity: 0.2,
          weight: 2,
        }).addTo(leafletMapRef.current!);
        
        polygon.bindPopup(`<strong>${geofence.name}</strong><br/>Status: ${geofence.is_active ? 'Aktif' : 'Nonaktif'}`);
        geofenceLayersRef.current.push(polygon);
      } else if (geofence.center_lat && geofence.center_lng && geofence.radius) {
        const circle = L.circle([geofence.center_lat, geofence.center_lng], {
          radius: geofence.radius,
          color: geofence.is_active ? '#22c55e' : '#9ca3af',
          fillColor: geofence.is_active ? '#22c55e' : '#9ca3af',
          fillOpacity: 0.2,
          weight: 2,
        }).addTo(leafletMapRef.current!);
        
        circle.bindPopup(`<strong>${geofence.name}</strong><br/>Radius: ${geofence.radius}m<br/>Status: ${geofence.is_active ? 'Aktif' : 'Nonaktif'}`);
        geofenceLayersRef.current.push(circle);
      }
    });
  };

  const startDrawing = () => {
    if (!leafletMapRef.current || !LRef.current) return;
    
    setIsDrawing(true);
    setCurrentPolygon([]);
    clearDrawingLayers();
    
    toast({
      title: "Mode Menggambar",
      description: "Klik pada peta untuk menambahkan titik polygon (min 3 titik)"
    });
  };

  useEffect(() => {
    if (!leafletMapRef.current || !LRef.current) return;
    
    const L = LRef.current;
    const map = leafletMapRef.current;
    
    const handleMapClick = (e: any) => {
      if (!isDrawing) return;
      
      const { lat, lng } = e.latlng;
      const newPoint: PolygonCoordinate = { lat, lng };
      
      setCurrentPolygon(prev => {
        const updated = [...prev, newPoint];
        
        const marker = L.marker([lat, lng], {
          draggable: true,
        }).addTo(map);
        
        marker.on('drag', (event: any) => {
          const newPos = event.target.getLatLng();
          const markerIndex = markersRef.current.indexOf(marker);
          setCurrentPolygon(p => {
            const newPolygon = [...p];
            newPolygon[markerIndex] = { lat: newPos.lat, lng: newPos.lng };
            return newPolygon;
          });
        });
        
        markersRef.current.push(marker);
        updatePolygonLayer(updated);
        
        return updated;
      });
    };
    
    if (isDrawing) {
      map.on('click', handleMapClick);
    }
    
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isDrawing, leafletLoaded]);

  const updatePolygonLayer = (coords: PolygonCoordinate[]) => {
    if (!leafletMapRef.current || !LRef.current) return;
    
    const L = LRef.current;
    
    if (polygonLayerRef.current) {
      polygonLayerRef.current.remove();
    }
    
    if (coords.length >= 3) {
      const latLngs = coords.map(c => [c.lat, c.lng]);
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
    if (leafletLoaded) {
      updatePolygonLayer(currentPolygon);
    }
  }, [currentPolygon, leafletLoaded]);

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
      const coordinatesJson = currentPolygon.map(c => ({ lat: c.lat, lng: c.lng }));
      
      const geofenceData = {
        name: name.trim(),
        coordinates: coordinatesJson as unknown as any,
        center_lat: center?.lat || null,
        center_lng: center?.lng || null,
        radius: null,
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
    if (!LRef.current || !leafletMapRef.current) return;
    
    const L = LRef.current;
    
    // Scroll to map first
    mapContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    setEditingId(geofence.id);
    setName(geofence.name);
    
    if (geofence.coordinates && geofence.coordinates.length >= 3) {
      // Sanitize coordinates before editing
      const validCoords = sanitizeCoordinates(geofence.coordinates);
      if (validCoords.length < 3) {
        toast({
          title: "Error",
          description: "Koordinat polygon tidak valid",
          variant: "destructive"
        });
        return;
      }
      
      setCurrentPolygon(validCoords);
      setIsDrawing(true);
      
      clearDrawingLayers();
      validCoords.forEach(coord => {
        const marker = L.marker([coord.lat, coord.lng], {
          draggable: true,
        }).addTo(leafletMapRef.current);
        
        marker.on('drag', (event: any) => {
          const newPos = event.target.getLatLng();
          const markerIndex = markersRef.current.indexOf(marker);
          setCurrentPolygon(p => {
            const newPolygon = [...p];
            newPolygon[markerIndex] = { lat: newPos.lat, lng: newPos.lng };
            return newPolygon;
          });
        });
        
        markersRef.current.push(marker);
      });
      
      const bounds = L.latLngBounds(validCoords.map(c => [c.lat, c.lng]));
      leafletMapRef.current.fitBounds(bounds, { padding: [50, 50] });
      
      // Redraw geofences to hide the one being edited
      drawExistingGeofences();
      
      toast({
        title: "Mode Edit",
        description: `Mengedit "${geofence.name}". Drag marker untuk mengubah bentuk polygon.`
      });
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
      <Card ref={mapContainerRef}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Map className="h-5 w-5" />
            Polygon Geofence Editor
            {editingId && (
              <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700">
                EDITING: {name}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Edit Mode Alert */}
          {editingId && (
            <Alert className="border-blue-200 bg-blue-50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                <strong>Mode Edit:</strong> Drag marker untuk mengubah posisi titik. Klik pada peta untuk menambah titik baru.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Name Input - Always visible when drawing/editing */}
          {isDrawing && (
            <div className="p-4 bg-muted rounded-lg border-2 border-dashed border-primary/30">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <Label htmlFor="area-name" className="text-base font-semibold">
                    Nama Area {editingId ? '(sedang diedit)' : '(baru)'}
                  </Label>
                  <Input
                    id="area-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Kantor Pusat"
                    className="mt-1 text-lg"
                    autoFocus
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button 
                    onClick={savePolygon} 
                    disabled={currentPolygon.length < 3 || !name.trim() || loading}
                    className="min-w-[120px]"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {editingId ? 'Update' : 'Simpan'}
                  </Button>
                  <Button variant="outline" onClick={cancelDrawing}>
                    <X className="h-4 w-4 mr-2" />
                    Batal
                  </Button>
                </div>
              </div>
              
              {/* Polygon Info */}
              {currentPolygon.length > 0 && (
                <div className="flex gap-4 text-sm text-muted-foreground mt-3 pt-3 border-t">
                  <span>Titik: {currentPolygon.length}</span>
                  {currentPolygon.length >= 3 && (
                    <span>Luas: {polygonArea.toLocaleString('id-ID', { maximumFractionDigits: 0 })} m²</span>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Drawing Controls */}
          <div className="flex flex-wrap gap-2">
            {!isDrawing ? (
              <Button onClick={startDrawing} disabled={!leafletLoaded}>
                <Plus className="h-4 w-4 mr-2" />
                Gambar Area Baru
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={undoLastPoint} disabled={currentPolygon.length === 0}>
                  <Undo2 className="h-4 w-4 mr-2" />
                  Undo Titik
                </Button>
                <Button variant="outline" onClick={clearAll}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Hapus Semua Titik
                </Button>
              </>
            )}
          </div>
          
          {/* Map Container */}
          <div className="relative">
            {mapLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg z-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            <div 
              ref={mapRef} 
              className="w-full h-[400px] rounded-lg border overflow-hidden"
              style={{ zIndex: 0 }}
            />
          </div>
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
              {geofences.map((geofence) => {
                const isBeingEdited = editingId === geofence.id;
                return (
                  <div
                    key={geofence.id}
                    className={`border rounded-lg p-4 space-y-3 transition-all ${
                      isBeingEdited 
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                        : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold flex items-center gap-2">
                          {geofence.name}
                          {isBeingEdited && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                              Sedang Diedit
                            </Badge>
                          )}
                        </h3>
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
                        onClick={() => !isBeingEdited && toggleActive(geofence.id, geofence.is_active)}
                      >
                        {geofence.is_active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </div>
                    
                    <div className="flex gap-2">
                      {geofence.coordinates && (
                        <Button
                          variant={isBeingEdited ? "default" : "outline"}
                          size="sm"
                          onClick={() => !isBeingEdited && editGeofence(geofence)}
                          disabled={!leafletLoaded || isBeingEdited}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          {isBeingEdited ? 'Sedang Diedit...' : 'Edit'}
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
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PolygonGeofenceManager;
