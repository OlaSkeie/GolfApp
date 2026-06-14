import type { PoseLines } from '@/types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function fetchPoseLines(uri: string, handedness = 'right'): Promise<PoseLines> {
  const form = new FormData();
  const isMov = uri.toLowerCase().endsWith('.mov');
  const type = isMov ? 'video/quicktime' : 'video/mp4';
  form.append('video', { uri, name: isMov ? 'swing.mov' : 'swing.mp4', type } as unknown as Blob);
  form.append('handedness', handedness);

  const res = await fetch(`${API_URL}/pose-lines`, { method: 'POST', body: form });
  if (res.status === 422) throw new Error('Fant ingen address-stilling i videoen');
  if (!res.ok) throw new Error(`Backend svarte ${res.status}`);
  return res.json();
}
