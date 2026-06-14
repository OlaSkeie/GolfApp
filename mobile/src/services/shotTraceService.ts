import type { ShotTraceResult } from '@/types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function analyzeShotTrace(
  uri: string,
  teeXPct: number,
  teeYPct: number,
  impactTimeSec: number,
): Promise<ShotTraceResult> {
  const isMov = uri.toLowerCase().endsWith('.mov');
  const type = isMov ? 'video/quicktime' : 'video/mp4';
  const name = isMov ? 'shot.mov' : 'shot.mp4';

  const form = new FormData();
  form.append('video', { uri, name, type } as unknown as Blob);
  form.append('tee_x_pct', String(teeXPct));
  form.append('tee_y_pct', String(teeYPct));
  form.append('impact_time_sec', String(impactTimeSec));

  const res = await fetch(`${API_URL}/shot-trace`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Backend svarte ${res.status}`);
  return res.json();
}
