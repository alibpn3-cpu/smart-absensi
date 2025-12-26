import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award, Star, Plus, Trash2, Save, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface StaffUser {
  uid: string;
  name: string;
  photo_url: string | null;
}

interface RankingOverride {
  id?: string;
  tier: 'platinum' | 'gold' | 'silver' | 'bronze';
  staff_uid: string;
  staff_name: string;
  photo_url: string | null;
  display_score: number;
  display_order: number;
}

const TIERS = [
  { id: 'platinum', name: 'Platinum', icon: Trophy, color: 'text-cyan-600', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30', minScore: 4.5 },
  { id: 'gold', name: 'Gold', icon: Medal, color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', minScore: 4.0 },
  { id: 'silver', name: 'Silver', icon: Award, color: 'text-slate-500', bgColor: 'bg-slate-100 dark:bg-slate-800/30', minScore: 3.5 },
  { id: 'bronze', name: 'Bronze', icon: Star, color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', minScore: 3.0 },
] as const;

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const RankingOverrideManager = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [overrides, setOverrides] = useState<RankingOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state for adding new entry
  const [selectedTier, setSelectedTier] = useState<'platinum' | 'gold' | 'silver' | 'bronze'>('platinum');
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [displayScore, setDisplayScore] = useState<string>('5.0');

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch staff users
      const { data: staff } = await supabase
        .from('staff_users')
        .select('uid, name, photo_url')
        .eq('is_active', true)
        .order('name');

      if (staff) setStaffUsers(staff);

      // Fetch existing overrides
      const { data: existingOverrides, error } = await supabase
        .from('monthly_ranking_overrides')
        .select('*')
        .eq('year', selectedYear)
        .eq('month', selectedMonth + 1)
        .order('tier')
        .order('display_order');

      if (error) throw error;

      if (existingOverrides) {
        setOverrides(existingOverrides.map(o => ({
          id: o.id,
          tier: o.tier as 'platinum' | 'gold' | 'silver' | 'bronze',
          staff_uid: o.staff_uid,
          staff_name: o.staff_name,
          photo_url: o.photo_url,
          display_score: Number(o.display_score),
          display_order: o.display_order
        })));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

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

  const addToTier = () => {
    if (!selectedStaff) {
      toast({ title: "Error", description: "Pilih employee terlebih dahulu", variant: "destructive" });
      return;
    }

    // Check if already exists
    if (overrides.some(o => o.staff_uid === selectedStaff)) {
      toast({ title: "Error", description: "Employee sudah ada di ranking", variant: "destructive" });
      return;
    }

    const staff = staffUsers.find(s => s.uid === selectedStaff);
    if (!staff) return;

    const tierOverrides = overrides.filter(o => o.tier === selectedTier);
    
    const newOverride: RankingOverride = {
      tier: selectedTier,
      staff_uid: staff.uid,
      staff_name: staff.name,
      photo_url: staff.photo_url,
      display_score: parseFloat(displayScore) || 5.0,
      display_order: tierOverrides.length
    };

    setOverrides([...overrides, newOverride]);
    setSelectedStaff('');
    setDisplayScore('5.0');
  };

  const removeFromTier = (staff_uid: string) => {
    setOverrides(overrides.filter(o => o.staff_uid !== staff_uid));
  };

  const updateScore = (staff_uid: string, newScore: string) => {
    setOverrides(overrides.map(o => 
      o.staff_uid === staff_uid ? { ...o, display_score: parseFloat(newScore) || 0 } : o
    ));
  };

  const saveOverrides = async () => {
    setSaving(true);
    try {
      // Delete existing overrides for this month/year
      await supabase
        .from('monthly_ranking_overrides')
        .delete()
        .eq('year', selectedYear)
        .eq('month', selectedMonth + 1);

      // Insert new overrides
      if (overrides.length > 0) {
        const { error } = await supabase
          .from('monthly_ranking_overrides')
          .insert(overrides.map((o, idx) => ({
            year: selectedYear,
            month: selectedMonth + 1,
            tier: o.tier,
            staff_uid: o.staff_uid,
            staff_name: o.staff_name,
            photo_url: o.photo_url,
            display_score: o.display_score,
            display_order: idx
          })));

        if (error) throw error;
      }

      toast({
        title: "Berhasil",
        description: `Ranking ${MONTHS[selectedMonth]} ${selectedYear} berhasil disimpan`
      });

      fetchData();
    } catch (error) {
      console.error('Error saving overrides:', error);
      toast({
        title: "Error",
        description: "Gagal menyimpan ranking",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const clearAll = async () => {
    if (!confirm(`Hapus semua ranking manual untuk ${MONTHS[selectedMonth]} ${selectedYear}?`)) return;
    
    try {
      await supabase
        .from('monthly_ranking_overrides')
        .delete()
        .eq('year', selectedYear)
        .eq('month', selectedMonth + 1);

      setOverrides([]);
      toast({ title: "Berhasil", description: "Ranking berhasil dihapus" });
    } catch (error) {
      toast({ title: "Error", description: "Gagal menghapus ranking", variant: "destructive" });
    }
  };

  const getOverridesByTier = (tier: string) => overrides.filter(o => o.tier === tier);

  // Get available staff (not already in any tier)
  const availableStaff = staffUsers.filter(s => !overrides.some(o => o.staff_uid === s.uid));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Ranking Override Manager
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Input ranking manual untuk ditampilkan di RankingCard. Jika ada data override, akan menggantikan ranking otomatis.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Month/Year Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((month, idx) => (
                <SelectItem key={idx} value={idx.toString()}>{month}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => navigateMonth('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          <div className="flex-1" />
          
          <Badge variant={overrides.length > 0 ? "default" : "secondary"}>
            {overrides.length > 0 ? `${overrides.length} Override Active` : 'No Override (Auto Mode)'}
          </Badge>
        </div>

        {/* Add New Entry Form */}
        <Card className="bg-muted/50">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Tier</Label>
                <Select value={selectedTier} onValueChange={(v) => setSelectedTier(v as typeof selectedTier)}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIERS.map((tier) => (
                      <SelectItem key={tier.id} value={tier.id}>
                        <span className={tier.color}>{tier.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1.5 flex-1 min-w-[200px]">
                <Label className="text-xs">Employee</Label>
                <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih employee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStaff.map((staff) => (
                      <SelectItem key={staff.uid} value={staff.uid}>
                        {staff.name} ({staff.uid})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-xs">Score Display</Label>
                <Input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={displayScore}
                  onChange={(e) => setDisplayScore(e.target.value)}
                  className="w-20"
                />
              </div>
              
              <Button onClick={addToTier} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Tambah
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tiers Display */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-4">
            {TIERS.map((tier) => {
              const tierOverrides = getOverridesByTier(tier.id);
              const TierIcon = tier.icon;
              
              return (
                <div key={tier.id} className={`rounded-lg p-4 ${tier.bgColor}`}>
                  <div className={`flex items-center gap-2 mb-3 ${tier.color}`}>
                    <TierIcon className="h-5 w-5" />
                    <span className="font-semibold">{tier.name}</span>
                    <span className="text-xs opacity-70">≥{tier.minScore}</span>
                    <Badge variant="outline" className="ml-auto">
                      {tierOverrides.length}/5
                    </Badge>
                  </div>
                  
                  {tierOverrides.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Belum ada data</p>
                  ) : (
                    <div className="space-y-2">
                      {tierOverrides.map((override) => (
                        <div
                          key={override.staff_uid}
                          className="flex items-center gap-3 bg-background/80 rounded-lg p-2"
                        >
                          <Avatar className="h-8 w-8 border border-border">
                            <AvatarImage src={override.photo_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {override.staff_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{override.staff_name}</p>
                            <p className="text-xs text-muted-foreground">{override.staff_uid}</p>
                          </div>
                          
                          <Input
                            type="number"
                            min="0"
                            max="5"
                            step="0.1"
                            value={override.display_score}
                            onChange={(e) => updateScore(override.staff_uid, e.target.value)}
                            className="w-16 h-8 text-center text-sm"
                          />
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeFromTier(override.staff_uid)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button onClick={saveOverrides} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Menyimpan...' : 'Simpan Ranking'}
          </Button>
          
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            Refresh
          </Button>
          
          {overrides.length > 0 && (
            <Button variant="destructive" onClick={clearAll}>
              <Trash2 className="h-4 w-4 mr-2" />
              Hapus Semua
            </Button>
          )}
        </div>
        
        <p className="text-xs text-muted-foreground">
          💡 Jika tidak ada data override untuk bulan tertentu, RankingCard akan menampilkan ranking otomatis dari daily_scores.
        </p>
      </CardContent>
    </Card>
  );
};

export default RankingOverrideManager;
