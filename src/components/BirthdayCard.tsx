import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Cake } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
    try {
      const now = new Date();
      const todayDate = now.getDate().toString().padStart(2, '0');
      const todayMonth = (now.getMonth() + 1).toString().padStart(2, '0');
      const todayDDMM = `${todayDate}/${todayMonth}`;

      const { data, error } = await supabase
        .from('birthdays')
        .select('*');

      if (error) throw error;

      if (data) {
        const birthdaysToday = data.filter((b) => b.tanggal === todayDDMM);
        setTodayBirthdays(birthdaysToday);
      }
    } catch (error) {
      console.error('Error fetching birthdays:', error);
    }
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
            <div className="w-12 h-12 flex items-center justify-center bg-pink-100 dark:bg-pink-900/30 rounded-lg">
              <Cake className="w-8 h-8 text-pink-500 dark:text-pink-400 animate-pulse" />
            </div>
          </div>

          {/* Birthday Message */}
          <div className="flex-1">
            <p className="text-sm font-semibold text-pink-700 dark:text-pink-300 mb-1">
              🎉 Selamat Ulang Tahun! 🎉
            </p>
            <div className="flex flex-wrap gap-1">
              {todayBirthdays.map((birthday, index) => (
                <span
                  key={birthday.id}
                  className="text-sm font-bold text-pink-600 dark:text-pink-400"
                >
                  {birthday.nama}
                  {index < todayBirthdays.length - 1 && ','}
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
