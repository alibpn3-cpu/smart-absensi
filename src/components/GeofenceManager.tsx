import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus, Trash2, Edit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Geofence {
  id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  radius: number;
  is_active: boolean;
}

const GeofenceManager = () => {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    center_lat: '',
    center_lng: '',
    radius: ''
  });

  useEffect(() => {
    fetchGeofences();
  }, []);

  const fetchGeofences = async () => {
    try {
      const { data, error } = await supabase
        .from('geofence_areas')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGeofences(data || []);
    } catch (error) {
      console.error('Error fetching geofences:', error);
      toast({
        title: "Error",
        description: "Failed to load geofence areas",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.center_lat || !formData.center_lng || !formData.radius) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    try {
      const geofenceData = {
        name: formData.name,
        center_lat: parseFloat(formData.center_lat),
        center_lng: parseFloat(formData.center_lng),
        radius: parseInt(formData.radius),
        is_active: true
      };

      if (editingId) {
        // Update existing geofence
        const { error } = await supabase
          .from('geofence_areas')
          .update(geofenceData)
          .eq('id', editingId);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Geofence area updated successfully"
        });
      } else {
        // Create new geofence
        const { error } = await supabase
          .from('geofence_areas')
          .insert([geofenceData]);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "New geofence area created successfully"
        });
      }

      // Reset form
      setFormData({ name: '', center_lat: '', center_lng: '', radius: '' });
      setIsEditing(false);
      setEditingId(null);
      fetchGeofences();
    } catch (error) {
      console.error('Error saving geofence:', error);
      toast({
        title: "Error",
        description: "Failed to save geofence area",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (geofence: Geofence) => {
    setFormData({
      name: geofence.name,
      center_lat: geofence.center_lat.toString(),
      center_lng: geofence.center_lng.toString(),
      radius: geofence.radius.toString()
    });
    setEditingId(geofence.id);
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this geofence area?')) return;

    try {
      const { error } = await supabase
        .from('geofence_areas')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Geofence area deleted successfully"
      });
      
      fetchGeofences();
    } catch (error) {
      console.error('Error deleting geofence:', error);
      toast({
        title: "Error",
        description: "Failed to delete geofence area",
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
        title: "Success",
        description: `Geofence area ${!currentStatus ? 'activated' : 'deactivated'}`
      });
      
      fetchGeofences();
    } catch (error) {
      console.error('Error updating geofence status:', error);
      toast({
        title: "Error",
        description: "Failed to update geofence status",
        variant: "destructive"
      });
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Error",
        description: "Geolocation is not supported by this browser",
        variant: "destructive"
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          center_lat: position.coords.latitude.toString(),
          center_lng: position.coords.longitude.toString()
        }));
        toast({
          title: "Success",
          description: "Current location obtained successfully"
        });
      },
      (error) => {
        toast({
          title: "Error",
          description: "Failed to get current location",
          variant: "destructive"
        });
      }
    );
  };

  const cancelEdit = () => {
    setFormData({ name: '', center_lat: '', center_lng: '', radius: '' });
    setIsEditing(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Add/Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {isEditing ? 'Edit Geofence Area' : 'Add New Geofence Area'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Area Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Head Office"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="radius">Radius (meters)</Label>
                <Input
                  id="radius"
                  type="number"
                  placeholder="e.g., 100"
                  value={formData.radius}
                  onChange={(e) => setFormData(prev => ({ ...prev, radius: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lat">Latitude</Label>
                <Input
                  id="lat"
                  type="number"
                  step="any"
                  placeholder="e.g., -6.2088"
                  value={formData.center_lat}
                  onChange={(e) => setFormData(prev => ({ ...prev, center_lat: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lng">Longitude</Label>
                <Input
                  id="lng"
                  type="number"
                  step="any"
                  placeholder="e.g., 106.8456"
                  value={formData.center_lng}
                  onChange={(e) => setFormData(prev => ({ ...prev, center_lng: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={getCurrentLocation}>
                <MapPin className="h-4 w-4 mr-2" />
                Use Current Location
              </Button>
              {isEditing && (
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
              )}
              <Button type="submit">
                {isEditing ? 'Update Area' : 'Add Area'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Existing Geofences */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Geofence Areas</CardTitle>
        </CardHeader>
        <CardContent>
          {geofences.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No geofence areas configured yet
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
                      <p className="text-sm text-muted-foreground">
                        Center: {geofence.center_lat}, {geofence.center_lng}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Radius: {geofence.radius}m
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={geofence.is_active ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={() => toggleActive(geofence.id, geofence.is_active)}
                      >
                        {geofence.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(geofence)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(geofence.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(
                        `https://www.google.com/maps?q=${geofence.center_lat},${geofence.center_lng}`,
                        '_blank'
                      )}
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      View on Map
                    </Button>
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

export default GeofenceManager;
