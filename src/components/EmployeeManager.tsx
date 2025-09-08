import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Users, Plus, Edit, Trash2, UserCheck, UserX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface StaffUser {
  id: string;
  uid: string;
  name: string;
  position: string;
  work_area: string;
  division?: string;
  is_active: boolean;
  created_at: string;
}

const EmployeeManager = () => {
  const [employees, setEmployees] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<StaffUser | null>(null);
  const [formData, setFormData] = useState({
    uid: '',
    name: '',
    position: '',
    work_area: '',
    division: ''
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

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
      division: ''
    });
    setEditingEmployee(null);
  };

  const openDialog = (employee?: StaffUser) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        uid: employee.uid,
        name: employee.name,
        position: employee.position,
        work_area: employee.work_area,
        division: employee.division || ''
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.uid || !formData.name || !formData.position || !formData.work_area) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const employeeData = {
      uid: formData.uid,
      name: formData.name,
      position: formData.position,
      work_area: formData.work_area,
      division: formData.division || null
    };

    try {
      if (editingEmployee) {
        // Update existing employee
        const { error } = await supabase
          .from('staff_users')
          .update(employeeData)
          .eq('id', editingEmployee.id);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Employee updated successfully"
        });
      } else {
        // Check if UID already exists
        const { data: existingEmployee } = await supabase
          .from('staff_users')
          .select('uid')
          .eq('uid', formData.uid)
          .single();

        if (existingEmployee) {
          toast({
            title: "Error",
            description: "Employee UID already exists",
            variant: "destructive"
          });
          return;
        }

        // Create new employee
        const { error } = await supabase
          .from('staff_users')
          .insert([employeeData]);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Employee added successfully"
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchEmployees();
    } catch (error) {
      console.error('Error saving employee:', error);
      toast({
        title: "Error",
        description: "Failed to save employee",
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
        title: "Success",
        description: `Employee ${employee.is_active ? 'deactivated' : 'activated'} successfully`
      });
      fetchEmployees();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update employee status",
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

      toast({
        title: "Success",
        description: "Employee deleted successfully"
      });
      fetchEmployees();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete employee",
        variant: "destructive"
      });
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
                  <Input
                    id="position"
                    value={formData.position}
                    onChange={(e) => setFormData({...formData, position: e.target.value})}
                    placeholder="e.g., Software Developer"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="work_area">Work Area *</Label>
                  <Input
                    id="work_area"
                    value={formData.work_area}
                    onChange={(e) => setFormData({...formData, work_area: e.target.value})}
                    placeholder="e.g., IT Department"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="division">Division (Optional)</Label>
                  <Input
                    id="division"
                    value={formData.division}
                    onChange={(e) => setFormData({...formData, division: e.target.value})}
                    placeholder="e.g., Engineering"
                  />
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1 gradient-primary">
                    {editingEmployee ? 'Update' : 'Add'} Employee
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
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Loading employees...</div>
        ) : employees.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No employees found. Add your first employee to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {employees.map((employee) => (
              <div
                key={employee.id}
                className="border rounded-lg p-4 flex items-center justify-between hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer"
              >
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
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EmployeeManager;