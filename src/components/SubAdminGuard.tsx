import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Props {
  children: React.ReactNode;
}

const SubAdminGuard: React.FC<Props> = ({ children }) => {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const sessionRaw = localStorage.getItem('userSession');
    if (!sessionRaw) {
      navigate('/user-login');
      return;
    }
    try {
      const session = JSON.parse(sessionRaw);
      if (!session?.uid) {
        navigate('/user-login');
        return;
      }
      supabase
        .from('staff_users')
        .select('show_attendance_status')
        .eq('uid', session.uid)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.show_attendance_status === true) {
            setAllowed(true);
          } else {
            toast({
              title: 'Akses Ditolak',
              description: 'Halaman laporan hanya untuk Sub-Admin.',
              variant: 'destructive',
            });
            navigate('/');
          }
        });
    } catch {
      navigate('/user-login');
    }
  }, [navigate]);

  if (allowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-sm opacity-70">Memeriksa akses…</div>
      </div>
    );
  }
  if (!allowed) return null;
  return <>{children}</>;
};

export default SubAdminGuard;
