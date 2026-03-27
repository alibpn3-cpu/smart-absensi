import { supabase } from '@/integrations/supabase/client';

const SITE_MAP: Record<string, string> = {
  'BRANCH OFFICE': 'BPN',
  'HEAD OFFICE': 'HO',
  'SITE HANDIL': 'HDL',
  'SITE MUARA BADAK': 'MDB',
  'SITE MUTIARA': 'MTR',
  'SITE CCIP': 'CCIP',
  'CIKARANG': 'CCIP',
  'SITE TANJUNG': 'TJG',
};

const DIVISION_MAP: Record<string, string> = {
  'HC&GA': 'HCM',
  'HCGA': 'HCM',
  'HC & GA': 'HCM',
  'INFORMATION & TECHNOLOGY': 'IT',
  'INFORMATION': 'IT',
  'IT': 'IT',
  'BD&SALES': 'BDS',
  'BD & SALES': 'BDS',
  'OPERATIONS': 'OPS',
  'OPS': 'OPS',
  'HSE': 'HSE',
  'HUMAN SAFETY': 'HSE',
  'SMO': 'SMO',
  'STRATEGIC': 'SMO',
  'PROCUREMENT': 'PRC',
  'PRC': 'PRC',
  'FINANCE': 'FAT',
  'FAT': 'FAT',
  'L&C': 'L&C',
  'LEARNING': 'L&C',
};

const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export const getSiteCode = (workArea: string): string => {
  const upper = (workArea || '').toUpperCase().trim();
  for (const [key, val] of Object.entries(SITE_MAP)) {
    if (upper.includes(key)) return val;
  }
  return upper.substring(0, 3) || 'XXX';
};

export const getDivisionCode = (division: string): string => {
  const upper = (division || '').toUpperCase().trim();
  for (const [key, val] of Object.entries(DIVISION_MAP)) {
    if (upper.includes(key)) return val;
  }
  return upper.substring(0, 3) || 'GEN';
};

export const generateLeaveRequestNumber = async (workArea: string, division: string): Promise<string> => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const romanMonth = ROMAN_MONTHS[month - 1];
  const siteCode = getSiteCode(workArea);
  const divCode = getDivisionCode(division);

  const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`;
  const endOfMonth = month === 12
    ? `${year + 1}-01-01T00:00:00`
    : `${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00`;

  const { count } = await supabase
    .from('leave_requests')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfMonth)
    .lt('created_at', endOfMonth);

  const seq = String((count || 0) + 1).padStart(3, '0');
  return `${seq}/PI-${siteCode}/${divCode}/L/${romanMonth}/${year}`;
};

export const generatePermissionRequestNumber = async (workArea: string, division: string): Promise<string> => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const romanMonth = ROMAN_MONTHS[month - 1];
  const siteCode = getSiteCode(workArea);
  const divCode = getDivisionCode(division);

  const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`;
  const endOfMonth = month === 12
    ? `${year + 1}-01-01T00:00:00`
    : `${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00`;

  const { count } = await supabase
    .from('permission_requests')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfMonth)
    .lt('created_at', endOfMonth);

  const seq = String((count || 0) + 1).padStart(3, '0');
  return `${seq}/PI-${siteCode}/${divCode}/I/${romanMonth}/${year}`;
};
