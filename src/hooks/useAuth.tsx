import { useEffect, useState } from 'react';

interface AdminSession {
  username: string;
  loginTime: string;
}

export const useAuth = () => {
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for admin session in localStorage
    const checkSession = () => {
      try {
        const sessionData = localStorage.getItem('adminSession');
        if (sessionData) {
          const session: AdminSession = JSON.parse(sessionData);
          setAdminSession(session);
        }
      } catch (error) {
        console.error('Error checking admin session:', error);
        localStorage.removeItem('adminSession');
      }
      setLoading(false);
    };

    checkSession();

    // Listen for storage changes (if user logs out in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'adminSession') {
        checkSession();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const signOut = () => {
    localStorage.removeItem('adminSession');
    setAdminSession(null);
    // Force navigation to login page
    window.location.href = '/login';
  };

  return {
    user: adminSession,
    loading,
    signOut,
    isAuthenticated: !!adminSession
  };
};