import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import * as ScreenOrientation from 'expo-screen-orientation';

import { Arc, Fonts } from '@/constants/theme';
import { BackButton } from '@/components/back-button';
import { Icon } from '@/components/icon';
import { DrawingCanvas, type DrawShape, type DrawTool } from '@/components/drawing-canvas';
import { PoseLinesOverlay } from '@/components/pose-lines-overlay';
import { fetchPoseLines } from '@/services/poseLinesService';
import type { PoseLines } from '@/types';

const SPEEDS = [0.25, 0.5, 1.0] as const;
const COLORS = ['#ef4444', '#f97316', '#facc15', '#ffffff', '#1f8a5b'];
const TOOLS: { id: DrawTool; label: string }[] = [
  { id: 'line', label: 'Linje' },
  { id: 'arrow', label: 'Pil' },
  { id: 'circle', label: 'Sirkel' },
  { id: 'freehand', label: 'Frihånd' },
];

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

async function pickVideo() {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
  return r.canceled ? null : (r.assets[0]?.uri ?? null);
}

export default function AnalyzeScreen() {
  const { width: W, height: H } = useWindowDimensions();

  const [uri1, setUri1] = useState<string | null>(null);
  const [uri2, setUri2] = useState<string | null>(null);
  const [shapes1, setShapes1] = useState<DrawShape[]>([]);
  const [shapes2, setShapes2] = useState<DrawShape[]>([]);
  const addShape1 = useCallback((s: DrawShape) => setShapes1((p) => [...p, s]), []);
  const addShape2 = useCallback((s: DrawShape) => setShapes2((p) => [...p, s]), []);
  const [activeTool, setActiveTool] = useState<DrawTool | null>(null);
  const [activeColor, setActiveColor] = useState(COLORS[0]);
  const [rate, setRate] = useState(1.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activePanel, setActivePanel] = useState<0 | 1>(0);
  const [showControls, setShowControls] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [scrubWidth, setScrubWidth] = useState(1);
  const [lines1, setLines1] = useState<PoseLines | null>(null);
  const [lines2, setLines2] = useState<PoseLines | null>(null);
  const [posLoading, setPosLoading] = useState(false);
  const [showLines, setShowLines] = useState(true);

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrubWidthRef = useRef(1);
  const durationRef = useRef(0);
  const uri2Ref = useRef<string | null>(null);
  durationRef.current = duration;
  uri2Ref.current = uri2;

  const sideBySide = !!uri1 && !!uri2;
  const TOOLBAR_H = 108;
  const videoH = H - TOOLBAR_H;
  const panelW = sideBySide ? W / 2 : W;
  const scrubPct = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const thumbLeft = Math.max(0, Math.min(scrubWidth - 16, scrubPct * scrubWidth - 8));

  const player1 = useVideoPlayer(null, (p) => { p.loop = true; });
  const player2 = useVideoPlayer(null, (p) => { p.loop = true; });

  // Tillat liggende skjerm her (resten av appen er låst til portrett)
  useEffect(() => {
    ScreenOrientation.unlockAsync();
    return () => { ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP); };
  }, []);

  useEffect(() => {
    if (!uri1) return;
    player1.replace(uri1);
    player1.playbackRate = rate;
    player1.play();
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(0);
    setLines1(null);
  }, [uri1]);

  useEffect(() => {
    if (!uri2) return;
    player2.replace(uri2);
    player2.playbackRate = rate;
    player2.play();
    setLines2(null);
  }, [uri2]);

  // Poll player time while a video is loaded
  useEffect(() => {
    if (!uri1) return;
    const iv = setInterval(() => {
      setCurrentTime(player1.currentTime ?? 0);
      const d = player1.duration;
      if (d) { setDuration(d); durationRef.current = d; }
    }, 200);
    return () => clearInterval(iv);
  }, [uri1]);

  function resetHideTimer() {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 2500);
  }

  function handleVideoTap(locX: number) {
    if (sideBySide) setActivePanel(locX < W / 2 ? 0 : 1);
    setIsPlaying(player1.playing);
    setShowControls(true);
    resetHideTimer();
  }

  function dismissControls() {
    setShowControls(false);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }

  const activeUri = activePanel === 0 ? uri1 : uri2;
  const activeLines = activePanel === 0 ? lines1 : lines2;

  async function handlePoseLines() {
    if (posLoading) return;
    // Har vi linjer for aktivt panel? Da bare toggle synlighet.
    if (activeLines) { setShowLines((v) => !v); return; }
    if (!activeUri) return;
    setPosLoading(true);
    try {
      const data = await fetchPoseLines(activeUri);
      if (activePanel === 0) setLines1(data); else setLines2(data);
      setShowLines(true);
      // Stopp på address-framen så linjene matcher kroppen
      player1.pause();
      if (uri2) player2.pause();
      setIsPlaying(false);
      const player = activePanel === 0 ? player1 : player2;
      player.currentTime = data.address_frame / data.fps;
    } catch (e) {
      console.warn('[pose-lines]', (e as Error).message);
    } finally {
      setPosLoading(false);
    }
  }

  function togglePlay() {
    const next = !isPlaying;
    setIsPlaying(next);
    if (next) { player1.play(); if (uri2) player2.play(); }
    else { player1.pause(); if (uri2) player2.pause(); }
    resetHideTimer();
  }

  function seek(delta: number) {
    const t = Math.max(0, (player1.currentTime ?? 0) + delta);
    player1.currentTime = t;
    if (uri2) player2.currentTime = t;
    setCurrentTime(t);
    resetHideTimer();
  }

  function changeSpeed(r: number) {
    setRate(r);
    player1.playbackRate = r;
    if (uri2) player2.playbackRate = r;
  }

  function toggleTool(t: DrawTool) {
    setActiveTool((prev) => {
      if (prev === t) { setShowControls(true); resetHideTimer(); return null; }
      setShowControls(false);
      return t;
    });
  }

  function undo() {
    if (activePanel === 0) setShapes1((s) => s.slice(0, -1));
    else setShapes2((s) => s.slice(0, -1));
  }

  // Scrubber gesture – uses refs so the PanResponder stays stable across renders
  const scrubPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / scrubWidthRef.current));
        const t = pct * durationRef.current;
        player1.currentTime = t;
        if (uri2Ref.current) player2.currentTime = t;
        setCurrentTime(t);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
      },
      onPanResponderMove: (e) => {
        const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / scrubWidthRef.current));
        const t = pct * durationRef.current;
        player1.currentTime = t;
        if (uri2Ref.current) player2.currentTime = t;
        setCurrentTime(t);
      },
    })
  ).current;

  // ── EMPTY STATE ────────────────────────────────────────────────────────────
  if (!uri1) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.emptyWrap} edges={['top', 'bottom']}>
          <View style={styles.emptyTop}><BackButton /></View>
          <View style={styles.emptyCenter}>
            <Text style={styles.emptyTitle}>Manuell analyse</Text>
            <Text style={styles.emptyBody}>Velg en video for å tegne og analysere svingen din</Text>
            <Pressable
              onPress={async () => { const u = await pickVideo(); if (u) setUri1(u); }}
              style={styles.pickBtn}>
              <Text style={styles.pickBtnText}>Velg video</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                const u1 = await pickVideo();
                if (!u1) return;
                const u2 = await pickVideo();
                if (u2) { setUri1(u1); setUri2(u2); } else setUri1(u1);
              }}
              style={styles.pickBtnAlt}>
              <Text style={styles.pickBtnAltText}>Velg to – side ved side</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── ANALYSIS VIEW ──────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Video panels */}
      <View style={[{ height: videoH }, sideBySide && styles.videoRow]}>

        {/* Panel 1 */}
        <View style={{ width: panelW, height: videoH, overflow: 'hidden' }}>
          <VideoView player={player1} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
          {showLines && lines1 && <PoseLinesOverlay lines={lines1} width={panelW} height={videoH} />}
          <DrawingCanvas
            width={panelW} height={videoH}
            tool={!sideBySide || activePanel === 0 ? activeTool : null}
            color={activeColor} shapes={shapes1}
            onAdd={addShape1}
          />
          {sideBySide && (
            <View style={[styles.panelFrame, activePanel === 0 && styles.panelFrameActive]} pointerEvents="none" />
          )}
        </View>

        {/* Panel 2 */}
        {uri2 && (
          <View style={{ width: panelW, height: videoH, overflow: 'hidden' }}>
            <VideoView player={player2} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
            {showLines && lines2 && <PoseLinesOverlay lines={lines2} width={panelW} height={videoH} />}
            <DrawingCanvas
              width={panelW} height={videoH}
              tool={activePanel === 1 ? activeTool : null}
              color={activeColor} shapes={shapes2}
              onAdd={addShape2}
            />
            <View style={[styles.panelFrame, activePanel === 1 && styles.panelFrameActive]} pointerEvents="none" />
          </View>
        )}

        {/* Tap catcher – shows controls when overlay is hidden */}
        {!activeTool && !showControls && (
          <Pressable
            style={[StyleSheet.absoluteFill, { height: videoH }]}
            onPress={(e) => handleVideoTap(e.nativeEvent.locationX)}
          />
        )}

        {/* Controls overlay – dismiss layer behind, content falls through empty taps */}
        {!activeTool && showControls && (
          <View style={[styles.controlsOverlay, { height: videoH }]}>
            {/* Dismiss layer: any tap on empty space hides the controls */}
            <Pressable style={StyleSheet.absoluteFill} onPress={dismissControls}>
              <View style={[StyleSheet.absoluteFill, styles.controlsBg]} />
            </Pressable>

            {/* Content – box-none so only the buttons capture touches */}
            <View style={[StyleSheet.absoluteFill, styles.controlsContent]} pointerEvents="box-none">
              {/* Top: back + side-by-side */}
              <SafeAreaView style={styles.controlsTop} pointerEvents="box-none" edges={['top']}>
                <View style={styles.topRow}>
                  <BackButton />
                  {!uri2 && (
                    <Pressable
                      onPress={async () => { const u = await pickVideo(); if (u) { setUri2(u); setActivePanel(1); } }}
                      style={styles.splitBtn}>
                      <Text style={styles.splitBtnText}>+ Side ved side</Text>
                    </Pressable>
                  )}
                </View>
              </SafeAreaView>

              {/* Centre: play/pause */}
              <View style={styles.centerRow} pointerEvents="box-none">
                <Pressable onPress={togglePlay} style={styles.bigPlayBtn} hitSlop={20}>
                  <Icon name={isPlaying ? 'pause' : 'play'} size={38} color="#fff" />
                </Pressable>
              </View>

              {/* Bottom: time + scrubber */}
              <View style={styles.scrubRow}>
                <Text style={styles.timeText}>{fmt(currentTime)}</Text>
                <View
                  {...scrubPan.panHandlers}
                  style={styles.scrubHitArea}
                  onLayout={(e) => {
                    const w = e.nativeEvent.layout.width;
                    setScrubWidth(w);
                    scrubWidthRef.current = w;
                  }}>
                  <View style={styles.scrubTrack} />
                  <View style={[styles.scrubFill, { width: scrubPct * scrubWidth }]} />
                  <View style={[styles.scrubThumb, { left: thumbLeft }]} />
                </View>
                <Text style={styles.timeText}>{fmt(duration)}</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Drawing toolbar */}
      <SafeAreaView style={styles.toolbar} edges={['bottom']}>

        {/* Row 1: scrollable tools + colours | fixed undo */}
        <View style={styles.toolRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={styles.toolScrollContent}>
            {TOOLS.map((t) => (
              <Pressable
                key={t.id} onPress={() => toggleTool(t.id)}
                style={[styles.toolBtn, activeTool === t.id && styles.toolBtnOn]} hitSlop={6}>
                <Text style={[styles.toolText, activeTool === t.id && styles.toolTextOn]}>{t.label}</Text>
              </Pressable>
            ))}
            <View style={styles.sep} />
            {COLORS.map((c) => (
              <Pressable
                key={c} onPress={() => setActiveColor(c)}
                style={[styles.colorDot, { backgroundColor: c }, activeColor === c && styles.colorDotOn]}
                hitSlop={6} />
            ))}
          </ScrollView>
          {/* Undo – always visible outside the scroll */}
          <View style={styles.undoArea}>
            <View style={styles.sep} />
            <Pressable onPress={undo} style={styles.undoBtn} hitSlop={8}>
              <Text style={styles.undoBtnText}>↩</Text>
            </Pressable>
          </View>
        </View>

        {/* Row 2: playback speed + posisjonsanalyse */}
        <View style={[styles.toolRow, { gap: 4 }]}>
          <Text style={styles.speedLabel}>HASTIGHET</Text>
          {SPEEDS.map((s) => (
            <Pressable
              key={s} onPress={() => changeSpeed(s)}
              style={[styles.speedBtn, rate === s && styles.speedBtnOn]} hitSlop={6}>
              <Text style={[styles.speedText, rate === s && styles.speedTextOn]}>
                {s === 1 ? '1×' : `${s}×`}
              </Text>
            </Pressable>
          ))}
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={handlePoseLines}
            disabled={posLoading || !activeUri}
            style={[styles.poseBtn, activeLines && showLines && styles.poseBtnOn]} hitSlop={6}>
            {posLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.poseText, activeLines && showLines && styles.poseTextOn]}>
                {activeLines ? (showLines ? 'Skjul linjer' : 'Vis linjer') : 'Analyser stilling'}
              </Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  videoRow: { flexDirection: 'row' },

  // ── Empty state
  emptyWrap: { flex: 1, backgroundColor: Arc.color.appBg },
  emptyTop: { paddingHorizontal: 22, paddingTop: 8 },
  emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  emptyTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4, color: Arc.color.ink, textAlign: 'center' },
  emptyBody: { fontSize: 15, color: Arc.color.ink2, textAlign: 'center', lineHeight: 22 },
  pickBtn: {
    marginTop: 6, backgroundColor: Arc.color.accent,
    paddingHorizontal: 32, paddingVertical: 14, borderRadius: Arc.radius.pill, ...Arc.shadow.sm,
  },
  pickBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  pickBtnAlt: {
    paddingHorizontal: 22, paddingVertical: 10, borderRadius: Arc.radius.pill,
    borderWidth: 1.5, borderColor: Arc.color.line2,
  },
  pickBtnAltText: { fontSize: 14, fontWeight: '600', color: Arc.color.ink2 },

  // ── Panels
  panelFrame: { ...StyleSheet.absoluteFillObject, borderWidth: 2.5, borderColor: 'transparent' },
  panelFrameActive: { borderColor: Arc.color.accent },

  // ── Controls overlay
  controlsOverlay: { position: 'absolute', left: 0, right: 0, top: 0 },
  controlsContent: { justifyContent: 'space-between', paddingBottom: 20 },
  controlsBg: { backgroundColor: 'rgba(0,0,0,0.38)' },

  centerRow: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bigPlayBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },

  scrubRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  timeText: {
    fontFamily: Fonts!.mono, fontSize: 12,
    color: 'rgba(255,255,255,0.85)', minWidth: 36, textAlign: 'center',
  },
  scrubHitArea: { flex: 1, height: 36, justifyContent: 'center' },
  scrubTrack: { position: 'absolute', left: 0, right: 0, height: 3, top: 16, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)' },
  scrubFill: { position: 'absolute', left: 0, height: 3, top: 16, borderRadius: 2, backgroundColor: Arc.color.accent },
  scrubThumb: { position: 'absolute', top: 10, width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff' },

  // ── Controls top area
  controlsTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22 },
  splitBtn: {
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Arc.radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  splitBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  // ── Toolbar
  toolbar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(10,16,12,0.93)',
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2, gap: 5,
  },
  toolRow: { flexDirection: 'row', alignItems: 'center' },
  toolScrollContent: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingRight: 4 },
  sep: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.14)', marginHorizontal: 4 },

  toolBtn: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: Arc.radius.xs, backgroundColor: 'rgba(255,255,255,0.07)' },
  toolBtnOn: { backgroundColor: Arc.color.accent },
  toolText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  toolTextOn: { color: '#fff' },

  colorDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  colorDotOn: { borderColor: '#fff' },

  undoArea: { flexDirection: 'row', alignItems: 'center' },
  undoBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Arc.radius.xs, backgroundColor: 'rgba(255,255,255,0.07)' },
  undoBtnText: { fontSize: 16, color: 'rgba(255,255,255,0.75)' },

  speedLabel: { fontFamily: Fonts!.mono, fontSize: 9, letterSpacing: 1, color: 'rgba(255,255,255,0.3)', marginRight: 2 },
  speedBtn: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: Arc.radius.xs },
  speedBtnOn: { backgroundColor: 'rgba(255,255,255,0.13)' },
  speedText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)', fontFamily: Fonts!.mono },
  speedTextOn: { color: '#fff' },

  poseBtn: {
    minWidth: 116, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: Arc.radius.xs,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  poseBtnOn: { backgroundColor: Arc.color.accent },
  poseText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.75)' },
  poseTextOn: { color: '#fff' },
});
