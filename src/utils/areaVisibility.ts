import { supabase } from '@/integrations/supabase/client';

/**
 * Shared helper: site admin can hide certain cards (birthday / ads / ranking)
 * for a specific work area or division. The disabled list is stored in
 * app_settings as a JSON array of strings, matched against the logged-in
 * user's work_area OR division (case-insensitive).
 */
export const VISIBILITY_KEYS = {
  birthday: 'birthday_disabled_areas',
  ads: 'ads_disabled_areas',
  ranking: 'ranking_disabled_areas',
} as const;

export type VisibilityFeature = keyof typeof VISIBILITY_KEYS;

const norm = (v?: string | null) => (v || '').trim().toUpperCase();

export const getDisabledAreas = async (feature: VisibilityFeature): Promise<string[]> => {
  const { data } = await supabase
    .from('app_settings')
    .select('setting_value')
    .eq('setting_key', VISIBILITY_KEYS[feature])
    .maybeSingle();
  try {
    const arr = data?.setting_value ? JSON.parse(data.setting_value) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

export const setAreaDisabled = async (
  feature: VisibilityFeature,
  area: string,
  disabled: boolean
): Promise<void> => {
  const key = VISIBILITY_KEYS[feature];
  const { data: setting } = await supabase
    .from('app_settings')
    .select('setting_value')
    .eq('setting_key', key)
    .maybeSingle();
  let arr: string[] = [];
  try { arr = setting?.setting_value ? JSON.parse(setting.setting_value) : []; } catch {}
  const next = disabled
    ? Array.from(new Set([...arr, area]))
    : arr.filter((a) => norm(a) !== norm(area));
  if (setting) {
    await supabase.from('app_settings').update({ setting_value: JSON.stringify(next) }).eq('setting_key', key);
  } else {
    await supabase.from('app_settings').insert({ setting_key: key, setting_value: JSON.stringify(next) });
  }
};

/** True when the card must be hidden for the currently logged-in user. */
export const isHiddenForCurrentUser = async (feature: VisibilityFeature): Promise<boolean> => {
  try {
    const raw = localStorage.getItem('userSession');
    if (!raw) return false;
    const s = JSON.parse(raw) || {};
    const area = norm(s.work_area);
    const division = norm(s.division);
    if (!area && !division) return false;
    const list = (await getDisabledAreas(feature)).map(norm);
    if (list.length === 0) return false;
    return list.some((entry) => entry === area || entry === division);
  } catch {
    return false;
  }
};
