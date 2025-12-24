import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { MapPin, Plus, Trash2, Edit, Undo2, Save, X, Map, Loader2, ExternalLink, Circle, RefreshCw, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { calculatePolygonArea, getPolygonCenter, PolygonCoordinate, sanitizeCoordinates, circleToPolygon } from '@/utils/polygonValidator';
import * as turf from '@turf/turf';

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
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isNewMode, setIsNewMode] = useState(false);
  const [name, setName] = useState('');
  const [radius, setRadius] = useState<number>(100);
  const [loading, setLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polygonLayerRef = useRef<any>(null);
  const circleLayerRef = useRef<any>(null);
  const geofenceLayersRef = useRef<any[]>([]);
  const LRef = useRef<any>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  
  // Refs to hold latest state for click handler closure
  const editingGeofenceRef = useRef<GeofenceArea | null>(null);
  const currentPolygonRef = useRef<PolygonCoordinate[]>([]);
  const radiusRef = useRef<number>(100);

  useEffect(() => {
    fetchGeofences();
    loadLeaflet();
  }, []);

  // Sync refs with state
  useEffect(() => {
    editingGeofenceRef.current = editingGeofence;
  }, [editingGeofence]);

  useEffect(() => {
    currentPolygonRef.current = currentPolygon;
  }, [currentPolygon]);

  useEffect(() => {
    radiusRef.current = radius;
  }, [radius]);

  const loadLeaflet = async () => {
    try {
      const L = await import('leaflet');
      // CSS is now imported globally in index.css
      
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

  // Initialize map when editor opens (inline panel)
  useEffect(() => {
    if (isEditorOpen && leafletLoaded && mapRef.current) {
      // Use requestAnimationFrame to wait for container to be ready
      let attempts = 0;
      const maxAttempts = 20;
      
      const checkAndInit = () => {
        attempts++;
        const container = mapRef.current;
        
        if (container && container.offsetWidth > 0 && container.offsetHeight > 0) {
          if (!leafletMapRef.current) {
            try {
              initializeMap();
            } catch (e) {
              console.error('Map init error:', e);
              toast({
                title: "Error",
                description: "Gagal menginisialisasi peta",
                variant: "destructive"
              });
            }
          }
          // Call invalidateSize multiple times to ensure proper rendering
          [0, 100, 300, 600].forEach(delay => {
            setTimeout(() => {
              leafletMapRef.current?.invalidateSize();
            }, delay);
          });
        } else if (attempts < maxAttempts) {
          requestAnimationFrame(checkAndInit);
        }
      };
      
      // Start checking after a short delay
      setTimeout(checkAndInit, 50);
      
      // Setup ResizeObserver for dynamic size changes
      if (mapRef.current && !resizeObserverRef.current) {
        resizeObserverRef.current = new ResizeObserver(() => {
          leafletMapRef.current?.invalidateSize();
        });
        resizeObserverRef.current.observe(mapRef.current);
      }
    }
  }, [isEditorOpen, leafletLoaded]);

  // Cleanup map when editor closes
  useEffect(() => {
    if (!isEditorOpen && leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
      clearDrawingLayers();
      
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    }
  }, [isEditorOpen]);

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
      // Use refs to get latest state (avoid closure bug)
      const currentGeofence = editingGeofenceRef.current;
      const polygonPoints = currentPolygonRef.current;
      const currentRadius = radiusRef.current;
      
      // Check if in polygon mode: coordinates exists AND has at least 1 point
      const isPolygonMode = currentGeofence?.coordinates && currentGeofence.coordinates.length > 0;
      
      // If NOT polygon mode (radius mode or new mode without polygon), handle radius
      if (currentGeofence && !isPolygonMode && polygonPoints.length === 0) {
        // Radius mode - move center
        const { lat, lng } = e.latlng;
        drawRadiusCircle(lat, lng, currentRadius);
        return;
      }
      
      // Polygon mode - add new point
      const { lat, lng } = e.latlng;
      const newPoint: PolygonCoordinate = { lat, lng };
      
      setCurrentPolygon(prev => {
        const updated = [...prev, newPoint];
        const pointIndex = updated.length - 1;
        
        addMarkerWithPopup(lat, lng, pointIndex);
        updatePolygonLayer(updated);
        
        return updated;
      });
    });
  };

  const addMarkerWithPopup = (lat: number, lng: number, index: number) => {
    if (!leafletMapRef.current || !LRef.current) return;
    
    const L = LRef.current;
    
    const marker = L.marker([lat, lng], {
      draggable: true,
    }).addTo(leafletMapRef.current);
    
    // Popup untuk hapus titik
    const popupContent = document.createElement('div');
    popupContent.innerHTML = `
      <div style="text-align: center; min-width: 80px;">
        <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 500;">Titik ${index + 1}</p>
        <button class="delete-point-btn" style="background: #ef4444; color: white; padding: 4px 12px; border-radius: 4px; border: none; font-size: 11px; cursor: pointer;">
          Hapus Titik
        </button>
      </div>
    `;
    
    const deleteBtn = popupContent.querySelector('.delete-point-btn');
    deleteBtn?.addEventListener('click', () => {
      removePointAtIndex(markersRef.current.indexOf(marker));
      marker.closePopup();
    });
    
    marker.bindPopup(popupContent);
    
    marker.on('drag', (event: any) => {
      const newPos = event.target.getLatLng();
      const markerIndex = markersRef.current.indexOf(marker);
      setCurrentPolygon(p => {
        const newPolygon = [...p];
        if (markerIndex >= 0 && markerIndex < newPolygon.length) {
          newPolygon[markerIndex] = { lat: newPos.lat, lng: newPos.lng };
        }
        return newPolygon;
      });
    });
    
    markersRef.current.push(marker);
    return marker;
  };

  const removePointAtIndex = (index: number) => {
    if (index < 0) return;
    
    setCurrentPolygon(prev => {
      if (prev.length <= 1) {
        toast({
          title: "Tidak bisa hapus",
          description: "Minimal harus ada 1 titik",
          variant: "destructive"
        });
        return prev;
      }
      
      // Remove marker from map
      const marker = markersRef.current[index];
      if (marker) marker.remove();
      markersRef.current.splice(index, 1);
      
      // Update remaining markers popup labels
      markersRef.current.forEach((m, i) => {
        const popup = m.getPopup();
        if (popup) {
          const content = popup.getContent();
          if (content instanceof HTMLElement) {
            const p = content.querySelector('p');
            if (p) p.textContent = `Titik ${i + 1}`;
          }
        }
      });
      
      const updated = prev.filter((_, i) => i !== index);
      updatePolygonLayer(updated);
      
      toast({ title: "Titik dihapus" });
      return updated;
    });
  };

  const loadPolygonForEditing = (coords: PolygonCoordinate[]) => {
    if (!leafletMapRef.current || !LRef.current) return;
    
    coords.forEach((coord, index) => {
      addMarkerWithPopup(coord.lat, coord.lng, index);
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
    if (leafletLoaded && isEditorOpen) {
      updatePolygonLayer(currentPolygon);
    }
  }, [currentPolygon, leafletLoaded, isEditorOpen]);

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

  const openNewEditor = () => {
    setEditingGeofence(null);
    setIsNewMode(true);
    setName('');
    setCurrentPolygon([]);
    setRadius(100);
    setIsEditorOpen(true);
    // Scroll to editor after a short delay
    setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const openEditEditor = (geofence: GeofenceArea) => {
    setEditingGeofence(geofence);
    setIsNewMode(false);
    setName(geofence.name);
    setRadius(geofence.radius || 100);
    setCurrentPolygon([]);
    setIsEditorOpen(true);
    // Scroll to editor after a short delay
    setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
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
        // Polygon mode - also save radius as backup for fallback
        const center = getPolygonCenter(currentPolygon);
        const coordinatesJson = currentPolygon.map(c => ({ lat: c.lat, lng: c.lng }));
        
        // Calculate estimated radius from polygon area for backup
        const area = calculatePolygonArea(currentPolygon);
        const estimatedRadius = Math.round(Math.sqrt(area / Math.PI));
        
        geofenceData = {
          name: name.trim(),
          coordinates: coordinatesJson as unknown as any,
          center_lat: center?.lat || null,
          center_lng: center?.lng || null,
          radius: estimatedRadius || radius || 100, // Keep radius as backup
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
      
      closeEditor();
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

  // Convert radius-based geofence to polygon mode with only center point
  const convertRadiusToPolygon = () => {
    if (!editingGeofence?.center_lat || !editingGeofence?.center_lng) {
      toast({
        title: "Gagal",
        description: "Titik tengah tidak ditemukan",
        variant: "destructive"
      });
      return;
    }

    const centerLat = editingGeofence.center_lat;
    const centerLng = editingGeofence.center_lng;

    // Only 1 point: center point
    const coords: PolygonCoordinate[] = [{ lat: centerLat, lng: centerLng }];

    // Clear existing circle layer
    if (circleLayerRef.current) {
      circleLayerRef.current.remove();
      circleLayerRef.current = null;
    }

    // Clear existing markers
    clearDrawingLayers();

    // Update state to polygon mode
    setEditingGeofence({
      ...editingGeofence,
      coordinates: coords,
      radius: radius // Keep radius as backup
    });
    setCurrentPolygon(coords);

    // Add marker for center point
    addMarkerWithPopup(centerLat, centerLng, 0);

    toast({
      title: "Mode Polygon Aktif",
      description: "Klik pada peta untuk menambah titik polygon. Minimal 3 titik untuk menyimpan."
    });
  };

  // Convert polygon-based geofence back to radius mode
  const convertPolygonToRadius = () => {
    if (currentPolygon.length === 0) {
      toast({
        title: "Gagal",
        description: "Tidak ada polygon untuk dikonversi",
        variant: "destructive"
      });
      return;
    }

    // Calculate center from polygon
    const center = getPolygonCenter(currentPolygon);
    if (!center) {
      toast({
        title: "Gagal",
        description: "Gagal menghitung titik tengah polygon",
        variant: "destructive"
      });
      return;
    }

    // Calculate estimated radius from polygon area
    const area = calculatePolygonArea(currentPolygon);
    const estimatedRadius = Math.max(50, Math.round(Math.sqrt(area / Math.PI)));

    // Clear polygon layers
    clearDrawingLayers();

    // Update state to radius mode
    setEditingGeofence({
      ...editingGeofence!,
      coordinates: null, // null = radius mode
      center_lat: center.lat,
      center_lng: center.lng,
      radius: estimatedRadius
    });
    setCurrentPolygon([]);
    setRadius(estimatedRadius);

    // Draw circle on map
    drawRadiusCircle(center.lat, center.lng, estimatedRadius);

    // Center map on new circle
    if (leafletMapRef.current) {
      leafletMapRef.current.setView([center.lat, center.lng], 16);
    }

    toast({
      title: "Mode Radius Aktif",
      description: `Diubah ke mode radius dengan jari-jari ~${estimatedRadius}m`
    });
  };

  return (
    <div className="space-y-6">
      {/* Main Geofence List Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Map className="h-5 w-5" />
            Semua Area Geofence
          </CardTitle>
          <Button onClick={openNewEditor} disabled={!leafletLoaded || isEditorOpen}>
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
                  className={`border rounded-lg p-4 transition-colors ${
                    editingGeofence?.id === geofence.id 
                      ? 'bg-primary/10 border-primary' 
                      : 'hover:bg-muted/50'
                  }`}
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
                        onClick={() => openEditEditor(geofence)}
                        disabled={!leafletLoaded || (isEditorOpen && editingGeofence?.id !== geofence.id)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteGeofence(geofence.id)}
                        disabled={isEditorOpen && editingGeofence?.id === geofence.id}
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

      {/* Inline Editor Panel (instead of Dialog for better Leaflet compatibility) */}
      {isEditorOpen && (
        <Card ref={editorRef} className="border-primary">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              {editingGeofence ? `Edit: ${editingGeofence.name}` : 'Buat Area Geofence Baru'}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={closeEditor}>
              <ChevronUp className="h-4 w-4 mr-1" />
              Tutup
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isRadiusMode 
                ? 'Klik pada peta untuk memindahkan titik tengah, atau ubah radius di bawah.'
                : 'Klik pada peta untuk menambahkan titik polygon. Drag marker untuk mengubah posisi.'}
            </p>
            
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
            
            {/* Radius Input - tampilkan jika radius mode ATAU polygon kosong dan ada center */}
            {(isRadiusMode || (currentPolygon.length === 0 && editingGeofence?.center_lat)) && (
              <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="geofence-radius">Radius</Label>
                    <span className="text-sm font-medium text-primary">{radius} meter</span>
                  </div>
                  <Slider
                    value={[radius]}
                    onValueChange={([value]) => {
                      setRadius(value);
                      radiusRef.current = value;
                      if (editingGeofence?.center_lat && editingGeofence?.center_lng) {
                        drawRadiusCircle(editingGeofence.center_lat, editingGeofence.center_lng, value);
                      }
                    }}
                    min={10}
                    max={1000}
                    step={10}
                    className="w-full"
                  />
                  <Input
                    id="geofence-radius"
                    type="number"
                    value={radius}
                    onChange={(e) => {
                      const newRadius = Math.max(10, Math.min(10000, Number(e.target.value)));
                      setRadius(newRadius);
                      radiusRef.current = newRadius;
                      if (editingGeofence?.center_lat && editingGeofence?.center_lng) {
                        drawRadiusCircle(editingGeofence.center_lat, editingGeofence.center_lng, newRadius);
                      }
                    }}
                    min={10}
                    max={10000}
                    className="text-center"
                  />
                </div>
                <Button 
                  variant="outline" 
                  onClick={convertRadiusToPolygon}
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Ubah ke Mode Polygon
                </Button>
                <p className="text-xs text-muted-foreground">
                  Klik peta untuk pindahkan titik tengah. Geser slider untuk ubah radius.
                </p>
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
                {currentPolygon.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={convertPolygonToRadius}
                    className="ml-auto"
                  >
                    <Circle className="h-4 w-4 mr-2" />
                    Ubah ke Mode Radius
                  </Button>
                )}
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
              <Button variant="outline" onClick={closeEditor}>
                <X className="h-4 w-4 mr-2" />
                Batal
              </Button>
              <Button 
                onClick={saveGeofence} 
                disabled={
                  !name.trim() || 
                  loading || 
                  // Polygon mode: butuh minimal 3 titik
                  (!isRadiusMode && currentPolygon.length >= 1 && currentPolygon.length < 3) ||
                  // Radius mode: butuh center point
                  (isRadiusMode && (!editingGeofence?.center_lat || !editingGeofence?.center_lng))
                }
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Menyimpan...' : (editingGeofence ? 'Simpan Perubahan' : 'Buat Area')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PolygonGeofenceManager;
