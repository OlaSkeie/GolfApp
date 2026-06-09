import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { reviewSwing } from '@/services/reviewService';
import type { SwingReview } from '@/types';
import { Spacing } from '@/constants/theme';

export default function ReviewScreen() {
  const { id, uri } = useLocalSearchParams<{ id: string; uri: string }>();
  const [review, setReview] = useState<SwingReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reviewSwing({ id, uri, createdAt: new Date().toISOString() })
      .then(setReview)
      .catch((e) => setError(e.message));
  }, [id, uri]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="subtitle">AI-tilbakemelding</ThemedText>

          {!review && !error && <ActivityIndicator style={styles.spinner} />}
          {error && <ThemedText themeColor="textSecondary">Feil: {error}</ThemedText>}

          {review && (
            <>
              <ThemedText type="default">{review.summary}</ThemedText>
              <ThemedText themeColor="textSecondary">{review.feedback}</ThemedText>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  spinner: { marginTop: Spacing.four },
});
