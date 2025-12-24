import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus, Trash2, Edit, Undo2, Save, X, Map, Loader2, ExternalLink, Circle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { calculatePolygonArea, getPolygonCenter, PolygonCoordinate, sanitizeCoordinates } from '@/utils/polygonValidator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

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
  const [currentPolygon, setCurrentPolygon] = useState<PolygonCoordinate[]>([]);
  const [editingGeofence, setEditingGeofence] = useState<GeofenceArea | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isNewMode, setIsNewMode] = useState(false);
  const [name, setName] = useState('');
  const [radius, setRadius] = useState<number>(100);
  const [loading, setLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polygonLayerRef = useRef<any>(null);
  const circleLayerRef = useRef<any>(null);
  const geofenceLayersRef = useRef<any[]>([]);
  const LRef = useRef<any>(null);

  useEffect(() => {
    fetchGeofences();
    loadLeaflet();
  }, []);

  const loadLeaflet = async () => {
    try {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      
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

  // Initialize map when dialog opens
  useEffect(() => {
    if (isDialogOpen && leafletLoaded && mapRef.current && !leafletMapRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        initializeMap();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isDialogOpen, leafletLoaded]);

  // Cleanup map when dialog closes
  useEffect(() => {
    if (!isDialogOpen && leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
      clearDrawingLayers();
    }
  }, [isDialogOpen]);

  const initializeMap = () => {
    if (!mapRef.current || !LRef.current) return;
    
    const L = LRef.current;
    const defaultCenter = [-6.2088, 106.8456];
    
    leafletMapRef.current = L.map(mapRef.current).setView(defaultCenter, 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(leafletMapRef.current);
    
    // If editing, show existing geofence
    if (editingGeofence) {
      if (editingGeofence.coordinates && editingGeofence.coordinates.length >= 3) {
        const validCoords = sanitizeCoordinates(editingGeofence.coordinates);
        if (validCoords.length >= 3) {
          setCurrentPolygon(validCoords);
          loadPolygonForEditing(validCoords);
          const bounds = L.latLngBounds(validCoords.map((c: PolygonCoordinate) => [c.lat, c.lng]));
          leafletMapRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      } else if (editingGeofence.center_lat && editingGeofence.center_lng) {
        // Radius-based geofence
        setRadius(editingGeofence.radius || 100);
        leafletMapRef.current.setView([editingGeofence.center_lat, editingGeofence.center_lng], 16);
        drawRadiusCircle(editingGeofence.center_lat, editingGeofence.center_lng, editingGeofence.radius || 100);
      }
    } else {
      // New geofence - try to get current location
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
    }
    
    // Setup click handler for drawing
    setupMapClickHandler();
  };

  const setupMapClickHandler = () => {
    if (!leafletMapRef.current || !LRef.current) return;
    
    const L = LRef.current;
    const map = leafletMapRef.current;
    
    map.on('click', (e: any) => {
      // Only allow adding points for polygon mode (new or editing polygon)
      if (editingGeofence && !editingGeofence.coordinates) {
        // Radius mode - move center
        const { lat, lng } = e.latlng;
        drawRadiusCircle(lat, lng, radius);
        return;
      }
      
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
    });
  };

  const loadPolygonForEditing = (coords: PolygonCoordinate[]) => {
    if (!leafletMapRef.current || !LRef.current) return;
    
    const L = LRef.current;
    
    coords.forEach(coord => {
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
    
    updatePolygonLayer(coords);
  };

  const drawRadiusCircle = (lat: number, lng: number, r: number) => {
    if (!leafletMapRef.current || !LRef.current) return;
    
    const L = LRef.current;
    
    if (circleLayerRef.current) {
      circleLayerRef.current.remove();
    }
    
    circleLayerRef.current = L.circle([lat, lng], {
      radius: r,
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.3,
      weight: 2,
    }).addTo(leafletMapRef.current);
    
    // Update editing geofence with new center
    if (editingGeofence) {
      setEditingGeofence({
        ...editingGeofence,
        center_lat: lat,
        center_lng: lng,
        radius: r
      });
    }
  };

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
    if (leafletLoaded && isDialogOpen) {
      updatePolygonLayer(currentPolygon);
    }
  }, [currentPolygon, leafletLoaded, isDialogOpen]);

  // Update circle when radius changes
  useEffect(() => {
    if (editingGeofence && !editingGeofence.coordinates && circleLayerRef.current && editingGeofence.center_lat && editingGeofence.center_lng) {
      drawRadiusCircle(editingGeofence.center_lat, editingGeofence.center_lng, radius);
    }
  }, [radius]);

  const fetchGeofences = async () => {
    try {
      const { data, error } = await supabase
        .from('geofence_areas')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const parsed = (data || []).map(g => {
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

  const clearDrawingLayers = () => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    
    if (polygonLayerRef.current) {
      polygonLayerRef.current.remove();
      polygonLayerRef.current = null;
    }
    
    if (circleLayerRef.current) {
      circleLayerRef.current.remove();
      circleLayerRef.current = null;
    }
  };

  const undoLastPoint = () => {
    if (currentPolygon.length === 0) return;
    
    const lastMarker = markersRef.current.pop();
    if (lastMarker) lastMarker.remove();
    
    setCurrentPolygon(prev => prev.slice(0, -1));
  };

  const clearAllPoints = () => {
    clearDrawingLayers();
    setCurrentPolygon([]);
  };

  const openNewDialog = () => {
    setEditingGeofence(null);
    setIsNewMode(true);
    setName('');
    setCurrentPolygon([]);
    setRadius(100);
    setIsDialogOpen(true);
  };

  const openEditDialog = (geofence: GeofenceArea) => {
    setEditingGeofence(geofence);
    setIsNewMode(false);
    setName(geofence.name);
    setRadius(geofence.radius || 100);
    setCurrentPolygon([]);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingGeofence(null);
    setIsNewMode(false);
    setName('');
    setCurrentPolygon([]);
    clearDrawingLayers();
  };

  const saveGeofence = async () => {
    const isRadiusMode = editingGeofence && !editingGeofence.coordinates;
    
    if (!isRadiusMode && currentPolygon.length < 3) {
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
      let geofenceData: any;
      
      if (isRadiusMode && editingGeofence) {
        // Radius-based update
        geofenceData = {
          name: name.trim(),
          center_lat: editingGeofence.center_lat,
          center_lng: editingGeofence.center_lng,
          radius: radius,
          coordinates: null,
          is_active: editingGeofence.is_active,
        };
      } else {
        // Polygon mode
        const center = getPolygonCenter(currentPolygon);
        const coordinatesJson = currentPolygon.map(c => ({ lat: c.lat, lng: c.lng }));
        
        geofenceData = {
          name: name.trim(),
          coordinates: coordinatesJson as unknown as any,
          center_lat: center?.lat || null,
          center_lng: center?.lng || null,
          radius: null,
          is_active: editingGeofence?.is_active ?? true,
        };
      }
      
      if (editingGeofence) {
        const { error } = await supabase
          .from('geofence_areas')
          .update(geofenceData)
          .eq('id', editingGeofence.id);
        
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
      
      closeDialog();
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
  const isRadiusMode = editingGeofence && !editingGeofence.coordinates;

  return (
    <div className="space-y-6">
      {/* Main Geofence List Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Map className="h-5 w-5" />
            Semua Area Geofence
          </CardTitle>
          <Button onClick={openNewDialog} disabled={!leafletLoaded}>
            <Plus className="h-4 w-4 mr-2" />
            Tambah Area Baru
          </Button>
        </CardHeader>
        <CardContent>
          {geofences.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Map className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Belum ada area geofence</p>
              <p className="text-sm">Klik "Tambah Area Baru" untuk membuat area geofence pertama</p>
            </div>
          ) : (
            <div className="space-y-3">
              {geofences.map((geofence) => (
                <div
                  key={geofence.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{geofence.name}</h3>
                        <Badge 
                          variant={geofence.is_active ? "default" : "secondary"}
                          className="cursor-pointer text-xs"
                          onClick={() => toggleActive(geofence.id, geofence.is_active)}
                        >
                          {geofence.is_active ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                        {geofence.coordinates ? (
                          <Badge variant="outline" className="text-xs">
                            <MapPin className="h-3 w-3 mr-1" />
                            Polygon
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <Circle className="h-3 w-3 mr-1" />
                            Radius
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {geofence.coordinates ? (
                          <>
                            {geofence.coordinates.length} titik • Luas: {calculatePolygonArea(geofence.coordinates).toLocaleString('id-ID', { maximumFractionDigits: 0 })} m²
                          </>
                        ) : (
                          <>Radius: {geofence.radius}m</>
                        )}
                      </p>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(geofence)}
                        disabled={!leafletLoaded}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteGeofence(geofence.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
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
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              {editingGeofence ? `Edit: ${editingGeofence.name}` : 'Buat Area Geofence Baru'}
            </DialogTitle>
            <DialogDescription>
              {isRadiusMode 
                ? 'Klik pada peta untuk memindahkan titik tengah, atau ubah radius di bawah.'
                : 'Klik pada peta untuk menambahkan titik polygon. Drag marker untuk mengubah posisi.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Name Input */}
            <div className="space-y-2">
              <Label htmlFor="geofence-name">Nama Area</Label>
              <Input
                id="geofence-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Kantor Pusat Jakarta"
                className="text-lg"
              />
            </div>
            
            {/* Radius Input (only for radius mode) */}
            {isRadiusMode && (
              <div className="space-y-2">
                <Label htmlFor="geofence-radius">Radius (meter)</Label>
                <Input
                  id="geofence-radius"
                  type="number"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  min={10}
                  max={10000}
                />
              </div>
            )}
            
            {/* Polygon Info */}
            {!isRadiusMode && currentPolygon.length > 0 && (
              <div className="flex gap-4 text-sm bg-muted p-3 rounded-lg">
                <span className="font-medium">Titik: {currentPolygon.length}</span>
                {currentPolygon.length >= 3 && (
                  <span className="font-medium">Luas: {polygonArea.toLocaleString('id-ID', { maximumFractionDigits: 0 })} m²</span>
                )}
                {currentPolygon.length < 3 && (
                  <span className="text-destructive">Minimal 3 titik diperlukan</span>
                )}
              </div>
            )}
            
            {/* Drawing Controls */}
            {!isRadiusMode && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={undoLastPoint} disabled={currentPolygon.length === 0}>
                  <Undo2 className="h-4 w-4 mr-2" />
                  Undo Titik
                </Button>
                <Button variant="outline" size="sm" onClick={clearAllPoints} disabled={currentPolygon.length === 0}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Hapus Semua
                </Button>
              </div>
            )}
            
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
            
            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={closeDialog}>
                <X className="h-4 w-4 mr-2" />
                Batal
              </Button>
              <Button 
                onClick={saveGeofence} 
                disabled={(!isRadiusMode && currentPolygon.length < 3) || !name.trim() || loading}
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Menyimpan...' : (editingGeofence ? 'Simpan Perubahan' : 'Buat Area')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PolygonGeofenceManager;
