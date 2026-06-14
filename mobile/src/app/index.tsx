import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { Arc, Fonts } from '@/constants/theme';
import { useEffect, useState } from 'react';
import { loadProfile } from '@/services/profileService';

type Feature = {
  title: string;
  caption: string;
  icon: IconName;
  route: { pathname: string; params?: Record<string, string> };
};

const FEATURES: Feature[] = [
  { title: 'AI Swing Review', caption: 'AI-analyse', icon: 'swing', route: { pathname: '/record' } },
  { title: 'Guess My Handicap', caption: 'Estimat', icon: 'handicap', route: feature('Guess My Handicap') },
  { title: 'Tempo Analysis', caption: 'Rytme', icon: 'tempo', route: feature('Tempo Analysis') },
  { title: 'Own Analysis', caption: 'Manuelt', icon: 'analysis', route: { pathname: '/analyze' } },
  { title: 'Shot Trace', caption: 'Ballbane', icon: 'shottrace', route: { pathname: '/shot-trace' } },
  { title: 'Club Trace', caption: 'Køllebane', icon: 'clubtrace', route: feature('Club Trace') },
];

function feature(title: string) {
  const slug = title.toLowerCase().replace(/\s+/g, '-');
  return { pathname: '/feature/[slug]', params: { slug, title } };
}

export default function HomeScreen() {
  const router = useRouter();
  const [handicap, setHandicap] = useState<string>('');

  useEffect(() => {
    loadProfile().then((p) => setHandicap(p.handicap));
  }, []);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.kicker}>GOLF ANALYSIS</Text>
            <Pressable
              onPress={() => router.push('/profile')}
              style={({ pressed }) => [styles.profileBtn, pressed && styles.pressed]}>
              <Icon name="profile" size={20} color={Arc.color.ink2} stroke={1.8} />
              {handicap ? <Text style={styles.hcpText}>HCP {handicap}</Text> : null}
            </Pressable>
          </View>

          <View style={styles.grid}>
            {FEATURES.map((f) => (
              <Pressable
                key={f.title}
                onPress={() => router.push(f.route as never)}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                <View style={styles.iconChip}>
                  <Icon name={f.icon} size={24} color={Arc.color.accent} stroke={1.8} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>{f.title}</Text>
                  <Text style={styles.cardCaption}>{f.caption.toUpperCase()}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Arc.color.appBg },
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 22, paddingBottom: 32 },
  header: {
    paddingTop: 16,
    paddingBottom: 24,
    gap: 6,
    position: 'relative',
  },
  kicker: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    fontWeight: '500',
    color: Arc.color.accentD,
  },
  profileBtn: {
    position: 'absolute',
    right: 0,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Arc.radius.pill,
    backgroundColor: Arc.color.surface,
    borderWidth: 1,
    borderColor: Arc.color.line,
    ...Arc.shadow.sm,
  },
  hcpText: { fontFamily: Fonts.mono, fontSize: 12, fontWeight: '600', color: Arc.color.ink2 },
  h1: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: Arc.color.ink,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  card: {
    width: '48%',
    aspectRatio: 0.98,
    backgroundColor: Arc.color.surface,
    borderRadius: Arc.radius.lg,
    padding: 18,
    justifyContent: 'space-between',
    ...Arc.shadow.sm,
  },
  pressed: { opacity: 0.7 },
  iconChip: {
    width: 46,
    height: 46,
    borderRadius: Arc.radius.sm,
    backgroundColor: Arc.color.accentWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: Arc.color.ink,
  },
  cardCaption: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: Arc.color.ink3,
    marginTop: 3,
  },
});
