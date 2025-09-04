import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import AttendanceForm from '../components/AttendanceForm';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Admin Login Button */}
      <div className="flex justify-end p-4">
        <Button 
          variant="outline" 
          onClick={() => navigate('/login')}
          className="flex items-center gap-2"
        >
          <Settings className="h-4 w-4" />
          Admin Login
        </Button>
      </div>

      {/* Main Attendance Form */}
      <div className="flex items-center justify-center px-4 pb-8">
        <AttendanceForm />
      </div>
    </div>
  );
};

export default Index;
