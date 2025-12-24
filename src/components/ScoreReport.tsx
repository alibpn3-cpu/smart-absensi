import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Star, Filter, TrendingUp, Users, ChevronLeft, ChevronRight, Trophy, Medal, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import ScoreExporter from './ScoreExporter';

interface ScoreRecord {
  id: string;
  staff_uid: string;
  staff_name: string;
  score_date: string;
  clock_in_score: number;
  clock_out_score: number;
  p2h_score: number;
  toolbox_score: number;
  final_score: number;
  employee_type: string;
  work_area: string;
  is_late: boolean;
}

interface ScoreSummary {
  totalRecords: number;
  avgScore: number;
  lateCount: number;
  perfectCount: number;
}

interface MonthlyRanking {
  staff_uid: string;
  staff_name: string;
  avg_score: number;
  tier: 'platinum' | 'gold' | 'silver' | 'bronze' | 'none';
}

const ScoreReport = () => {
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [filteredScores, setFilteredScores] = useState<ScoreRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ScoreSummary>({
    totalRecords: 0,
    avgScore: 0,
    lateCount: 0,
    perfectCount: 0
  });
  const [monthlyRankings, setMonthlyRankings] = useState<MonthlyRanking[]>([]);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [filterName, setFilterName] = useState('');
  const [filterWorkArea, setFilterWorkArea] = useState('all');
  const [filterEmployeeType, setFilterEmployeeType] = useState('all');
  const [workAreas, setWorkAreas] = useState<string[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    fetchScores();
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    applyFilters();
  }, [scores, filterName, filterWorkArea, filterEmployeeType]);

  const fetchScores = async () => {
    setLoading(true);
    try {
      const firstDay = new Date(selectedYear, selectedMonth, 1);
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
      const firstDayStr = firstDay.toISOString().split('T')[0];
      const lastDayStr = lastDay.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('daily_scores')
        .select('*')
        .gte('score_date', firstDayStr)
        .lte('score_date', lastDayStr)
        .order('score_date', { ascending: false });

      if (error) throw error;

      setScores(data || []);
      
      // Extract work areas
      const areas = [...new Set(data?.map(s => s.work_area).filter(Boolean))].sort();
      setWorkAreas(areas as string[]);

      // Calculate summary
      if (data && data.length > 0) {
        const avgScore = data.reduce((acc, s) => acc + Number(s.final_score), 0) / data.length;
        const lateCount = data.filter(s => s.is_late).length;
        const perfectCount = data.filter(s => Number(s.final_score) === 5).length;
        
        setSummary({
          totalRecords: data.length,
          avgScore: Math.round(avgScore * 100) / 100,
          lateCount,
          perfectCount
        });
      } else {
        setSummary({ totalRecords: 0, avgScore: 0, lateCount: 0, perfectCount: 0 });
      }

      // Calculate monthly rankings
      calculateRankings(data || []);
    } catch (error) {
      console.error('Error fetching scores:', error);
      toast({
        title: "Gagal",
        description: "Gagal memuat data score",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateRankings = (data: ScoreRecord[]) => {
    const userScores = new Map<string, { name: string; scores: number[] }>();
    
    data.forEach(score => {
      if (!userScores.has(score.staff_uid)) {
        userScores.set(score.staff_uid, { name: score.staff_name, scores: [] });
      }
      userScores.get(score.staff_uid)!.scores.push(Number(score.final_score));
    });

    const rankings: MonthlyRanking[] = [];
    for (const [uid, userData] of userScores) {
      const avg = userData.scores.reduce((a, b) => a + b, 0) / userData.scores.length;
      const avgRounded = Math.round(avg * 10) / 10;
      
      let tier: MonthlyRanking['tier'] = 'none';
      if (avgRounded >= 4.5) tier = 'platinum';
      else if (avgRounded >= 4.0) tier = 'gold';
      else if (avgRounded >= 3.5) tier = 'silver';
      else if (avgRounded >= 3.0) tier = 'bronze';
      
      rankings.push({
        staff_uid: uid,
        staff_name: userData.name,
        avg_score: avgRounded,
        tier
      });
    }

    rankings.sort((a, b) => b.avg_score - a.avg_score);
    setMonthlyRankings(rankings.slice(0, 10));
  };

  const applyFilters = () => {
    let filtered = [...scores];

    if (filterName.trim()) {
      const search = filterName.toLowerCase();
      filtered = filtered.filter(s => 
        s.staff_name.toLowerCase().includes(search) ||
        s.staff_uid.toLowerCase().includes(search)
      );
    }

    if (filterWorkArea !== 'all') {
      filtered = filtered.filter(s => s.work_area === filterWorkArea);
    }

    if (filterEmployeeType !== 'all') {
      filtered = filtered.filter(s => s.employee_type === filterEmployeeType);
    }

    setFilteredScores(filtered);
    setCurrentPage(1);
  };

  const getTierBadge = (tier: MonthlyRanking['tier']) => {
    const config = {
      platinum: { icon: Trophy, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
      gold: { icon: Medal, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
      silver: { icon: Award, color: 'bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-400' },
      bronze: { icon: Star, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
      none: { icon: Star, color: 'bg-muted text-muted-foreground' }
    };
    
    const { icon: Icon, color } = config[tier];
    return (
      <Badge variant="outline" className={`${color} border-0 capitalize`}>
        <Icon className="h-3 w-3 mr-1" />
        {tier === 'none' ? 'No Tier' : tier}
      </Badge>
    );
  };

  const renderStars = (score: number) => {
    const fullStars = Math.floor(score);
    const hasHalf = score % 1 >= 0.5;
    
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={`h-3.5 w-3.5 ${
              i < fullStars 
                ? 'fill-yellow-400 text-yellow-400' 
                : i === fullStars && hasHalf
                  ? 'fill-yellow-400/50 text-yellow-400'
                  : 'text-muted-foreground'
            }`}
          />
        ))}
        <span className="ml-1 text-sm font-medium">{score}</span>
      </div>
    );
  };

  // Pagination
  const totalPages = Math.ceil(filteredScores.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedScores = filteredScores.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Total Records</p>
                <p className="text-xl font-bold">{summary.totalRecords}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">Rata-rata Score</p>
                <p className="text-xl font-bold">{summary.avgScore}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-cyan-500" />
              <div>
                <p className="text-xs text-muted-foreground">Perfect Score (5)</p>
                <p className="text-xl font-bold">{summary.perfectCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-xs text-muted-foreground">Terlambat</p>
                <p className="text-xl font-bold">{summary.lateCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Rankings Preview */}
      {monthlyRankings.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Top 10 Ranking {months[selectedMonth]} {selectedYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {monthlyRankings.map((user, idx) => (
                <div key={user.staff_uid} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
                  <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                  <span className="text-sm font-medium">{user.staff_name.split(' ')[0]}</span>
                  {getTierBadge(user.tier)}
                  <span className="text-xs text-muted-foreground">{user.avg_score}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Filter className="h-5 w-5" />
            Filter Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Month */}
            <div className="space-y-2">
              <Label>Bulan</Label>
              <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month, idx) => (
                    <SelectItem key={idx} value={idx.toString()}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Year */}
            <div className="space-y-2">
              <Label>Tahun</Label>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Name Search */}
            <div className="space-y-2">
              <Label>Cari Nama/UID</Label>
              <Input
                placeholder="Ketik nama..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                className="bg-background border-border"
              />
            </div>

            {/* Work Area */}
            <div className="space-y-2">
              <Label>Area Kerja</Label>
              <Select value={filterWorkArea} onValueChange={setFilterWorkArea}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Area</SelectItem>
                  {workAreas.map(area => (
                    <SelectItem key={area} value={area}>{area}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Employee Type */}
            <div className="space-y-2">
              <Label>Tipe Karyawan</Label>
              <Select value={filterEmployeeType} onValueChange={setFilterEmployeeType}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tipe</SelectItem>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reset */}
            <div className="space-y-2 flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setFilterName('');
                  setFilterWorkArea('all');
                  setFilterEmployeeType('all');
                }}
              >
                Reset Filter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Score Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Star className="h-5 w-5" />
            Data Score ({filteredScores.length} records)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : paginatedScores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Tidak ada data score</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">No</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead className="text-center">In</TableHead>
                      <TableHead className="text-center">Out</TableHead>
                      <TableHead className="text-center">P2H</TableHead>
                      <TableHead className="text-center">TBM</TableHead>
                      <TableHead>Final Score</TableHead>
                      <TableHead className="text-center">Telat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedScores.map((score, idx) => (
                      <TableRow key={score.id}>
                        <TableCell className="text-muted-foreground">{startIndex + idx + 1}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{score.staff_name}</p>
                            <p className="text-xs text-muted-foreground">{score.staff_uid}</p>
                          </div>
                        </TableCell>
                        <TableCell>{new Date(score.score_date).toLocaleDateString('id-ID')}</TableCell>
                        <TableCell>
                          <Badge variant={score.employee_type === 'primary' ? 'default' : 'secondary'}>
                            {score.employee_type === 'primary' ? 'Primary' : 'Staff'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{score.clock_in_score}</TableCell>
                        <TableCell className="text-center">{score.clock_out_score}</TableCell>
                        <TableCell className="text-center">{score.p2h_score}</TableCell>
                        <TableCell className="text-center">{score.toolbox_score}</TableCell>
                        <TableCell>{renderStars(Number(score.final_score))}</TableCell>
                        <TableCell className="text-center">
                          {score.is_late ? (
                            <Badge variant="destructive">Ya</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">Tidak</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Halaman {currentPage} dari {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Export Section */}
      <ScoreExporter />
    </div>
  );
};

export default ScoreReport;