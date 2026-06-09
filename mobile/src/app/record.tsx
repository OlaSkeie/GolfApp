import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function RecordScreen() {
  const router = useRouter();

  // TODO (senere steg): erstatt med ekte opptak/valg via expo-camera /
  // expo-image-picker. For nå sender vi en placeholder-video videre.
  function onPickSwing() {
    const uri = 'placeholder://swing.mp4';
    router.push({ pathname: '/review/[id]', params: { id: 'demo', uri } });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">Ta opp swing</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.text}>
          Opptak/valg av video kommer i et senere steg.
        </ThemedText>

        <Pressable
          onPress={onPickSwing}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
          <ThemedText type="link">Send til AI (placeholder) →</ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  text: { textAlign: 'center' },
  cta: {
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    borderWidth: 1,
    borderColor: '#888',
  },
  pressed: { opacity: 0.6 },
});
