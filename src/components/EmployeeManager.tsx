import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Users, Plus, Edit, Trash2, UserCheck, UserX, Upload, Download, FileSpreadsheet, User, Camera, CheckSquare, Square, ChevronsUpDown, Check, KeyRound, Shield, ShieldOff, QrCode, Crown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

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
  is_admin?: boolean;
  is_manager?: boolean;
  employee_type?: string;
}

// Combobox component for editable dropdowns with auto-uppercase
const ComboboxField = ({ 
  value, 
  onValueChange, 
  options, 
  placeholder, 
  emptyText = "No option found." 
}: { 
  value: string; 
  onValueChange: (value: string) => void; 
  options: string[]; 
  placeholder: string;
  emptyText?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const upperValue = e.target.value.toUpperCase();
    setInputValue(upperValue);
    onValueChange(upperValue);
  };

  const handleSelect = (selectedValue: string) => {
    const upperValue = selectedValue.toUpperCase();
    setInputValue(upperValue);
    onValueChange(upperValue);
    setOpen(false);
  };

  return (
    <div className="flex gap-2">
      <Input
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        className="flex-1"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-10 p-0 shrink-0"
          >
            <ChevronsUpDown className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          <Command>
            <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.filter(Boolean).map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => handleSelect(option)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

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
    photo_url: '',
    employee_type: 'staff'
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [workAreaFilter, setWorkAreaFilter] = useState<string>('all');
  const [isMismatchDialogOpen, setIsMismatchDialogOpen] = useState(false);
  const [mismatchData, setMismatchData] = useState<Array<{
    userName: string;
    mismatches: string[];
  }>>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [isBatchUpdateDialogOpen, setIsBatchUpdateDialogOpen] = useState(false);
  const [batchUpdateData, setBatchUpdateData] = useState({
    position: '',
    work_area: '',
    division: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchEmployees();
    fetchDropdownData();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, workAreaFilter]);

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
      photo_url: '',
      employee_type: 'staff'
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
        photo_url: employee.photo_url || '',
        employee_type: employee.employee_type || 'staff'
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
        photo_url: photoUrl,
        employee_type: formData.employee_type || 'staff'
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

  const resetPassword = async (employee: StaffUser) => {
    try {
      // Fetch default password from database
      const { data: settingData } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'default_user_password')
        .maybeSingle();
      
      const defaultPassword = settingData?.setting_value || 'PTG2025';

      const { error } = await supabase
        .from('staff_users')
        .update({ 
          password_hash: defaultPassword,
          is_first_login: true
        })
        .eq('id', employee.id);

      if (error) throw error;

      await logActivity('reset_password', employee.name, { uid: employee.uid });

      toast({
        title: "Berhasil",
        description: `Password ${employee.name} berhasil direset ke default`
      });
    } catch (error) {
      toast({
        title: "Gagal",
        description: "Gagal mereset password",
        variant: "destructive"
      });
    }
  };

  const toggleAdminStatus = async (employee: StaffUser) => {
    try {
      const newAdminStatus = !employee.is_admin;
      const { error } = await supabase
        .from('staff_users')
        .update({ is_admin: newAdminStatus })
        .eq('id', employee.id);

      if (error) throw error;

      await logActivity(newAdminStatus ? 'grant_admin' : 'revoke_admin', employee.name, { uid: employee.uid });

      toast({
        title: "Berhasil",
        description: `${employee.name} ${newAdminStatus ? 'dijadikan admin' : 'dicabut status adminnya'}`
      });
      fetchEmployees();
    } catch (error) {
      toast({
        title: "Gagal",
        description: "Gagal mengubah status admin",
        variant: "destructive"
      });
    }
  };

  const toggleManagerStatus = async (employee: StaffUser) => {
    try {
      const newManagerStatus = !employee.is_manager;
      const { error } = await supabase
        .from('staff_users')
        .update({ is_manager: newManagerStatus })
        .eq('id', employee.id);

      if (error) throw error;

      await logActivity(newManagerStatus ? 'grant_manager' : 'revoke_manager', employee.name, { uid: employee.uid });

      toast({
        title: "Berhasil",
        description: `${employee.name} ${newManagerStatus ? 'dijadikan manajer' : 'dicabut status manajernya'}`
      });
      fetchEmployees();
    } catch (error) {
      toast({
        title: "Gagal",
        description: "Gagal mengubah status manajer",
        variant: "destructive"
      });
    }
  };

  const toggleSelectEmployee = (employeeId: string) => {
    const newSelected = new Set(selectedEmployees);
    if (newSelected.has(employeeId)) {
      newSelected.delete(employeeId);
    } else {
      newSelected.add(employeeId);
    }
    setSelectedEmployees(newSelected);
  };

  const toggleSelectAll = () => {
    const filteredEmployees = employees.filter(emp => {
      const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesWorkArea = workAreaFilter === 'all' || emp.work_area === workAreaFilter;
      return matchesSearch && matchesWorkArea;
    });

    if (selectedEmployees.size === filteredEmployees.length) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(filteredEmployees.map(emp => emp.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedEmployees.size === 0) return;

    try {
      const { error } = await supabase
        .from('staff_users')
        .delete()
        .in('id', Array.from(selectedEmployees));

      if (error) throw error;

      const deletedNames = employees
        .filter(emp => selectedEmployees.has(emp.id))
        .map(emp => emp.name)
        .join(', ');

      await logActivity('batch_delete', deletedNames, { count: selectedEmployees.size });

      toast({
        title: "Berhasil",
        description: `${selectedEmployees.size} karyawan berhasil dihapus`
      });

      setSelectedEmployees(new Set());
      fetchEmployees();
    } catch (error) {
      toast({
        title: "Gagal",
        description: "Gagal menghapus karyawan",
        variant: "destructive"
      });
    }
  };

  const handleBatchUpdate = async () => {
    if (selectedEmployees.size === 0) return;

    if (!batchUpdateData.position && !batchUpdateData.work_area && !batchUpdateData.division) {
      toast({
        title: "Gagal",
        description: "Pilih minimal satu field untuk diupdate",
        variant: "destructive"
      });
      return;
    }

    try {
      const updatePayload: any = {};
      if (batchUpdateData.position) updatePayload.position = batchUpdateData.position;
      if (batchUpdateData.work_area) updatePayload.work_area = batchUpdateData.work_area;
      if (batchUpdateData.division) updatePayload.division = batchUpdateData.division;

      const { error } = await supabase
        .from('staff_users')
        .update(updatePayload)
        .in('id', Array.from(selectedEmployees));

      if (error) throw error;

      const updatedNames = employees
        .filter(emp => selectedEmployees.has(emp.id))
        .map(emp => emp.name)
        .join(', ');

      await logActivity('batch_update', updatedNames, { 
        count: selectedEmployees.size, 
        updates: updatePayload 
      });

      toast({
        title: "Berhasil",
        description: `${selectedEmployees.size} karyawan berhasil diupdate`
      });

      setIsBatchUpdateDialogOpen(false);
      setBatchUpdateData({ position: '', work_area: '', division: '' });
      setSelectedEmployees(new Set());
      fetchEmployees();
      fetchDropdownData();
    } catch (error) {
      toast({
        title: "Gagal",
        description: "Gagal mengupdate karyawan",
        variant: "destructive"
      });
    }
  };

  const downloadEmployeesExcel = () => {
    let employeesToExport = employees;

    // If there are selected employees, export only those
    if (selectedEmployees.size > 0) {
      employeesToExport = employees.filter(emp => selectedEmployees.has(emp.id));
    }

    const exportData = employeesToExport.map(emp => ({
      'UID': emp.uid,
      'Name': emp.name,
      'Position': emp.position,
      'Work Area': emp.work_area,
      'Division': emp.division || '',
      'Status': emp.is_active ? 'Active' : 'Inactive',
      'Created At': new Date(emp.created_at).toLocaleDateString('id-ID')
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');

    const fileName = selectedEmployees.size > 0 
      ? `employees_selected_${selectedEmployees.size}.xlsx`
      : `employees_all_${employees.length}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
    
    toast({
      title: "Download Berhasil",
      description: `${employeesToExport.length} data karyawan telah didownload`
    });
  };

  const downloadBatchQRCodes = async () => {
    let employeesToExport = employees;
    if (selectedEmployees.size > 0) {
      employeesToExport = employees.filter(emp => selectedEmployees.has(emp.id));
    }
    
    if (employeesToExport.length === 0) {
      toast({
        title: "Gagal",
        description: "Tidak ada karyawan untuk didownload",
        variant: "destructive"
      });
      return;
    }
    
    toast({
      title: "Memproses",
      description: `Mengunduh ${employeesToExport.length} QR Code...`
    });
    
    // Create PDF with jsPDF
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const qrSize = 50;
    const margin = 15;
    const cols = 3;
    const rows = 4;
    const itemsPerPage = cols * rows;
    
    for (let i = 0; i < employeesToExport.length; i++) {
      const emp = employeesToExport[i];
      const pageIndex = Math.floor(i / itemsPerPage);
      const itemIndex = i % itemsPerPage;
      
      if (itemIndex === 0 && i > 0) {
        pdf.addPage();
      }
      
      const col = itemIndex % cols;
      const row = Math.floor(itemIndex / cols);
      const x = margin + col * ((pageWidth - 2 * margin) / cols);
      const y = margin + row * (qrSize + 25);
      
      try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(emp.uid)}&format=png`;
        const response = await fetch(qrUrl);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        
        pdf.addImage(base64, 'PNG', x, y, qrSize, qrSize);
        pdf.setFontSize(8);
        pdf.text(emp.name.substring(0, 20), x + qrSize / 2, y + qrSize + 4, { align: 'center' });
        pdf.setFontSize(7);
        pdf.text(emp.uid, x + qrSize / 2, y + qrSize + 8, { align: 'center' });
      } catch (error) {
        console.error(`Failed to add QR for ${emp.uid}:`, error);
      }
    }
    
    pdf.save(`QR_Codes_${employeesToExport.length}_employees.pdf`);
    
    toast({
      title: "Berhasil",
      description: `${employeesToExport.length} QR Code telah diunduh`
    });
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

          // Fetch existing data for validation
          const { data: existingPositions } = await supabase
            .from('staff_users')
            .select('position')
            .not('position', 'is', null);
          
          const { data: existingWorkAreas } = await supabase
            .from('staff_users')
            .select('work_area')
            .not('work_area', 'is', null);
          
          const { data: existingDivisions } = await supabase
            .from('staff_users')
            .select('division')
            .not('division', 'is', null);

          // Convert to unique arrays (lowercase for comparison)
          const uniquePositions = [...new Set(existingPositions?.map(p => p.position.toLowerCase()) || [])];
          const uniqueWorkAreas = [...new Set(existingWorkAreas?.map(w => w.work_area.toLowerCase()) || [])];
          const uniqueDivisions = [...new Set(existingDivisions?.map(d => d.division?.toLowerCase()).filter(Boolean) || [])];

          const employeesToAdd = [];
          const errors = [];
          const duplicateUIDs = [];
          const mismatches: Array<{ userName: string; mismatches: string[] }> = [];

          // Check existing UIDs
          const { data: existingEmployees } = await supabase
            .from('staff_users')
            .select('uid');
          
          const existingUIDs = new Set(existingEmployees?.map(emp => emp.uid) || []);

          for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i] as any;
            const rowNum = i + 2; // +2 because of header row and 0-based index

            const uid = row['UID'] || row['uid'];
            let name = row['Name'] || row['name'];
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

            // Auto-uppercase name
            name = name.trim().toUpperCase();

            // Collect mismatches for this employee
            const userMismatches: string[] = [];
            
            if (position && !uniquePositions.includes(position.toLowerCase())) {
              userMismatches.push(`Position "${position}" tidak ditemukan dalam data existing`);
            }
            
            if (work_area && !uniqueWorkAreas.includes(work_area.toLowerCase())) {
              userMismatches.push(`Work Area "${work_area}" tidak ditemukan dalam data existing`);
            }
            
            if (division && !uniqueDivisions.includes(division.toLowerCase())) {
              userMismatches.push(`Division "${division}" tidak ditemukan dalam data existing`);
            }
            
            if (userMismatches.length > 0) {
              mismatches.push({
                userName: name,
                mismatches: userMismatches
              });
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

          // Insert all employees (including those with mismatches)
          const { error } = await supabase
            .from('staff_users')
            .insert(employeesToAdd);

          if (error) throw error;

          toast({
            title: "Import Berhasil",
            description: `${employeesToAdd.length} karyawan berhasil ditambahkan`
          });

          // Show mismatch dialog if there are mismatches
          if (mismatches.length > 0) {
            setMismatchData(mismatches);
            setIsMismatchDialogOpen(true);
          }

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
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={downloadBatchQRCodes}
            >
              <QrCode className="h-4 w-4 mr-2" />
              {selectedEmployees.size > 0 ? `Download ${selectedEmployees.size} QR` : 'Download All QR'}
            </Button>
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
                    <ComboboxField
                      value={formData.position}
                      onValueChange={(value) => setFormData({...formData, position: value})}
                      options={positions}
                      placeholder="Pilih atau ketik position baru"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="work_area">Work Area *</Label>
                    <ComboboxField
                      value={formData.work_area}
                      onValueChange={(value) => setFormData({...formData, work_area: value})}
                      options={workAreas}
                      placeholder="Pilih atau ketik work area baru"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="division">Division (Optional)</Label>
                    <ComboboxField
                      value={formData.division}
                      onValueChange={(value) => setFormData({...formData, division: value})}
                      options={divisions}
                      placeholder="Pilih atau ketik division baru"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="employee_type">Employee Type</Label>
                    <Select
                      value={formData.employee_type}
                      onValueChange={(value) => setFormData({...formData, employee_type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="primary">Primary (Operator)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Primary: jam masuk 07:00, wajib P2H & Toolbox. Staff: jam masuk 08:00/08:30.
                    </p>
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
                  {workAreas.filter(Boolean).map((workArea) => (
                    <SelectItem key={workArea} value={workArea}>
                      {workArea}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Total Count and Actions */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={selectedEmployees.size > 0 && selectedEmployees.size === employees.filter(emp => {
                    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase());
                    const matchesWorkArea = workAreaFilter === 'all' || emp.work_area === workAreaFilter;
                    return matchesSearch && matchesWorkArea;
                  }).length}
                  onCheckedChange={toggleSelectAll}
                />
                <Label htmlFor="select-all" className="text-sm cursor-pointer">
                  Pilih Semua
                </Label>
              </div>
              
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadEmployeesExcel}
                  className="ml-2"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Excel
                </Button>
              </div>
              
              {selectedEmployees.size > 0 && (
                <Badge variant="secondary" className="text-sm">
                  {selectedEmployees.size} dipilih
                </Badge>
              )}
            </div>

            {/* Batch Actions */}
            {selectedEmployees.size > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBatchUpdateDialogOpen(true)}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Batch Update
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-3 w-3 mr-1" />
                      Batch Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {selectedEmployees.size} Karyawan?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Apakah Anda yakin ingin menghapus {selectedEmployees.size} karyawan yang dipilih? 
                        Tindakan ini tidak dapat dibatalkan dan akan menghapus semua data absensi mereka.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleBatchDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Hapus Semua
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading employees...</div>
        ) : employees.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No employees found. Add your first employee to get started.
          </div>
        ) : (() => {
          const filteredEmployees = employees.filter(emp => {
            const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesWorkArea = workAreaFilter === 'all' || emp.work_area === workAreaFilter;
            return matchesSearch && matchesWorkArea;
          });
          
          const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
          const startIndex = (currentPage - 1) * itemsPerPage;
          const endIndex = startIndex + itemsPerPage;
          const currentEmployees = filteredEmployees.slice(startIndex, endIndex);
          
          return (
            <>
              <div className="space-y-4">
                {currentEmployees.map((employee) => (
              <div
                key={employee.id}
                className="rounded-lg p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors"
              >
                {/* Checkbox */}
                <div className="flex-shrink-0">
                  <Checkbox
                    checked={selectedEmployees.has(employee.id)}
                    onCheckedChange={() => toggleSelectEmployee(employee.id)}
                  />
                </div>
                
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
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="font-semibold text-foreground">{employee.name}</h3>
                    <Badge variant={employee.is_active ? "default" : "secondary"}>
                      {employee.is_active ? "Active" : "Inactive"}
                    </Badge>
                    {employee.is_admin && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
                        <Shield className="h-3 w-3 mr-1" />
                        Admin
                      </Badge>
                    )}
                    {employee.is_manager && (
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-300">
                        <Crown className="h-3 w-3 mr-1" />
                        Manager
                      </Badge>
                    )}
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
                
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    {/* Reset Password Button */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          title="Reset Password"
                        >
                          <KeyRound className="h-4 w-4 text-orange-500" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reset Password</AlertDialogTitle>
                          <AlertDialogDescription>
                            Reset password {employee.name} ke default? User akan diminta ganti password saat login berikutnya.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => resetPassword(employee)}>
                            Reset Password
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    
                    {/* Toggle Admin Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleAdminStatus(employee)}
                      title={employee.is_admin ? "Cabut Admin" : "Jadikan Admin"}
                    >
                      {employee.is_admin ? (
                        <ShieldOff className="h-4 w-4 text-amber-600" />
                      ) : (
                        <Shield className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    
                    {/* Toggle Manager Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleManagerStatus(employee)}
                      title={employee.is_manager ? "Cabut Manager" : "Jadikan Manager"}
                    >
                      <Crown className={`h-4 w-4 ${employee.is_manager ? 'text-purple-600' : 'text-muted-foreground'}`} />
                    </Button>
                    
                    {/* Toggle Active Status */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleEmployeeStatus(employee)}
                      title={employee.is_active ? "Nonaktifkan" : "Aktifkan"}
                    >
                      {employee.is_active ? (
                        <UserX className="h-4 w-4" />
                      ) : (
                        <UserCheck className="h-4 w-4" />
                      )}
                    </Button>
                    
                    {/* Edit Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDialog(employee)}
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    
                    {/* Delete Button */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" title="Hapus">
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
              </div>
            ))}
              </div>
              
              {/* No results message */}
              {filteredEmployees.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Tidak ada employee yang sesuai dengan filter.
                </div>
              )}
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                  <div className="text-sm text-muted-foreground">
                    Halaman {currentPage} dari {totalPages} (Total: {filteredEmployees.length} employees)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Sebelumnya
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Selanjutnya
                    </Button>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </CardContent>
      
      {/* Mismatch Dialog */}
      <Dialog open={isMismatchDialogOpen} onOpenChange={setIsMismatchDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-yellow-600 flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Peringatan: Data Tidak Sesuai
              </DialogTitle>
            </div>
            <DialogDescription>
              Data berikut berhasil disimpan, namun memiliki nilai yang tidak sesuai dengan data existing:
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[400px] overflow-y-auto pr-4">
            <div className="space-y-3">
              {mismatchData.map((item, idx) => (
                <div key={idx} className="border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded-r">
                  <p className="font-semibold text-gray-800 dark:text-gray-200">• {item.userName}</p>
                  <ul className="ml-4 mt-1 space-y-1">
                    {item.mismatches.map((msg, i) => (
                      <li key={i} className="text-sm text-gray-700 dark:text-gray-300">- {msg}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={() => setIsMismatchDialogOpen(false)}>
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Update Dialog */}
      <Dialog open={isBatchUpdateDialogOpen} onOpenChange={setIsBatchUpdateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Batch Update ({selectedEmployees.size} Karyawan)</DialogTitle>
            <DialogDescription>
              Update Position, Work Area, dan/atau Division untuk {selectedEmployees.size} karyawan yang dipilih
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="batch-position">Position (Optional)</Label>
              <ComboboxField
                value={batchUpdateData.position}
                onValueChange={(value) => setBatchUpdateData({...batchUpdateData, position: value})}
                options={positions}
                placeholder="Pilih atau ketik position baru (tidak diubah jika kosong)"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="batch-work-area">Work Area (Optional)</Label>
              <ComboboxField
                value={batchUpdateData.work_area}
                onValueChange={(value) => setBatchUpdateData({...batchUpdateData, work_area: value})}
                options={workAreas}
                placeholder="Pilih atau ketik work area baru (tidak diubah jika kosong)"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="batch-division">Division (Optional)</Label>
              <ComboboxField
                value={batchUpdateData.division}
                onValueChange={(value) => setBatchUpdateData({...batchUpdateData, division: value})}
                options={divisions}
                placeholder="Pilih atau ketik division baru (tidak diubah jika kosong)"
              />
            </div>
            
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                💡 Field yang tidak dipilih tidak akan diubah. Pilih minimal satu field untuk update.
              </p>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleBatchUpdate}
                className="flex-1"
                disabled={!batchUpdateData.position && !batchUpdateData.work_area && !batchUpdateData.division}
              >
                Update {selectedEmployees.size} Karyawan
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsBatchUpdateDialogOpen(false);
                  setBatchUpdateData({ position: '', work_area: '', division: '' });
                }}
              >
                Batal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default EmployeeManager;