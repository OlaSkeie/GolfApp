import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile } from '@/types';

const KEY = 'user_profile';

export const DEFAULT_PROFILE: UserProfile = {
  handicap: '',
  playsPerWeek: 'weekly',
  practicesPerWeek: '1-2/month',
};

export async function loadProfile(): Promise<UserProfile> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return DEFAULT_PROFILE;
  return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(profile));
}
