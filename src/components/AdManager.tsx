import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Image, Save, Trash2, Plus } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface AdImage {
  id: string;
  image_url: string;
  display_order: number;
  is_active: boolean;
}

const AdManager = () => {
  const [ads, setAds] = useState<AdImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAds();
  }, []);

  const fetchAds = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ad_images')
        .select('*')
        .order('display_order');

      if (error) throw error;

      setAds(data || []);
    } catch (error) {
      console.error('Error fetching ads:', error);
      toast({
        title: "Gagal",
        description: "Gagal memuat data iklan",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddSlot = () => {
    if (ads.length >= 5) {
      toast({
        title: "Maksimal Tercapai",
        description: "Maksimal 5 slot iklan",
        variant: "destructive"
      });
      return;
    }

    const newAd: AdImage = {
      id: `new-${Date.now()}`,
      image_url: '',
      display_order: ads.length + 1,
      is_active: true
    };

    setAds([...ads, newAd]);
  };

  const handleUpdateAd = (index: number, field: keyof AdImage, value: string | boolean) => {
    const updatedAds = [...ads];
    updatedAds[index] = { ...updatedAds[index], [field]: value };
    setAds(updatedAds);
  };

  const handleDeleteAd = async (index: number) => {
    const ad = ads[index];
    
    // If it's a new ad (not saved yet), just remove from state
    if (ad.id.startsWith('new-')) {
      const updatedAds = ads.filter((_, i) => i !== index);
      // Reorder remaining ads
      updatedAds.forEach((ad, i) => {
        ad.display_order = i + 1;
      });
      setAds(updatedAds);
      return;
    }

    // Delete from database
    try {
      const { error } = await supabase
        .from('ad_images')
        .delete()
        .eq('id', ad.id);

      if (error) throw error;

      await fetchAds();
      toast({
        title: "Berhasil",
        description: "Iklan berhasil dihapus"
      });
    } catch (error) {
      console.error('Error deleting ad:', error);
      toast({
        title: "Gagal",
        description: "Gagal menghapus iklan",
        variant: "destructive"
      });
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // Validate: no empty URLs for active ads
      const invalidAds = ads.filter(ad => ad.is_active && !ad.image_url.trim());
      if (invalidAds.length > 0) {
        toast({
          title: "Validasi Gagal",
          description: "URL gambar tidak boleh kosong untuk iklan aktif",
          variant: "destructive"
        });
        setSaving(false);
        return;
      }

      // Separate new and existing ads
      const existingAds = ads.filter(ad => !ad.id.startsWith('new-'));
      const newAds = ads.filter(ad => ad.id.startsWith('new-'));

      // Update existing ads
      for (const ad of existingAds) {
        const { error } = await supabase
          .from('ad_images')
          .update({
            image_url: ad.image_url,
            display_order: ad.display_order,
            is_active: ad.is_active
          })
          .eq('id', ad.id);

        if (error) throw error;
      }

      // Insert new ads
      for (const ad of newAds) {
        const { error } = await supabase
          .from('ad_images')
          .insert({
            image_url: ad.image_url,
            display_order: ad.display_order,
            is_active: ad.is_active
          });

        if (error) throw error;
      }

      await fetchAds();
      toast({
        title: "Berhasil",
        description: "Pengaturan iklan berhasil disimpan"
      });
    } catch (error) {
      console.error('Error saving ads:', error);
      toast({
        title: "Gagal",
        description: "Gagal menyimpan pengaturan iklan",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-white border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-black">
          <Image className="h-5 w-5" />
          Manajemen Iklan Pop-up
        </CardTitle>
        <p className="text-sm text-gray-600">
          Kelola hingga 5 gambar iklan yang akan ditampilkan sebagai pop-up. Pop-up muncul 1 detik setelah halaman dimuat dan muncul kembali setiap 2 menit dengan iklan acak.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="text-center py-8 text-black">Loading...</div>
        ) : (
          <>
            <div className="space-y-4">
              {ads.map((ad, index) => (
                <div key={ad.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-black font-semibold">
                      Iklan #{index + 1}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`active-${index}`} className="text-sm text-gray-600">
                        Aktif
                      </Label>
                      <Switch
                        id={`active-${index}`}
                        checked={ad.is_active}
                        onCheckedChange={(checked) => handleUpdateAd(index, 'is_active', checked)}
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteAd(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`url-${index}`} className="text-black">
                      URL Gambar
                    </Label>
                    <Input
                      id={`url-${index}`}
                      type="url"
                      value={ad.image_url}
                      onChange={(e) => handleUpdateAd(index, 'image_url', e.target.value)}
                      placeholder="https://example.com/ad-image.jpg"
                      className="bg-white border-gray-300 text-black"
                    />
                  </div>

                  {/* Image Preview */}
                  {ad.image_url && (
                    <div className="mt-2">
                      <Label className="text-black text-sm">Preview</Label>
                      <div className="mt-1 border border-gray-200 rounded-lg p-2 bg-gray-50">
                        <img
                          src={ad.image_url}
                          alt={`Preview Ad ${index + 1}`}
                          className="max-h-32 mx-auto object-contain"
                          onError={(e) => {
                            e.currentTarget.src = '';
                            e.currentTarget.alt = 'Invalid URL';
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add New Slot Button */}
            {ads.length < 5 && (
              <Button
                variant="outline"
                onClick={handleAddSlot}
                className="w-full border-dashed border-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                Tambah Slot Iklan ({ads.length}/5)
              </Button>
            )}

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSaveAll}
                disabled={saving || ads.length === 0}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Menyimpan...' : 'Simpan Semua'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AdManager;
