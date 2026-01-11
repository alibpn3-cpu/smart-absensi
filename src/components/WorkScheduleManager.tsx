import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Clock, Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface WorkSchedule {
  id: string;
  work_area: string;
  employee_type: string;
  clock_in_time: string;
  clock_out_time: string;
  created_at: string;
  updated_at: string;
}

const WorkScheduleManager = () => {
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);
  
  // Form state
  const [formWorkArea, setFormWorkArea] = useState('');
  const [formEmployeeType, setFormEmployeeType] = useState('staff');
  const [formClockIn, setFormClockIn] = useState('08:00');
  const [formClockOut, setFormClockOut] = useState('17:00');

  // Unique work areas from geofence_areas for suggestions
  const [workAreaSuggestions, setWorkAreaSuggestions] = useState<string[]>([]);

  useEffect(() => {
    fetchSchedules();
    fetchWorkAreas();
  }, []);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('work_area_schedules')
        .select('*')
        .order('work_area', { ascending: true });

      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      toast({
        title: 'Gagal',
        description: 'Gagal memuat jadwal kerja',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkAreas = async () => {
    try {
      const { data } = await supabase
        .from('geofence_areas')
        .select('name')
        .eq('is_active', true);

      if (data) {
        setWorkAreaSuggestions(data.map(g => g.name.toUpperCase()));
      }
    } catch (error) {
      console.error('Error fetching work areas:', error);
    }
  };

  const resetForm = () => {
    setFormWorkArea('');
    setFormEmployeeType('staff');
    setFormClockIn('08:00');
    setFormClockOut('17:00');
    setEditingSchedule(null);
  };

  const openEditDialog = (schedule: WorkSchedule) => {
    setEditingSchedule(schedule);
    setFormWorkArea(schedule.work_area);
    setFormEmployeeType(schedule.employee_type);
    setFormClockIn(schedule.clock_in_time);
    setFormClockOut(schedule.clock_out_time);
    setIsDialogOpen(true);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formWorkArea.trim()) {
      toast({
        title: 'Gagal',
        description: 'Nama area kerja harus diisi',
        variant: 'destructive'
      });
      return;
    }

    try {
      if (editingSchedule) {
        // Update existing
        const { error } = await supabase
          .from('work_area_schedules')
          .update({
            work_area: formWorkArea.toUpperCase(),
            employee_type: formEmployeeType,
            clock_in_time: formClockIn,
            clock_out_time: formClockOut
          })
          .eq('id', editingSchedule.id);

        if (error) throw error;
        
        toast({
          title: 'Berhasil',
          description: 'Jadwal kerja berhasil diperbarui'
        });
      } else {
        // Insert new
        const { error } = await supabase
          .from('work_area_schedules')
          .insert({
            work_area: formWorkArea.toUpperCase(),
            employee_type: formEmployeeType,
            clock_in_time: formClockIn,
            clock_out_time: formClockOut
          });

        if (error) {
          if (error.code === '23505') {
            toast({
              title: 'Gagal',
              description: 'Kombinasi area kerja dan tipe karyawan sudah ada',
              variant: 'destructive'
            });
            return;
          }
          throw error;
        }
        
        toast({
          title: 'Berhasil',
          description: 'Jadwal kerja baru berhasil ditambahkan'
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchSchedules();
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast({
        title: 'Gagal',
        description: 'Gagal menyimpan jadwal kerja',
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (schedule: WorkSchedule) => {
    if (schedule.work_area === 'DEFAULT') {
      toast({
        title: 'Tidak Diizinkan',
        description: 'Jadwal DEFAULT tidak dapat dihapus',
        variant: 'destructive'
      });
      return;
    }

    if (!confirm(`Hapus jadwal untuk ${schedule.work_area} (${schedule.employee_type})?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('work_area_schedules')
        .delete()
        .eq('id', schedule.id);

      if (error) throw error;

      toast({
        title: 'Berhasil',
        description: 'Jadwal kerja berhasil dihapus'
      });
      
      fetchSchedules();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast({
        title: 'Gagal',
        description: 'Gagal menghapus jadwal kerja',
        variant: 'destructive'
      });
    }
  };

  // Group schedules by work_area
  const groupedSchedules = schedules.reduce((acc, schedule) => {
    if (!acc[schedule.work_area]) {
      acc[schedule.work_area] = [];
    }
    acc[schedule.work_area].push(schedule);
    return acc;
  }, {} as Record<string, WorkSchedule[]>);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2 text-title-primary">
            <Clock className="h-5 w-5" />
            Pengaturan Jam Kerja per Lokasi
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSchedules}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={openAddDialog}>
                  <Plus className="h-4 w-4 mr-1" />
                  Tambah Jadwal
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingSchedule ? 'Edit Jadwal Kerja' : 'Tambah Jadwal Kerja'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="workArea">Area Kerja</Label>
                    <Input
                      id="workArea"
                      value={formWorkArea}
                      onChange={(e) => setFormWorkArea(e.target.value)}
                      placeholder="Contoh: SITE HANDIL, HEAD OFFICE"
                      list="workAreaList"
                    />
                    <datalist id="workAreaList">
                      {workAreaSuggestions.map(area => (
                        <option key={area} value={area} />
                      ))}
                    </datalist>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="employeeType">Tipe Karyawan</Label>
                    <Select value={formEmployeeType} onValueChange={setFormEmployeeType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="primary">Primary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="clockIn">Jam Masuk</Label>
                      <Input
                        id="clockIn"
                        type="time"
                        value={formClockIn}
                        onChange={(e) => setFormClockIn(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clockOut">Jam Pulang</Label>
                      <Input
                        id="clockOut"
                        type="time"
                        value={formClockOut}
                        onChange={(e) => setFormClockOut(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Batal
                  </Button>
                  <Button onClick={handleSave}>
                    {editingSchedule ? 'Simpan Perubahan' : 'Tambah'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground mb-4">
          Atur jam kerja untuk setiap lokasi dan tipe karyawan. Jadwal ini digunakan untuk menghitung keterlambatan dan pulang cepat pada score harian.
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Belum ada jadwal kerja. Klik "Tambah Jadwal" untuk menambahkan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Area Kerja</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Jam Masuk</TableHead>
                  <TableHead>Jam Pulang</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(groupedSchedules).map(([workArea, areaSchedules]) => (
                  areaSchedules.map((schedule, idx) => (
                    <TableRow key={schedule.id}>
                      {idx === 0 && (
                        <TableCell 
                          rowSpan={areaSchedules.length}
                          className="font-medium align-top"
                        >
                          {workArea}
                          {workArea === 'DEFAULT' && (
                            <span className="block text-xs text-muted-foreground">
                              (fallback)
                            </span>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          schedule.employee_type === 'primary' 
                            ? 'bg-amber-500/20 text-amber-600' 
                            : 'bg-blue-500/20 text-blue-600'
                        }`}>
                          {schedule.employee_type}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono">{schedule.clock_in_time}</TableCell>
                      <TableCell className="font-mono">{schedule.clock_out_time}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(schedule)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(schedule)}
                            disabled={schedule.work_area === 'DEFAULT'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm">
          <strong>Catatan:</strong>
          <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
            <li>Jika area kerja tidak ditemukan, sistem akan menggunakan jadwal DEFAULT</li>
            <li>Jadwal DEFAULT tidak dapat dihapus</li>
            <li>Perubahan jadwal akan berlaku untuk perhitungan score baru</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkScheduleManager;
