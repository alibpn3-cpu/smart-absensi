import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

interface UserSession {
  uid: string;
  name: string;
  position: string;
  work_area: string;
  division?: string;
  photo_url?: string;
  is_admin: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  // Check for staff admin session
  const userSessionData = localStorage.getItem('userSession');
  let isStaffAdmin = false;
  
  if (userSessionData) {
    try {
      const userSession: UserSession = JSON.parse(userSessionData);
      isStaffAdmin = userSession.is_admin;
    } catch (error) {
      console.error('Error parsing user session:', error);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Checking authentication...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Allow access if superadmin (from adminSession) OR staff admin (is_admin=true)
  if (!isAuthenticated && !isStaffAdmin) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
