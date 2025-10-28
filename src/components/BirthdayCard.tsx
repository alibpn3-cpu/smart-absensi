import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Cake } from 'lucide-react';

interface Birthday {
  id: string;
  nama: string;
  tanggal: string;
}

const BirthdayCard = () => {
  const [todayBirthdays, setTodayBirthdays] = useState<Birthday[]>([]);

  useEffect(() => {
    fetchTodayBirthdays();
  }, []);

  const fetchTodayBirthdays = async () => {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const todayFormat = `${day}/${month}`;

    const { data, error } = await supabase
      .from('birthdays')
      .select('*');

    if (error) {
      console.error('Error fetching birthdays:', error);
      return;
    }

    // Filter birthdays that match today's date/month
    const matches = (data || []).filter((b: Birthday) => b.tanggal === todayFormat);
    setTodayBirthdays(matches);
  };

  if (todayBirthdays.length === 0) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-950/20 dark:to-purple-950/20 border-pink-200 dark:border-pink-800 shadow-lg">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {/* Birthday Cake Icon */}
          <div className="flex-shrink-0">
            <div className="w-16 h-16 flex items-center justify-center bg-pink-100 dark:bg-pink-900/30 rounded-lg animate-pulse">
              <Cake className="w-10 h-10 text-pink-500 dark:text-pink-400" />
            </div>
          </div>

          {/* Birthday Message */}
          <div className="flex-1">
            <h3 className="text-sm font-bold text-pink-700 dark:text-pink-300 mb-1">
              🎉 Selamat Ulang Tahun! 🎂
            </h3>
            <div className="text-sm font-semibold text-pink-900 dark:text-pink-100 flex flex-wrap gap-1">
              {todayBirthdays.map((birthday, index) => (
                <span key={birthday.id}>
                  {birthday.nama}
                  {index < todayBirthdays.length - 1 && ', '}
                </span>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BirthdayCard;
