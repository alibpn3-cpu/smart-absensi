import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChangelogCarouselProps {
  pages: string[];
  version: string;
  onComplete: () => void;
}

const ChangelogCarousel: React.FC<ChangelogCarouselProps> = ({
  pages,
  version,
  onComplete
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right'>('right');

  const totalPages = pages.length;
  const isLastPage = currentPage === totalPages - 1;
  const isFirstPage = currentPage === 0;

  const goToPage = (newPage: number, dir: 'left' | 'right') => {
    if (isAnimating || newPage < 0 || newPage >= totalPages) return;
    
    setDirection(dir);
    setIsAnimating(true);
    
    setTimeout(() => {
      setCurrentPage(newPage);
      setTimeout(() => {
        setIsAnimating(false);
      }, 50);
    }, 150);
  };

  const goNext = () => {
    if (!isLastPage) {
      goToPage(currentPage + 1, 'right');
    }
  };

  const goPrev = () => {
    if (!isFirstPage) {
      goToPage(currentPage - 1, 'left');
    }
  };

  // Parse changelog lines from current page
  const currentContent = pages[currentPage] || '';
  const lines = currentContent.split('\n').filter(line => line.trim());

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="bg-primary/10 px-6 py-4 border-b border-border">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">
              Yang Baru di {version}
            </h2>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-1">
            Halaman {currentPage + 1} dari {totalPages}
          </p>
        </div>

        {/* Content with fade animation */}
        <div className="relative min-h-[280px] overflow-hidden">
          <div
            className={cn(
              "absolute inset-0 px-6 py-6 transition-all duration-300 ease-in-out",
              isAnimating && direction === 'right' && "opacity-0 -translate-x-4",
              isAnimating && direction === 'left' && "opacity-0 translate-x-4",
              !isAnimating && "opacity-100 translate-x-0"
            )}
          >
            <div className="space-y-3">
              {lines.map((line, index) => {
                const trimmedLine = line.trim();
                const isBullet = trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*');
                const isHeader = trimmedLine.startsWith('#');
                const isNumbered = /^\d+\./.test(trimmedLine);

                if (isHeader) {
                  return (
                    <h3 key={index} className="font-semibold text-primary text-base mt-4 first:mt-0">
                      {trimmedLine.replace(/^#+\s*/, '')}
                    </h3>
                  );
                }

                if (isBullet) {
                  return (
                    <div key={index} className="flex items-start gap-3">
                      <span className="text-primary mt-0.5 shrink-0">•</span>
                      <span className="text-foreground text-sm leading-relaxed">
                        {trimmedLine.replace(/^[•\-\*]\s*/, '')}
                      </span>
                    </div>
                  );
                }

                if (isNumbered) {
                  const match = trimmedLine.match(/^(\d+)\.\s*(.*)/);
                  return (
                    <div key={index} className="flex items-start gap-3">
                      <span className="text-primary font-medium shrink-0 w-5">{match?.[1]}.</span>
                      <span className="text-foreground text-sm leading-relaxed">
                        {match?.[2]}
                      </span>
                    </div>
                  );
                }

                return (
                  <p key={index} className="text-foreground text-sm leading-relaxed">
                    {trimmedLine}
                  </p>
                );
              })}
            </div>
          </div>
        </div>

        {/* Dots Indicator */}
        <div className="flex justify-center gap-2 py-3 bg-muted/30">
          {pages.map((_, index) => (
            <button
              key={index}
              onClick={() => goToPage(index, index > currentPage ? 'right' : 'left')}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all duration-300",
                index === currentPage
                  ? "bg-primary w-6"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              aria-label={`Go to page ${index + 1}`}
            />
          ))}
        </div>

        {/* Navigation Buttons */}
        <div className="px-6 py-4 bg-muted/20 border-t border-border flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={goPrev}
            disabled={isFirstPage || isAnimating}
            className={cn(
              "gap-1 transition-opacity",
              isFirstPage && "opacity-0 pointer-events-none"
            )}
          >
            <ChevronLeft className="w-4 h-4" />
            Sebelumnya
          </Button>

          {isLastPage ? (
            <Button
              onClick={onComplete}
              disabled={isAnimating}
              className="gap-2 bg-primary hover:bg-primary/90 px-6"
            >
              <Check className="w-4 h-4" />
              Selesai
            </Button>
          ) : (
            <Button
              onClick={goNext}
              disabled={isAnimating}
              className="gap-1 bg-primary hover:bg-primary/90"
            >
              Selanjutnya
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChangelogCarousel;
