import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Cake, Upload, Trash2, Plus, Edit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface BirthdayData {
  id?: string;
  nama: string;
  tanggal: string;
  lokasi: string;
  level: string;
}

const BirthdayImporter = () => {
  const [loading, setLoading] = useState(false);
  const [birthdays, setBirthdays] = useState<BirthdayData[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBirthday, setEditingBirthday] = useState<BirthdayData | null>(null);
  const [formData, setFormData] = useState({
    nama: '',
    tanggal: '',
    lokasi: '',
    level: ''
  });

  const fetchBirthdays = async () => {
    const { data, error } = await supabase
      .from('birthdays')
      .select('*')
      .order('tanggal', { ascending: true });

    if (error) {
      toast({
        title: "Gagal",
        description: "Gagal memuat data ulang tahun",
        variant: "destructive"
      });
    } else {
      setBirthdays(data || []);
    }
  };

  React.useEffect(() => {
    fetchBirthdays();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

      const formatDDMM = (input: any) => {
        if (input == null) return '';
        let str = String(input).trim();
        // Replace common separators with /
        str = str.replace(/[.\-]/g, '/');
        const parts = str.split('/').filter(Boolean);
        const day = (parts[0] || '').padStart(2, '0').slice(-2);
        const month = (parts[1] || '').padStart(2, '0').slice(-2);
        if (!day || !month) return '';
        return `${day}/${month}`;
      };

      // Validate and format data (case-insensitive headers)
      const formattedData: BirthdayData[] = jsonData.map((row) => {
        const getVal = (key: string) => {
          const found = Object.keys(row).find(k => k.toLowerCase().trim() === key);
          return row[found as keyof typeof row] ?? '';
        };
        return {
          nama: String(getVal('nama')).trim(),
          tanggal: formatDDMM(getVal('tanggal')),
          lokasi: String(getVal('lokasi')).trim(),
          level: String(getVal('level')).trim(),
        } as BirthdayData;
      }).filter(r => r.nama && r.tanggal);


      // Insert data to Supabase
      const { error } = await supabase
        .from('birthdays')
        .insert(formattedData);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: `${formattedData.length} data ulang tahun berhasil diimport`
      });

      fetchBirthdays();
    } catch (error) {
      console.error('Error importing birthdays:', error);
      toast({
        title: "Gagal",
        description: "Gagal mengimport data ulang tahun",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const resetForm = () => {
    setFormData({
      nama: '',
      tanggal: '',
      lokasi: '',
      level: ''
    });
    setEditingBirthday(null);
  };

  const openDialog = (birthday?: any) => {
    if (birthday) {
      setEditingBirthday(birthday);
      setFormData({
        nama: birthday.nama,
        tanggal: birthday.tanggal,
        lokasi: birthday.lokasi,
        level: birthday.level
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nama || !formData.tanggal || !formData.lokasi || !formData.level) {
      toast({
        title: "Gagal",
        description: "Semua field wajib diisi",
        variant: "destructive"
      });
      return;
    }

    // Validate date format DD/MM
    const datePattern = /^\d{2}\/\d{2}$/;
    if (!datePattern.test(formData.tanggal)) {
      toast({
        title: "Gagal",
        description: "Format tanggal harus DD/MM (contoh: 15/08)",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      if (editingBirthday) {
        const { error } = await supabase
          .from('birthdays')
          .update(formData)
          .eq('id', editingBirthday.id);

        if (error) throw error;
        
        toast({
          title: "Berhasil",
          description: "Data ulang tahun berhasil diperbarui"
        });
      } else {
        const { error } = await supabase
          .from('birthdays')
          .insert([formData]);

        if (error) throw error;
        
        toast({
          title: "Berhasil",
          description: "Data ulang tahun berhasil ditambahkan"
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchBirthdays();
    } catch (error) {
      console.error('Error saving birthday:', error);
      toast({
        title: "Gagal",
        description: "Gagal menyimpan data ulang tahun",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteBirthday = async (birthday: any) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('birthdays')
        .delete()
        .eq('id', birthday.id);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Data ulang tahun berhasil dihapus"
      });
      
      fetchBirthdays();
    } catch (error) {
      toast({
        title: "Gagal",
        description: "Gagal menghapus data ulang tahun",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const clearAllBirthdays = async () => {
    if (!confirm('Apakah Anda yakin ingin menghapus semua data ulang tahun?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('birthdays')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Semua data ulang tahun berhasil dihapus"
      });

      fetchBirthdays();
    } catch (error) {
      toast({
        title: "Gagal",
        description: "Gagal menghapus data ulang tahun",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Cake className="h-5 w-5" />
            Data Ulang Tahun
          </CardTitle>
          <div className="flex gap-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => openDialog()} className="gradient-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingBirthday ? 'Edit Data Ulang Tahun' : 'Tambah Data Ulang Tahun'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nama">Nama *</Label>
                    <Input
                      id="nama"
                      value={formData.nama}
                      onChange={(e) => setFormData({...formData, nama: e.target.value})}
                      placeholder="Nama lengkap"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="tanggal">Tanggal (DD/MM) *</Label>
                    <Input
                      id="tanggal"
                      value={formData.tanggal}
                      onChange={(e) => setFormData({...formData, tanggal: e.target.value})}
                      placeholder="15/08"
                      maxLength={5}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="lokasi">Lokasi *</Label>
                    <Input
                      id="lokasi"
                      value={formData.lokasi}
                      onChange={(e) => setFormData({...formData, lokasi: e.target.value})}
                      placeholder="Lokasi kerja"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="level">Level/Jabatan *</Label>
                    <Input
                      id="level"
                      value={formData.level}
                      onChange={(e) => setFormData({...formData, level: e.target.value})}
                      placeholder="Level atau jabatan"
                    />
                  </div>
                  
                  <div className="flex gap-2 pt-4">
                    <Button type="submit" className="flex-1 gradient-primary" disabled={loading}>
                      {editingBirthday ? 'Update' : 'Tambah'}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsDialogOpen(false);
                        resetForm();
                      }}
                    >
                      Batal
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            
            <Button
              variant="outline"
              onClick={() => document.getElementById('birthday-file-input')?.click()}
              disabled={loading}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            
            <Button
              variant="outline"
              onClick={clearAllBirthdays}
              disabled={loading || birthdays.length === 0}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <input
          id="birthday-file-input"
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          className="hidden"
        />
      </CardHeader>
      <CardContent>
        <div className="mb-4 p-4 bg-muted rounded-lg">
          <p className="text-sm font-semibold mb-2">Format Excel yang diperlukan:</p>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• Kolom 1: <strong>nama</strong> - Nama lengkap</li>
            <li>• Kolom 2: <strong>tanggal</strong> - Format DD/MM (contoh: 15/08)</li>
            <li>• Kolom 3: <strong>lokasi</strong> - Lokasi kerja</li>
            <li>• Kolom 4: <strong>level</strong> - Level/jabatan</li>
          </ul>
        </div>

        {birthdays.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Belum ada data ulang tahun. Silakan import file XLSX.
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-semibold mb-2">Total: {birthdays.length} data</p>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {birthdays.map((birthday: any) => (
                <div
                  key={birthday.id}
                  className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <h4 className="font-semibold">{birthday.nama}</h4>
                      <p className="text-sm text-muted-foreground">
                        📅 {birthday.tanggal} | 📍 {birthday.lokasi} | {birthday.level}
                      </p>
                    </div>
                    
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDialog(birthday)}
                        disabled={loading}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            disabled={loading}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Data Ulang Tahun</AlertDialogTitle>
                            <AlertDialogDescription>
                              Apakah Anda yakin ingin menghapus data ulang tahun "{birthday.nama}"? Tindakan ini tidak dapat dibatalkan.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteBirthday(birthday)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Hapus
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BirthdayImporter;
