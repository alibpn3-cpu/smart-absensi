import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Cake } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import Autoplay from 'embla-carousel-autoplay';
import { cn } from '@/lib/utils';

interface Birthday {
  id: string;
  nama: string;
  tanggal: string;
  lokasi: string;
  level: string;
}

const ITEMS_PER_SLIDE = 5;

const BirthdayCard = () => {
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<Birthday[]>([]);
  const [isToday, setIsToday] = useState(false);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    fetchBirthdays();
  }, []);

  useEffect(() => {
    if (!api) return;

    setCurrent(api.selectedScrollSnap());
    api.on('select', () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  const fetchBirthdays = async () => {
    try {
      const { data, error } = await supabase
        .from('birthdays')
        .select('*');

      if (error) throw error;

      if (data) {
        const now = new Date();
        const todayDate = now.getDate();
        const todayMonth = now.getMonth() + 1;
        const todayDDMM = `${todayDate.toString().padStart(2, '0')}/${todayMonth.toString().padStart(2, '0')}`;

        // Check for today's birthdays
        const birthdaysToday = data.filter((b) => b.tanggal === todayDDMM);
        
        if (birthdaysToday.length > 0) {
          setUpcomingBirthdays(birthdaysToday);
          setIsToday(true);
          return;
        }

        // Check for birthdays in the next 7 days
        const next7DaysBirthdays: Birthday[] = [];
        for (let i = 1; i <= 7; i++) {
          const futureDate = new Date(now);
          futureDate.setDate(now.getDate() + i);
          const futureDay = futureDate.getDate().toString().padStart(2, '0');
          const futureMonth = (futureDate.getMonth() + 1).toString().padStart(2, '0');
          const futureDDMM = `${futureDay}/${futureMonth}`;
          
          const matchingBirthdays = data.filter((b) => b.tanggal === futureDDMM);
          next7DaysBirthdays.push(...matchingBirthdays);
        }

        if (next7DaysBirthdays.length > 0) {
          setUpcomingBirthdays(next7DaysBirthdays);
          setIsToday(false);
        }
      }
    } catch (error) {
      console.error('Error fetching birthdays:', error);
    }
  };

  // Split birthdays into slides of 5 items each
  const splitIntoSlides = (birthdays: Birthday[], perSlide: number): Birthday[][] => {
    const slides: Birthday[][] = [];
    for (let i = 0; i < birthdays.length; i += perSlide) {
      slides.push(birthdays.slice(i, i + perSlide));
    }
    return slides;
  };

  const birthdaySlides = splitIntoSlides(upcomingBirthdays, ITEMS_PER_SLIDE);

  if (upcomingBirthdays.length === 0) {
    return null;
  }

  const renderBirthdayList = (birthdays: Birthday[]) => (
    <div className="flex flex-col gap-1">
      {birthdays.map((birthday) => (
        <span
          key={birthday.id}
          className="text-sm font-bold text-pink-600 dark:text-pink-400"
        >
          {birthday.nama} ({birthday.lokasi})
        </span>
      ))}
    </div>
  );

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
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold text-pink-700 dark:text-pink-300 mb-2">
              {isToday ? '🎉 Selamat Ulang Tahun! 🎉' : '🎂 Ulang Tahun Minggu Ini'}
            </p>
            
            {birthdaySlides.length > 1 ? (
              <div>
                <Carousel
                  setApi={setApi}
                  opts={{ loop: true }}
                  plugins={[
                    Autoplay({ delay: 4000, stopOnInteraction: false })
                  ]}
                  className="w-full"
                >
                  <CarouselContent>
                    {birthdaySlides.map((slide, slideIndex) => (
                      <CarouselItem key={slideIndex}>
                        {renderBirthdayList(slide)}
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>
                {/* Dot Indicators */}
                <div className="flex justify-center gap-1.5 mt-2">
                  {birthdaySlides.map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        "w-2 h-2 rounded-full transition-colors duration-300",
                        index === current ? "bg-pink-500" : "bg-pink-200 dark:bg-pink-800"
                      )}
                    />
                  ))}
                </div>
              </div>
            ) : (
              renderBirthdayList(upcomingBirthdays)
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BirthdayCard;
