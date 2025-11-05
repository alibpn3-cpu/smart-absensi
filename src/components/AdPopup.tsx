import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AdImage {
  id: string;
  image_url: string;
  display_order: number;
}

const AdPopup = () => {
  const [ads, setAds] = useState<AdImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [hasShownInitial, setHasShownInitial] = useState(false);

  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    fetchAds();
  }, []);

  useEffect(() => {
    if (ads.length === 0 || hasShownInitial) return;

    // Show first ad after 1 second
    const timer = window.setTimeout(() => {
      setIsVisible(true);
      setHasShownInitial(true);
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [ads, hasShownInitial]);

  useEffect(() => {
    if (!hasShownInitial || ads.length === 0) return;

    // Set up interval to show ads every 2 minutes
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    intervalRef.current = window.setInterval(() => {
      setIsVisible(true);
      if (ads.length > 1) {
        setCurrentIndex((prev) => {
          let newIndex = prev;
          do {
            newIndex = Math.floor(Math.random() * ads.length);
          } while (newIndex === prev && ads.length > 1);
          return newIndex;
        });
      }
    }, 20000); // 30 seconds = 30000ms

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [ads.length, hasShownInitial]);


  const fetchAds = async () => {
    const { data, error } = await supabase
      .from('ad_images')
      .select('id, image_url, display_order')
      .eq('is_active', true)
      .order('display_order');

    if (error) {
      console.error('Error fetching ads:', error);
      return;
    }

    setAds(data || []);
  };

  const closePopup = () => {
    setIsVisible(false);
  };

  if (!isVisible || ads.length === 0) return null;

  const currentAd = ads[currentIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={closePopup}
    >
      <div
        className="relative w-11/12 sm:w-3/4 max-w-4xl max-h-[75vh] bg-white/95 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={closePopup}
          className="absolute top-3 right-3 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-all duration-200 hover:scale-110"
          aria-label="Close advertisement"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Ad Image */}
        <div className="w-full h-full flex items-center justify-center p-4">
          <img
            src={currentAd.image_url}
            alt={`Advertisement ${currentIndex + 1}`}
            className="max-w-full max-h-[70vh] object-contain rounded-lg"
            onError={(e) => {
              console.error('Failed to load ad image');
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>

        {/* Ad Counter */}
        {ads.length > 1 && (
          <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-2">
            {ads.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentIndex ? 'w-8 bg-primary' : 'w-2 bg-gray-300'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdPopup;
