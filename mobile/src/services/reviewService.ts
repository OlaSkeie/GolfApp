import type { SwingReview, SwingVideoInput } from '@/types';
import { loadProfile } from './profileService';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function reviewSwing(videos: SwingVideoInput[], userQuestion?: string): Promise<SwingReview> {
  const form = new FormData();
  const profile = await loadProfile();

  videos.forEach((v) => {
    const isMov = v.uri.toLowerCase().endsWith('.mov');
    const type = isMov ? 'video/quicktime' : 'video/mp4';
    form.append('videos', { uri: v.uri, name: v.name, type } as unknown as Blob);
  });

  form.append('metadata', JSON.stringify(videos.map((v) => ({ angle: v.angle, handedness: v.handedness }))));
  if (userQuestion?.trim()) form.append('user_question', userQuestion.trim());
  form.append('profile', JSON.stringify(profile));

  const res = await fetch(`${API_URL}/reviews`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Backend svarte ${res.status}`);

  const data = await res.json();
  return {
    id: `review-${Date.now()}`,
    summary: data.summary,
    phases: data.phases ?? [],
    metrics: data.metrics ?? [],
    createdAt: data.created_at,
  };
}
