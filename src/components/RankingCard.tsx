import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import Autoplay from 'embla-carousel-autoplay';
import { Trophy, Medal, Award, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// Tier thresholds based on total stars
const TIER_THRESHOLDS = {
  platinum: 60,  // >= 60 stars
  gold: 50,      // >= 50 stars
  silver: 40,    // >= 40 stars
  bronze: 30,    // >= 30 stars
};

const MAX_USERS_PER_TIER = 10;

interface RankingUser {
  staff_uid: string;
  staff_name: string;
  total_score: number;
  total_days: number;
  photo_url?: string;
  tierRank?: number; // Position within the tier (1-10)
}

interface MedalTier {
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  rankRange: string; // e.g., "≥60⭐"
  users: RankingUser[];
}

const RankingCard = () => {
  const [rankings, setRankings] = useState<MedalTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mainApi, setMainApi] = useState<CarouselApi>();
  const [mainCurrent, setMainCurrent] = useState(0);
  
  // Check if we should show ranking card (only on 1st-15th of month)
  const today = new Date();
  const dayOfMonth = today.getDate();
  
  // Show previous month's ranking (since we're on 1st-15th)
  const getDefaultMonth = () => {
    const prevMonth = today.getMonth() - 1;
    return prevMonth < 0 ? 11 : prevMonth;
  };
  
  const getDefaultYear = () => {
    if (today.getMonth() === 0) {
      // If January, show December of previous year
      return today.getFullYear() - 1;
    }
    return today.getFullYear();
  };
  
  const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth());
  const [selectedYear, setSelectedYear] = useState(getDefaultYear());

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Generate available years (current year - 2 to current year)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    if (!mainApi) return;

    setMainCurrent(mainApi.selectedScrollSnap());
    mainApi.on('select', () => {
      setMainCurrent(mainApi.selectedScrollSnap());
    });
  }, [mainApi]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (selectedMonth === 0) {
        setSelectedMonth(11);
        setSelectedYear(prev => prev - 1);
      } else {
        setSelectedMonth(prev => prev - 1);
      }
    } else {
      if (selectedMonth === 11) {
        setSelectedMonth(0);
        setSelectedYear(prev => prev + 1);
      } else {
        setSelectedMonth(prev => prev + 1);
      }
    }
  };

  // Helper function to group users by threshold-based tiers
  const groupUsersByThreshold = (allUsers: RankingUser[]): MedalTier[] => {
    // Platinum: >= 60 stars
    const platinumUsers = allUsers
      .filter(u => u.total_score >= TIER_THRESHOLDS.platinum)
      .slice(0, MAX_USERS_PER_TIER)
      .map((u, idx) => ({ ...u, tierRank: idx + 1 }));

    const platinumUids = new Set(platinumUsers.map(u => u.staff_uid));

    // Gold: >= 50 stars AND < 60 stars (exclude platinum users)
    const goldUsers = allUsers
      .filter(u => 
        u.total_score >= TIER_THRESHOLDS.gold && 
        u.total_score < TIER_THRESHOLDS.platinum &&
        !platinumUids.has(u.staff_uid)
      )
      .slice(0, MAX_USERS_PER_TIER)
      .map((u, idx) => ({ ...u, tierRank: idx + 1 }));

    const goldUids = new Set(goldUsers.map(u => u.staff_uid));

    // Silver: >= 40 stars AND < 50 stars (exclude platinum & gold users)
    const silverUsers = allUsers
      .filter(u => 
        u.total_score >= TIER_THRESHOLDS.silver && 
        u.total_score < TIER_THRESHOLDS.gold &&
        !platinumUids.has(u.staff_uid) &&
        !goldUids.has(u.staff_uid)
      )
      .slice(0, MAX_USERS_PER_TIER)
      .map((u, idx) => ({ ...u, tierRank: idx + 1 }));

    const silverUids = new Set(silverUsers.map(u => u.staff_uid));

    // Bronze: >= 30 stars AND < 40 stars (exclude all above)
    const bronzeUsers = allUsers
      .filter(u => 
        u.total_score >= TIER_THRESHOLDS.bronze && 
        u.total_score < TIER_THRESHOLDS.silver &&
        !platinumUids.has(u.staff_uid) &&
        !goldUids.has(u.staff_uid) &&
        !silverUids.has(u.staff_uid)
      )
      .slice(0, MAX_USERS_PER_TIER)
      .map((u, idx) => ({ ...u, tierRank: idx + 1 }));

    const tiers: MedalTier[] = [
      {
        name: 'Platinum',
        icon: <Trophy className="h-5 w-5" />,
        color: 'text-cyan-600 dark:text-cyan-400',
        bgColor: 'bg-gradient-to-r from-cyan-100 to-slate-100 dark:from-cyan-900/30 dark:to-slate-900/30',
        rankRange: `≥${TIER_THRESHOLDS.platinum}⭐`,
        users: platinumUsers
      },
      {
        name: 'Gold',
        icon: <Medal className="h-5 w-5" />,
        color: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30',
        rankRange: `≥${TIER_THRESHOLDS.gold}⭐`,
        users: goldUsers
      },
      {
        name: 'Silver',
        icon: <Award className="h-5 w-5" />,
        color: 'text-slate-500 dark:text-slate-400',
        bgColor: 'bg-gradient-to-r from-slate-100 to-gray-100 dark:from-slate-800/30 dark:to-gray-800/30',
        rankRange: `≥${TIER_THRESHOLDS.silver}⭐`,
        users: silverUsers
      },
      {
        name: 'Bronze',
        icon: <Star className="h-5 w-5" />,
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30',
        rankRange: `≥${TIER_THRESHOLDS.bronze}⭐`,
        users: bronzeUsers
      }
    ];

    // Only return tiers that have users
    return tiers.filter(t => t.users.length > 0);
  };

  useEffect(() => {
    const fetchRankings = async () => {
      setIsLoading(true);
      try {
        // First, check for manual overrides
        const { data: overrides, error: overrideError } = await supabase
          .from('monthly_ranking_overrides')
          .select('*')
          .eq('year', selectedYear)
          .eq('month', selectedMonth + 1)
          .order('tier')
          .order('display_order');

        if (overrideError) throw overrideError;

        // If we have overrides, use them (treat display_score as total)
        if (overrides && overrides.length > 0) {
          const allUsers: RankingUser[] = overrides.map((o) => ({
            staff_uid: o.staff_uid,
            staff_name: o.staff_name,
            total_score: Number(o.display_score),
            total_days: 0,
            photo_url: o.photo_url || undefined
          }));

          // Sort by total_score DESC before grouping
          allUsers.sort((a, b) => b.total_score - a.total_score);
          
          setRankings(groupUsersByThreshold(allUsers));
          return;
        }

        // No overrides - use auto-calculated from daily_scores
        const firstDay = new Date(selectedYear, selectedMonth, 1);
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
        const firstDayStr = firstDay.toISOString().split('T')[0];
        const lastDayStr = lastDay.toISOString().split('T')[0];

        const { data: scores, error } = await supabase
          .from('daily_scores')
          .select('staff_uid, staff_name, final_score')
          .gte('score_date', firstDayStr)
          .lte('score_date', lastDayStr);

        if (error) throw error;

        // Calculate total score per user
        const userScores = new Map<string, { name: string; scores: number[] }>();
        
        scores?.forEach(score => {
          if (!userScores.has(score.staff_uid)) {
            userScores.set(score.staff_uid, { name: score.staff_name, scores: [] });
          }
          userScores.get(score.staff_uid)!.scores.push(Number(score.final_score));
        });

        // Calculate totals
        const allUsers: RankingUser[] = [];
        for (const [uid, data] of userScores) {
          const total = data.scores.reduce((a, b) => a + b, 0);
          allUsers.push({
            staff_uid: uid,
            staff_name: data.name,
            total_score: Math.round(total * 10) / 10, // 1 decimal place
            total_days: data.scores.length
          });
        }

        // Sort by total_score DESC
        allUsers.sort((a, b) => b.total_score - a.total_score);

        // Fetch photos for users that meet minimum threshold (>= 30 stars)
        const qualifiedUsers = allUsers.filter(u => u.total_score >= TIER_THRESHOLDS.bronze);
        const topUids = qualifiedUsers.slice(0, 40).map(u => u.staff_uid);
        
        if (topUids.length > 0) {
          const { data: users } = await supabase
            .from('staff_users')
            .select('uid, photo_url')
            .in('uid', topUids);

          const photoMap = new Map(users?.map(u => [u.uid, u.photo_url]) || []);
          allUsers.forEach(u => {
            u.photo_url = photoMap.get(u.staff_uid) || undefined;
          });
        }

        // Group by threshold-based tiers
        setRankings(groupUsersByThreshold(allUsers));
      } catch (error) {
        console.error('Error fetching rankings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRankings();
  }, [selectedMonth, selectedYear]);

  // Hide card completely on 16th-end of month (after all hooks are called)
  if (dayOfMonth > 15) {
    return null;
  }

  const renderUserItem = (user: RankingUser, tierColor: string) => (
    <div key={user.staff_uid} className="flex items-center gap-2 bg-background/80 rounded-full px-2 py-1.5">
      <span className={`text-xs font-bold w-5 ${tierColor}`}>#{user.tierRank}</span>
      <Avatar className="h-7 w-7 border border-border">
        <AvatarImage src={user.photo_url} alt={user.staff_name} />
        <AvatarFallback className="text-[10px] bg-primary/10">
          {user.staff_name.charAt(0)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium truncate block">
          {user.staff_name}
        </span>
      </div>
      <span className="text-xs font-semibold text-muted-foreground">
        {Math.round(user.total_score)}⭐
      </span>
    </div>
  );

  const renderTierContent = (tier: MedalTier) => {
    return (
      <div className={`rounded-lg p-3 ${tier.bgColor} min-h-[180px]`}>
        <div className="flex items-center justify-between mb-3">
          <div className={`flex items-center gap-2 ${tier.color}`}>
            {tier.icon}
            <span className="text-sm font-bold">{tier.name}</span>
            <span className="text-xs opacity-70">{tier.rankRange}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {tier.users.length} karyawan
          </span>
        </div>
        
        {/* Render all users in single view (max 10) */}
        <div className="space-y-1.5">
          {tier.users.map((user) => 
            renderUserItem(user, tier.color)
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-5 bg-muted rounded w-1/3"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <CardHeader className="pb-2 pt-3 px-4 bg-gradient-to-r from-primary/10 to-primary/5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          Ranking Bulanan
        </CardTitle>
        {/* Month/Year Selector */}
        <div className="flex items-center gap-1 mt-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => navigateMonth('prev')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select
            value={selectedMonth.toString()}
            onValueChange={(v) => setSelectedMonth(parseInt(v))}
          >
            <SelectTrigger className="h-7 text-xs w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month, idx) => (
                <SelectItem key={idx} value={idx.toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedYear.toString()}
            onValueChange={(v) => setSelectedYear(parseInt(v))}
          >
            <SelectTrigger className="h-7 text-xs w-16">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => navigateMonth('next')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3">
        {rankings.length === 0 ? (
          <div className="text-center py-4">
            <Trophy className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Belum ada data ranking untuk {months[selectedMonth]} {selectedYear}
            </p>
          </div>
        ) : rankings.length === 1 ? (
          // Only one tier - no main carousel needed
          renderTierContent(rankings[0])
        ) : (
          // Multiple tiers - use main carousel (auto-slide between tiers)
          <div>
            <Carousel
              setApi={setMainApi}
              opts={{ loop: true }}
              plugins={[
                Autoplay({ delay: 8000, stopOnInteraction: false })
              ]}
              className="w-full"
            >
              <CarouselContent>
                {rankings.map((tier) => (
                  <CarouselItem key={tier.name}>
                    {renderTierContent(tier)}
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
            {/* Main carousel dot indicators */}
            <div className="flex justify-center gap-1.5 mt-3">
              {rankings.map((tier, index) => (
                <button
                  key={tier.name}
                  onClick={() => mainApi?.scrollTo(index)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors duration-300",
                    index === mainCurrent ? "bg-primary" : "bg-primary/30"
                  )}
                  aria-label={`Go to ${tier.name}`}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RankingCard;
