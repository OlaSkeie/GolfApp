import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { Arc, Fonts } from '@/constants/theme';

export default function FeatureScreen() {
  const { title } = useLocalSearchParams<{ title: string }>();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <BackButton />

        <View style={styles.header}>
          <Text style={styles.kicker}>GOLF IQ</Text>
          <Text style={styles.h1}>{title ?? 'Funksjon'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardKicker}>STATUS</Text>
          <Text style={styles.body}>Kommer snart.</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Arc.color.appBg },
  safeArea: { flex: 1, paddingHorizontal: 22 },
  header: { paddingTop: 12, paddingBottom: 24, gap: 6 },
  kicker: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    fontWeight: '500',
    color: Arc.color.accentD,
  },
  h1: { fontSize: 32, fontWeight: '800', letterSpacing: -0.6, color: Arc.color.ink },
  card: {
    backgroundColor: Arc.color.surface,
    borderRadius: Arc.radius.lg,
    padding: 18,
    ...Arc.shadow.sm,
  },
  cardKicker: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: Arc.color.ink3,
    marginBottom: 8,
  },
  body: { fontSize: 15, color: Arc.color.ink2, lineHeight: 22 },
});
