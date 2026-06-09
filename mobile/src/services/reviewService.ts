// Det eneste stedet i appen som snakker med backenden.
// Backenden (FastAPI) er den som faktisk kaller Gemini.

import type { SwingReview, SwingVideo } from '@/types';

// iOS-simulator kan bruke localhost. På fysisk telefon: sett EXPO_PUBLIC_API_URL
// til maskinens LAN-IP, f.eks. http://192.168.1.42:8000 (se .env.example).
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function reviewSwing(video: SwingVideo): Promise<SwingReview> {
  const form = new FormData();
  // React Native godtar { uri, name, type } som fil i FormData.
  form.append('video', {
    uri: video.uri,
    name: 'swing.mp4',
    type: 'video/mp4',
  } as unknown as Blob);

  const res = await fetch(`${API_URL}/reviews`, { method: 'POST', body: form });
  if (!res.ok) {
    throw new Error(`Backend svarte ${res.status}`);
  }
  const data = await res.json();
  return {
    id: `review-${Date.now()}`,
    videoId: video.id,
    summary: data.summary,
    feedback: data.feedback,
    createdAt: data.created_at,
  };
}
