import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { Icon } from '@/components/icon';
import { reviewSwing } from '@/services/reviewService';
import type { SwingReview, SwingVideoInput } from '@/types';
import { Arc, Fonts } from '@/constants/theme';

export default function ReviewScreen() {
  const router = useRouter();
  const { id, videos: videosParam, userQuestion } = useLocalSearchParams<{ id: string; videos: string; userQuestion?: string }>();

  const [review, setReview] = useState<SwingReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);

  const videoInputs: SwingVideoInput[] = videosParam ? JSON.parse(videosParam) : [];

  useEffect(() => {
    if (!videoInputs.length) return;
    reviewSwing(videoInputs, userQuestion || undefined)
      .then(setReview)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  const totalSlides = 1 + (review?.phases.length ?? 0);
  const isFirst = slideIndex === 0;
  const isLast = !!review && slideIndex === totalSlides - 1;
  const phase = review && slideIndex > 0 ? review.phases[slideIndex - 1] : null;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topRow}>
          <BackButton />
        </View>

        <View style={styles.header}>
          <Text style={styles.kicker}>AI SWING REVIEW</Text>
          <Text style={styles.h1}>Analyse</Text>
        </View>

        <View style={styles.content}>
          {!review && !error && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={Arc.color.accent} size="small" />
              <Text style={styles.loadingText}>Analyserer svingen din…</Text>
            </View>
          )}

          {error && (
            <View style={styles.card}>
              <Text style={styles.cardKicker}>FEIL</Text>
              <Text style={styles.body}>{error}</Text>
            </View>
          )}

          {review && (
            <View style={styles.card}>
              <View style={styles.dots}>
                {Array.from({ length: totalSlides }).map((_, i) => (
                  <Pressable key={i} onPress={() => setSlideIndex(i)} hitSlop={6}>
                    <View style={[styles.dot, i === slideIndex && styles.dotActive]} />
                  </Pressable>
                ))}
              </View>

              {slideIndex === 0 ? (
                <>
                  <Text style={styles.cardKicker}>OPPSUMMERING</Text>
                  <Text style={styles.slideName}>Sammendrag</Text>
                  <Text style={styles.slideNote}>{review.summary}</Text>

                  {review.metrics.length > 0 && (
                    <View style={styles.metricsBlock}>
                      <Text style={styles.metricsTitle}>MÅLINGER</Text>
                      {review.metrics.map((m, i) => (
                        <View key={i} style={styles.metricRow}>
                          <View style={styles.metricHead}>
                            <Text style={styles.metricLabel}>{m.label}</Text>
                            <Text style={styles.metricValue}>{m.value}</Text>
                          </View>
                          <Text style={styles.metricDetail}>{m.detail}</Text>
                          <View style={[styles.confDot, m.confidence === 'high' ? styles.confHigh
                            : m.confidence === 'medium' ? styles.confMed : styles.confLow]} />
                        </View>
                      ))}
                    </View>
                  )}
                </>
              ) : phase ? (
                <>
                  <Text style={styles.cardKicker}>{slideIndex} / {review.phases.length}</Text>
                  <Text style={styles.slideName}>{phase.name}</Text>
                  <Text style={styles.slideNote}>{phase.note}</Text>
                </>
              ) : null}

              <View style={styles.navRow}>
                <Pressable
                  onPress={() => setSlideIndex((i) => Math.max(0, i - 1))}
                  disabled={isFirst}
                  style={[styles.navBtn, isFirst && styles.navBtnDisabled]}
                  hitSlop={8}>
                  <View style={styles.flip}>
                    <Icon name="chevron" size={16} color={isFirst ? Arc.color.ink3 : Arc.color.ink} stroke={2.2} />
                  </View>
                  <Text style={[styles.navBtnText, isFirst && styles.navBtnTextMuted]}>Forrige</Text>
                </Pressable>

                <View style={styles.spacer} />

                {!isLast ? (
                  <Pressable
                    onPress={() => setSlideIndex((i) => Math.min(totalSlides - 1, i + 1))}
                    style={[styles.navBtn, styles.navBtnPrimary]}
                    hitSlop={8}>
                    <Text style={styles.navBtnTextPrimary}>Neste</Text>
                    <Icon name="chevron" size={16} color="#fff" stroke={2.2} />
                  </Pressable>
                ) : (
                  <Pressable onPress={() => router.back()} style={[styles.navBtn, styles.navBtnPrimary]} hitSlop={8}>
                    <Text style={styles.navBtnTextPrimary}>Ferdig</Text>
                    <Icon name="check" size={16} color="#fff" stroke={2.2} />
                  </Pressable>
                )}
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Arc.color.appBg },
  safeArea: { flex: 1, paddingHorizontal: 22 },
  topRow: { paddingTop: 8 },
  header: { paddingTop: 12, paddingBottom: 28, gap: 6 },
  kicker: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    fontWeight: '500',
    color: Arc.color.accentD,
  },
  h1: { fontSize: 32, fontWeight: '800', letterSpacing: -0.6, color: Arc.color.ink },

  content: { flex: 1 },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 20,
  },
  loadingText: { fontSize: 14, color: Arc.color.ink2 },

  card: {
    backgroundColor: Arc.color.surface,
    borderRadius: Arc.radius.xl,
    padding: 20,
    gap: 8,
    ...Arc.shadow.sm,
  },
  cardKicker: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: Arc.color.ink3,
  },
  slideName: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, color: Arc.color.ink },
  slideNote: { fontSize: 15, color: Arc.color.ink2, lineHeight: 22 },
  body: { fontSize: 15, color: Arc.color.ink2, lineHeight: 22 },

  metricsBlock: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Arc.color.line,
    gap: 12,
  },
  metricsTitle: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: Arc.color.ink3,
  },
  metricRow: { paddingRight: 16 },
  metricHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  metricLabel: { fontSize: 15, fontWeight: '700', color: Arc.color.ink },
  metricValue: { fontFamily: Fonts.mono, fontSize: 14, fontWeight: '600', color: Arc.color.accentD },
  metricDetail: { fontSize: 13, color: Arc.color.ink2, lineHeight: 18, marginTop: 2 },
  confDot: { position: 'absolute', right: 0, top: 5, width: 8, height: 8, borderRadius: 4 },
  confHigh: { backgroundColor: '#3a9d6e' },
  confMed: { backgroundColor: '#d6a73a' },
  confLow: { backgroundColor: Arc.color.line2 },

  dots: { flexDirection: 'row', gap: 6, marginBottom: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Arc.color.line2 },
  dotActive: { width: 16, backgroundColor: Arc.color.accent },

  navRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  spacer: { flex: 1 },

  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Arc.radius.pill,
    backgroundColor: Arc.color.surface2,
    borderWidth: 1,
    borderColor: Arc.color.line,
  },
  navBtnPrimary: {
    backgroundColor: Arc.color.accent,
    borderColor: 'transparent',
    ...Arc.shadow.sm,
  },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { fontSize: 14, fontWeight: '600', color: Arc.color.ink },
  navBtnTextMuted: { color: Arc.color.ink3 },
  navBtnTextPrimary: { fontSize: 14, fontWeight: '700', color: '#fff' },

  flip: { transform: [{ rotate: '180deg' }] },
});
