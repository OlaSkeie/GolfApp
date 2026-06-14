import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { Icon } from '@/components/icon';
import { Arc, Fonts } from '@/constants/theme';
import type { CameraAngle, Handedness } from '@/types';

type VideoItem = {
  id: string;
  uri: string;
  name: string;
  angle: CameraAngle;
  handedness: Handedness;
  included: boolean;
};

async function pickVideo(): Promise<{ uri: string; name: string } | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, name: asset.fileName ?? 'video.mp4' };
}

export default function RecordScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [userQuestion, setUserQuestion] = useState('');

  const selected = videos.filter((v) => v.included);

  async function addVideo() {
    const v = await pickVideo();
    if (!v) return;
    setVideos((prev) => [
      ...prev,
      { id: String(Date.now()), uri: v.uri, name: v.name, angle: 'dtl', handedness: 'right', included: true },
    ]);
  }

  function toggleIncluded(id: string) {
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, included: !v.included } : v)));
  }

  function setAngle(id: string, angle: CameraAngle) {
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, angle } : v)));
  }

  function setHandedness(id: string, handedness: Handedness) {
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, handedness } : v)));
  }

  function removeVideo(id: string) {
    setVideos((prev) => prev.filter((v) => v.id !== id));
  }

  function analyze() {
    if (!selected.length) return;
    router.push({
      pathname: '/review/[id]',
      params: {
        id: String(Date.now()),
        videos: JSON.stringify(selected.map((v) => ({ uri: v.uri, name: v.name, angle: v.angle, handedness: v.handedness }))),
        userQuestion: userQuestion.trim(),
      },
    });
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <BackButton />

          <View style={styles.header}>
            <Text style={styles.kicker}>AI SWING REVIEW</Text>
            <Text style={styles.h1}>Ny analyse</Text>
          </View>

          {/* Video list */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>VIDEOER</Text>
            {videos.map((v) => (
              <View key={v.id} style={styles.videoCard}>
                <Pressable onPress={() => toggleIncluded(v.id)} style={styles.checkWrap} hitSlop={8}>
                  <View style={[styles.checkBox, v.included && styles.checkBoxOn]}>
                    {v.included && <Icon name="check" size={12} color="#fff" stroke={2.5} />}
                  </View>
                </Pressable>
                <View style={styles.videoInfo}>
                  <Text style={styles.videoName} numberOfLines={1}>{v.name}</Text>
                  <View style={styles.angleRow}>
                    <Pressable
                      onPress={() => setAngle(v.id, 'dtl')}
                      style={[styles.angleBtn, v.angle === 'dtl' && styles.angleBtnOn]}>
                      <Text style={[styles.angleBtnText, v.angle === 'dtl' && styles.angleBtnTextOn]}>
                        Down the line
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setAngle(v.id, 'face_on')}
                      style={[styles.angleBtn, v.angle === 'face_on' && styles.angleBtnOn]}>
                      <Text style={[styles.angleBtnText, v.angle === 'face_on' && styles.angleBtnTextOn]}>
                        Rett på
                      </Text>
                    </Pressable>
                  </View>
                  <View style={styles.angleRow}>
                    <Pressable
                      onPress={() => setHandedness(v.id, 'right')}
                      style={[styles.angleBtn, v.handedness === 'right' && styles.angleBtnOn]}>
                      <Text style={[styles.angleBtnText, v.handedness === 'right' && styles.angleBtnTextOn]}>
                        Høyrehent
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setHandedness(v.id, 'left')}
                      style={[styles.angleBtn, v.handedness === 'left' && styles.angleBtnOn]}>
                      <Text style={[styles.angleBtnText, v.handedness === 'left' && styles.angleBtnTextOn]}>
                        Venstrehent
                      </Text>
                    </Pressable>
                  </View>
                </View>
                <Pressable onPress={() => removeVideo(v.id)} hitSlop={8}>
                  <Text style={styles.removeText}>×</Text>
                </Pressable>
              </View>
            ))}

            <Pressable onPress={addVideo} style={styles.addBtn}>
              <Icon name="camera" size={18} color={Arc.color.accent} stroke={1.8} />
              <Text style={styles.addBtnText}>Legg til video</Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <Text style={styles.sectionLabel}>SPØRSMÅL (valgfritt)</Text>
              <Text style={styles.charCount}>{userQuestion.length}/500</Text>
            </View>
            <TextInput
              style={styles.questionInput}
              placeholder='F.eks. "Bommer mye til høyre, hvorfor?"'
              placeholderTextColor={Arc.color.ink3}
              value={userQuestion}
              onChangeText={setUserQuestion}
              multiline
              maxLength={500}
              returnKeyType="done"
              blurOnSubmit
              onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)}
            />
          </View>

        </ScrollView>
        </KeyboardAvoidingView>

        <View style={styles.footer}>
          <Pressable
            onPress={analyze}
            disabled={!selected.length}
            style={({ pressed }) => [
              styles.primaryBtn,
              !selected.length && styles.primaryBtnDisabled,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.primaryBtnText}>Analyser sving</Text>
            <Icon name="chevron" size={18} color="#fff" stroke={2.4} />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Arc.color.appBg },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 22, paddingBottom: 16 },
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
  sectionLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  charCount: { fontFamily: Fonts.mono, fontSize: 10, color: Arc.color.ink3 },
  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: Arc.color.ink3,
    marginBottom: 2,
  },

  videoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Arc.color.surface,
    borderRadius: Arc.radius.lg,
    padding: 14,
    ...Arc.shadow.sm,
  },
  checkWrap: { justifyContent: 'center' },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Arc.color.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: { backgroundColor: Arc.color.accent, borderColor: Arc.color.accent },
  videoInfo: { flex: 1, gap: 6 },
  videoName: { fontSize: 14, fontWeight: '600', color: Arc.color.ink },
  angleRow: { flexDirection: 'row', gap: 6 },
  angleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Arc.radius.xs,
    backgroundColor: Arc.color.surface2,
    borderWidth: 1,
    borderColor: Arc.color.line2,
  },
  angleBtnOn: { backgroundColor: Arc.color.accentWash, borderColor: Arc.color.accent },
  angleBtnText: { fontSize: 12, fontWeight: '600', color: Arc.color.ink2 },
  angleBtnTextOn: { color: Arc.color.accentD },
  removeText: { fontSize: 22, color: Arc.color.ink3, lineHeight: 24 },

  questionInput: {
    backgroundColor: Arc.color.surface,
    borderRadius: Arc.radius.lg,
    borderWidth: 1,
    borderColor: Arc.color.line2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Arc.color.ink,
    minHeight: 72,
    textAlignVertical: 'top',
    ...Arc.shadow.sm,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: Arc.radius.lg,
    borderWidth: 1.5,
    borderColor: Arc.color.line2,
    borderStyle: 'dashed',
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: Arc.color.surface2,
  },
  addBtnText: { fontSize: 15, fontWeight: '600', color: Arc.color.ink2 },

  footer: { paddingHorizontal: 22, paddingBottom: 8, paddingTop: 8 },
  primaryBtn: {
    flexDirection: 'row',
    height: 54,
    borderRadius: Arc.radius.pill,
    backgroundColor: Arc.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...Arc.shadow.md,
  },
  primaryBtnDisabled: { backgroundColor: Arc.color.ink3, shadowOpacity: 0 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  pressed: { opacity: 0.7 },
});
