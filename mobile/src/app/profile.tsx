import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { Arc, Fonts } from '@/constants/theme';
import { DEFAULT_PROFILE, loadProfile, saveProfile } from '@/services/profileService';
import type { PlayFrequency, UserProfile } from '@/types';

const PLAY_OPTIONS: { value: PlayFrequency; label: string }[] = [
  { value: 'rarely', label: 'Sjelden' },
  { value: '1-2/month', label: '1-2/mnd' },
  { value: 'weekly', label: 'Ukentlig' },
  { value: '2-3/week', label: '2-3/uke' },
  { value: 'daily', label: 'Daglig' },
];

function SegmentPicker({
  value,
  options,
  onChange,
}: {
  value: PlayFrequency;
  options: typeof PLAY_OPTIONS;
  onChange: (v: PlayFrequency) => void;
}) {
  return (
    <View style={seg.row}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          style={[seg.btn, value === o.value && seg.btnOn]}>
          <Text style={[seg.label, value === o.value && seg.labelOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const seg = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Arc.radius.xs,
    backgroundColor: Arc.color.surface2,
    borderWidth: 1,
    borderColor: Arc.color.line2,
  },
  btnOn: { backgroundColor: Arc.color.accentWash, borderColor: Arc.color.accent },
  label: { fontSize: 13, fontWeight: '600', color: Arc.color.ink2 },
  labelOn: { color: Arc.color.accentD },
});

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadProfile().then(setProfile);
  }, []);

  function set<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
    setSaved(false);
  }

  async function save() {
    await saveProfile(profile);
    setSaved(true);
    setTimeout(() => router.back(), 600);
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <BackButton />

            <View style={styles.header}>
              <Text style={styles.kicker}>PROFIL</Text>
              <Text style={styles.h1}>Din profil</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>HANDICAP</Text>
              <TextInput
                style={styles.input}
                placeholder="F.eks. 12.4"
                placeholderTextColor={Arc.color.ink3}
                value={profile.handicap}
                onChangeText={(v) => set('handicap', v)}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
              <Text style={styles.hint}>La stå tom hvis ukjent</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>SPILLER GOLF</Text>
              <SegmentPicker
                value={profile.playsPerWeek}
                options={PLAY_OPTIONS}
                onChange={(v) => set('playsPerWeek', v)}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>TRENER GOLF</Text>
              <SegmentPicker
                value={profile.practicesPerWeek}
                options={PLAY_OPTIONS}
                onChange={(v) => set('practicesPerWeek', v)}
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={save}
              style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}>
              <Text style={styles.saveBtnText}>{saved ? 'Lagret ✓' : 'Lagre profil'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Arc.color.appBg },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: 22, paddingBottom: 16 },
  header: { paddingTop: 12, paddingBottom: 28, gap: 6 },
  kicker: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    fontWeight: '500',
    color: Arc.color.accentD,
  },
  h1: { fontSize: 32, fontWeight: '800', letterSpacing: -0.6, color: Arc.color.ink },
  section: { marginBottom: 28, gap: 10 },
  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: Arc.color.ink3,
    marginBottom: 2,
  },
  input: {
    backgroundColor: Arc.color.surface,
    borderRadius: Arc.radius.lg,
    borderWidth: 1,
    borderColor: Arc.color.line2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Arc.color.ink,
    ...Arc.shadow.sm,
  },
  hint: { fontSize: 12, color: Arc.color.ink3 },
  footer: { paddingHorizontal: 22, paddingBottom: 8, paddingTop: 8 },
  saveBtn: {
    height: 54,
    borderRadius: Arc.radius.pill,
    backgroundColor: Arc.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...Arc.shadow.md,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  pressed: { opacity: 0.7 },
});
