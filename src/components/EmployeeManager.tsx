import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Users, Plus, Edit, Trash2, UserCheck, UserX, Upload, Download, FileSpreadsheet, User, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface StaffUser {
  id: string;
  uid: string;
  name: string;
  position: string;
  work_area: string;
  division?: string;
  is_active: boolean;
  created_at: string;
  photo_url?: string;
}

const EmployeeManager = () => {
  const [employees, setEmployees] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<StaffUser | null>(null);
  const [positions, setPositions] = useState<string[]>([]);
  const [workAreas, setWorkAreas] = useState<string[]>([]);
  const [divisions, setDivisions] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    uid: '',
    name: '',
    position: '',
    work_area: '',
    division: '',
    photo_url: ''
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [workAreaFilter, setWorkAreaFilter] = useState<string>('all');

  useEffect(() => {
    fetchEmployees();
    fetchDropdownData();
  }, []);

  const logActivity = async (actionType: string, targetName: string, details?: any) => {
    try {
      const sessionData = localStorage.getItem('adminSession');
      if (!sessionData) return;
      
      const session = JSON.parse(sessionData);
      await supabase.from('admin_activity_logs').insert({
        admin_username: session.username,
        action_type: actionType,
        target_type: 'employee',
        target_name: targetName,
        details: details || {}
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  const fetchDropdownData = async () => {
    try {
      // Fetch positions
      const { data: positionData } = await supabase
        .from('staff_users')
        .select('position')
        .not('position', 'is', null)
        .neq('position', '');
      
      // Fetch work areas
      const { data: workAreaData } = await supabase
        .from('staff_users')
        .select('work_area')
        .not('work_area', 'is', null)
        .neq('work_area', '');
      
      // Fetch divisions
      const { data: divisionData } = await supabase
        .from('staff_users')
        .select('division')
        .not('division', 'is', null)
        .neq('division', '');

      // Extract unique values
      if (positionData) {
        const uniquePositions = [...new Set(positionData.map(item => item.position))].sort();
        setPositions(uniquePositions);
      }
      
      if (workAreaData) {
        const uniqueWorkAreas = [...new Set(workAreaData.map(item => item.work_area))].sort();
        setWorkAreas(uniqueWorkAreas);
      }
      
      if (divisionData) {
        const uniqueDivisions = [...new Set(divisionData.map(item => item.division))].sort();
        setDivisions(uniqueDivisions);
      }
    } catch (error) {
      console.error('Error fetching dropdown data:', error);
    }
  };

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Resize to max 800px on longest side while maintaining aspect ratio
          const maxSize = 800;
          if (width > height && width > maxSize) {
            height = (height / width) * maxSize;
            width = maxSize;
          } else if (height > maxSize) {
            width = (width / height) * maxSize;
            height = maxSize;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                reject(new Error('Failed to compress image'));
              }
            },
            'image/jpeg',
            0.8 // 80% quality
          );
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Please select an image file",
        variant: "destructive"
      });
      return;
    }

    try {
      // Compress the image
      const compressedFile = await compressImage(file);
      
      // Check if compressed file is still too large (> 512KB)
      if (compressedFile.size > 512 * 1024) {
        toast({
          title: "Warning",
          description: "Image is still large after compression. It may take longer to upload.",
        });
      }

      setPhotoFile(compressedFile);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error('Error compressing image:', error);
      toast({
        title: "Error",
        description: "Failed to process image",
        variant: "destructive"
      });
    }
  };

  const uploadPhoto = async (employeeUid: string): Promise<string | null> => {
    if (!photoFile) return null;

    try {
      setUploadingPhoto(true);
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${employeeUid}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Delete old photo if exists
      if (editingEmployee?.photo_url) {
        const oldFileName = editingEmployee.photo_url.split('/').pop();
        if (oldFileName) {
          await supabase.storage
            .from('staff-photos')
            .remove([oldFileName]);
        }
      }

      // Upload new photo
      const { error: uploadError } = await supabase.storage
        .from('staff-photos')
        .upload(filePath, photoFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('staff-photos')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        title: "Error",
        description: "Failed to upload photo",
        variant: "destructive"
      });
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('staff_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch employees",
        variant: "destructive"
      });
    } else {
      setEmployees(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      uid: '',
      name: '',
      position: '',
      work_area: '',
      division: '',
      photo_url: ''
    });
    setEditingEmployee(null);
    setPhotoFile(null);
    setPhotoPreview('');
  };

  const openDialog = (employee?: StaffUser) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        uid: employee.uid,
        name: employee.name,
        position: employee.position,
        work_area: employee.work_area,
        division: employee.division || '',
        photo_url: employee.photo_url || ''
      });
      setPhotoPreview(employee.photo_url || '');
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.uid || !formData.name || !formData.position || !formData.work_area) {
      toast({
        title: "Gagal",
        description: "Silakan lengkapi semua field yang wajib",
        variant: "destructive"
      });
      return;
    }

    try {
      // Upload photo if selected
      let photoUrl = editingEmployee?.photo_url || null;
      if (photoFile) {
        const uploadedUrl = await uploadPhoto(formData.uid);
        if (uploadedUrl) {
          photoUrl = uploadedUrl;
        }
      }

      const employeeData = {
        uid: formData.uid,
        name: formData.name,
        position: formData.position,
        work_area: formData.work_area,
        division: formData.division || null,
        photo_url: photoUrl
      };

      if (editingEmployee) {
        // Update existing employee
        const { error } = await supabase
          .from('staff_users')
          .update(employeeData)
          .eq('id', editingEmployee.id);

        if (error) throw error;
        
        await logActivity('update', formData.name, { uid: formData.uid, position: formData.position });
        
        toast({
          title: "Berhasil",
          description: "Karyawan berhasil diperbarui"
        });
      } else {
        // Check if UID already exists
        const { data: existingEmployee } = await supabase
          .from('staff_users')
          .select('uid')
          .eq('uid', formData.uid)
          .maybeSingle();

        if (existingEmployee) {
          toast({
            title: "Gagal",
            description: "UID karyawan sudah ada",
            variant: "destructive"
          });
          return;
        }

        // Create new employee
        const { error } = await supabase
          .from('staff_users')
          .insert([employeeData]);

        if (error) throw error;
        
        await logActivity('create', formData.name, { uid: formData.uid, position: formData.position });
        
        toast({
          title: "Berhasil",
          description: "Karyawan berhasil ditambahkan"
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchEmployees();
    } catch (error) {
      console.error('Error saving employee:', error);
      toast({
        title: "Gagal",
        description: "Gagal menyimpan data karyawan",
        variant: "destructive"
      });
    }
  };

  const toggleEmployeeStatus = async (employee: StaffUser) => {
    try {
      const { error } = await supabase
        .from('staff_users')
        .update({ is_active: !employee.is_active })
        .eq('id', employee.id);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: `Karyawan ${employee.is_active ? 'dinonaktifkan' : 'diaktifkan'} berhasil`
      });
      fetchEmployees();
    } catch (error) {
      toast({
        title: "Gagal",
        description: "Gagal memperbarui status karyawan",
        variant: "destructive"
      });
    }
  };

  const deleteEmployee = async (employee: StaffUser) => {
    try {
      const { error } = await supabase
        .from('staff_users')
        .delete()
        .eq('id', employee.id);

      if (error) throw error;

      await logActivity('delete', employee.name, { uid: employee.uid });

      toast({
        title: "Berhasil",
        description: "Karyawan berhasil dihapus"
      });
      fetchEmployees();
    } catch (error) {
      toast({
        title: "Gagal",
        description: "Gagal menghapus karyawan",
        variant: "destructive"
      });
    }
  };

  const exportTemplate = (format: 'xlsx' | 'csv') => {
    const templateData = [
      {
        'UID': 'EMP001',
        'Name': 'John Doe',
        'Position': 'Manager',
        'Work Area': 'Office A',
        'Division': 'IT'
      },
      {
        'UID': 'EMP002', 
        'Name': 'Jane Smith',
        'Position': 'Staff',
        'Work Area': 'Office B',
        'Division': 'HR'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employee Template');

    const fileName = `employee_template.${format}`;
    XLSX.writeFile(wb, fileName);
    
    toast({
      title: "Template Exported",
      description: `${format.toUpperCase()} template file has been downloaded`
    });
  };

  const handleBatchUpload = async () => {
    if (!batchFile) return;

    setBatchLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          let workbook;
          
          if (batchFile.name.endsWith('.csv')) {
            const csvData = data as string;
            workbook = XLSX.read(csvData, { type: 'string' });
          } else {
            workbook = XLSX.read(data, { type: 'array' });
          }
          
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          const employeesToAdd = [];
          const errors = [];
          const duplicateUIDs = [];

          // Check existing UIDs
          const { data: existingEmployees } = await supabase
            .from('staff_users')
            .select('uid');
          
          const existingUIDs = new Set(existingEmployees?.map(emp => emp.uid) || []);

          for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i] as any;
            const rowNum = i + 2; // +2 because of header row and 0-based index

            const uid = row['UID'] || row['uid'];
            const name = row['Name'] || row['name'];
            const position = row['Position'] || row['position'];
            const work_area = row['Work Area'] || row['work_area'] || row['WorkArea'];
            const division = row['Division'] || row['division'];

            if (!uid || !name || !position || !work_area) {
              errors.push(`Baris ${rowNum}: Field wajib tidak lengkap (UID, Name, Position, Work Area)`);
              continue;
            }

            if (existingUIDs.has(uid)) {
              duplicateUIDs.push(`${uid} (Baris ${rowNum})`);
              continue;
            }

            employeesToAdd.push({
              uid,
              name,
              position,
              work_area,
              division: division || null
            });
          }

          if (errors.length > 0 || duplicateUIDs.length > 0) {
            let errorMessage = '';
            if (errors.length > 0) {
              errorMessage += `Error validasi:\n${errors.join('\n')}`;
            }
            if (duplicateUIDs.length > 0) {
              errorMessage += `${errors.length > 0 ? '\n\n' : ''}UID sudah ada:\n${duplicateUIDs.join(', ')}`;
            }
            
            toast({
              title: "Import Gagal",
              description: errorMessage,
              variant: "destructive"
            });
            setBatchLoading(false);
            return;
          }

          if (employeesToAdd.length === 0) {
            toast({
              title: "Tidak Ada Data",
              description: "Tidak ada data valid untuk diimport",
              variant: "destructive"
            });
            setBatchLoading(false);
            return;
          }

          // Insert employees
          const { error } = await supabase
            .from('staff_users')
            .insert(employeesToAdd);

          if (error) throw error;

          toast({
            title: "Import Berhasil",
            description: `${employeesToAdd.length} karyawan berhasil ditambahkan`
          });

          setIsBatchDialogOpen(false);
          setBatchFile(null);
          fetchEmployees();
          fetchDropdownData();

        } catch (error) {
          console.error('Error processing file:', error);
          toast({
            title: "Error",
            description: "Gagal memproses file. Pastikan format file benar.",
            variant: "destructive"
          });
        }
        setBatchLoading(false);
      };

      if (batchFile.name.endsWith('.csv')) {
        reader.readAsText(batchFile);
      } else {
        reader.readAsArrayBuffer(batchFile);
      }
    } catch (error) {
      console.error('Error reading file:', error);
      toast({
        title: "Error",
        description: "Gagal membaca file",
        variant: "destructive"
      });
      setBatchLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Employee Management
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => exportTemplate('xlsx')}
            >
              <Download className="h-4 w-4 mr-2" />
              Template XLSX
            </Button>
            <Button
              variant="outline"
              onClick={() => exportTemplate('csv')}
            >
              <Download className="h-4 w-4 mr-2" />
              Template CSV
            </Button>
            <Dialog open={isBatchDialogOpen} onOpenChange={setIsBatchDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">
                  <Upload className="h-4 w-4 mr-2" />
                  Batch Add
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Batch Add Employees</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="batch-file">Upload File (XLSX/CSV)</Label>
                    <Input
                      id="batch-file"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => setBatchFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Format yang diperlukan:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• <strong>UID</strong>: Unique employee ID (required)</li>
                      <li>• <strong>Name</strong>: Full name (required)</li>
                      <li>• <strong>Position</strong>: Job position (required)</li>
                      <li>• <strong>Work Area</strong>: Work location (required)</li>
                      <li>• <strong>Division</strong>: Department (optional)</li>
                    </ul>
                  </div>
                  
                  <div className="flex gap-2 pt-4">
                    <Button 
                      onClick={handleBatchUpload}
                      disabled={!batchFile || batchLoading}
                      className="flex-1"
                    >
                      {batchLoading ? 'Processing...' : 'Upload & Add'}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsBatchDialogOpen(false);
                        setBatchFile(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => openDialog()} className="gradient-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Employee
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="uid">Employee UID *</Label>
                    <Input
                      id="uid"
                      value={formData.uid}
                      onChange={(e) => setFormData({...formData, uid: e.target.value})}
                      placeholder="e.g., EMP001"
                      disabled={!!editingEmployee}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Enter full name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="position">Position *</Label>
                    <Select
                      value={formData.position}
                      onValueChange={(value) => setFormData({...formData, position: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select position" />
                      </SelectTrigger>
                      <SelectContent>
                        {positions.map((position) => (
                          <SelectItem key={position} value={position}>
                            {position}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="work_area">Work Area *</Label>
                    <Select
                      value={formData.work_area}
                      onValueChange={(value) => setFormData({...formData, work_area: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select work area" />
                      </SelectTrigger>
                      <SelectContent>
                        {workAreas.map((workArea) => (
                          <SelectItem key={workArea} value={workArea}>
                            {workArea}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="division">Division (Optional)</Label>
                    <Select
                      value={formData.division}
                      onValueChange={(value) => setFormData({...formData, division: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select division" />
                      </SelectTrigger>
                      <SelectContent>
                        {divisions.map((division) => (
                          <SelectItem key={division} value={division}>
                            {division}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="photo">Photo (Optional)</Label>
                    <div className="flex items-center gap-4">
                      {photoPreview ? (
                        <div className="relative">
                          <img 
                            src={photoPreview} 
                            alt="Preview" 
                            className="w-16 h-16 rounded-full object-cover border-2 border-primary"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                            onClick={() => {
                              setPhotoFile(null);
                              setPhotoPreview(null);
                            }}
                          >
                            ×
                          </Button>
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-muted border-2 border-dashed border-muted-foreground flex items-center justify-center">
                          <User className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1">
                        <Input
                          id="photo"
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoSelect}
                          className="cursor-pointer"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Max 512KB (akan dikompres otomatis)
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-4">
                    <Button type="submit" className="flex-1 gradient-primary" disabled={uploadingPhoto}>
                      {uploadingPhoto ? 'Uploading...' : editingEmployee ? 'Update' : 'Add'} Employee
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsDialogOpen(false);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters Section */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search by Name */}
            <div className="flex-1">
              <Label htmlFor="search-name" className="text-sm mb-2 block">
                Cari Nama Employee
              </Label>
              <Input
                id="search-name"
                type="text"
                placeholder="Ketik nama employee..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {/* Work Area Filter */}
            <div className="w-full sm:w-64">
              <Label htmlFor="filter-work-area" className="text-sm mb-2 block">
                Filter Work Area
              </Label>
              <Select value={workAreaFilter} onValueChange={setWorkAreaFilter}>
                <SelectTrigger id="filter-work-area">
                  <SelectValue placeholder="Pilih work area" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Work Area</SelectItem>
                  {workAreas.map((workArea) => (
                    <SelectItem key={workArea} value={workArea}>
                      {workArea}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Total Count */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              Total Employee: <strong className="text-foreground">
                {employees.filter(emp => {
                  const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase());
                  const matchesWorkArea = workAreaFilter === 'all' || emp.work_area === workAreaFilter;
                  return matchesSearch && matchesWorkArea;
                }).length}
              </strong> dari {employees.length}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading employees...</div>
        ) : employees.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No employees found. Add your first employee to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {employees
              .filter(emp => {
                const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesWorkArea = workAreaFilter === 'all' || emp.work_area === workAreaFilter;
                return matchesSearch && matchesWorkArea;
              })
              .map((employee) => (
              <div
                key={employee.id}
                className="rounded-lg p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors"
              >
                {/* Employee Photo */}
                <div className="flex-shrink-0">
                  {employee.photo_url ? (
                    <img 
                      src={employee.photo_url} 
                      alt={employee.name}
                      className="object-cover"
                      style={{ width: '400px', height: '120px' }}
                    />
                  ) : (
                    <div className="bg-muted flex items-center justify-center" style={{ width: '400px', height: '120px' }}>
                      <User className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-foreground">{employee.name}</h3>
                    <Badge variant={employee.is_active ? "default" : "secondary"}>
                      {employee.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div>
                      <span className="font-medium">UID:</span> {employee.uid}
                    </div>
                    <div>
                      <span className="font-medium">Position:</span> {employee.position}
                    </div>
                    <div>
                      <span className="font-medium">Work Area:</span> {employee.work_area}
                    </div>
                    {employee.division && (
                      <div>
                        <span className="font-medium">Division:</span> {employee.division}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleEmployeeStatus(employee)}
                  >
                    {employee.is_active ? (
                      <UserX className="h-4 w-4" />
                    ) : (
                      <UserCheck className="h-4 w-4" />
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDialog(employee)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Employee</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete {employee.name}? This action cannot be undone and will also delete all their attendance records.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteEmployee(employee)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
            
            {/* No results message */}
            {employees.filter(emp => {
              const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase());
              const matchesWorkArea = workAreaFilter === 'all' || emp.work_area === workAreaFilter;
              return matchesSearch && matchesWorkArea;
            }).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Tidak ada employee yang sesuai dengan filter.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EmployeeManager;