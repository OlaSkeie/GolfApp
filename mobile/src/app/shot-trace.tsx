import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { Arc, Fonts } from '@/constants/theme';
import { analyzeShotTrace } from '@/services/shotTraceService';
import type { ShotTraceResult, TrackedPoint } from '@/types';

type Screen = 'pick' | 'tap' | 'seek' | 'analyze' | 'result';

export default function ShotTraceScreen() {
  const [screen, setScreen]   = useState<Screen>('pick');
  const [uri,    setUri]      = useState<string | null>(null);
  const [tee,    setTee]      = useState<{ x: number; y: number } | null>(null);
  const [result, setResult]   = useState<ShotTraceResult | null>(null);

  async function pickVideo() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    if (res.canceled) return;
    setUri(res.assets[0].uri);
    setScreen('tap');
  }

  function onTeeTapped(xPct: number, yPct: number) {
    setTee({ x: xPct, y: yPct });
    setScreen('seek');
  }

  async function onImpactConfirmed(impactTimeSec: number) {
    if (!uri || !tee) return;
    setScreen('analyze');
    try {
      setResult(await analyzeShotTrace(uri, tee.x, tee.y, impactTimeSec));
    } catch (err) {
      console.error('[shot-trace] feil:', err);
      setResult(null);
    } finally {
      setScreen('result');
    }
  }

  function reset() {
    setUri(null);
    setTee(null);
    setResult(null);
    setScreen('pick');
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.title}>Shot Trace</Text>
          <View style={{ width: 36 }} />
        </View>

        {screen === 'pick' && (
          <View style={styles.center}>
            <Text style={styles.pickHint}>Velg en video av drivet ditt</Text>
            <Pressable style={styles.btn} onPress={pickVideo}>
              <Text style={styles.btnText}>Velg video</Text>
            </Pressable>
          </View>
        )}

        {screen === 'tap' && uri && (
          <TapView uri={uri} onTapped={onTeeTapped} onBack={() => setScreen('pick')} />
        )}

        {screen === 'seek' && uri && (
          <SeekView uri={uri} onConfirmed={onImpactConfirmed} onBack={() => setScreen('tap')} />
        )}

        {screen === 'analyze' && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Arc.color.accent} />
            <Text style={styles.subText}>Sporer ball…</Text>
          </View>
        )}

        {screen === 'result' && uri && (
          <ResultView uri={uri} result={result} onReset={reset} />
        )}
      </SafeAreaView>
    </View>
  );
}

// ─── Tap screen ───────────────────────────────────────────────────────────────

function TapView({
  uri, onTapped, onBack,
}: {
  uri: string;
  onTapped: (xPct: number, yPct: number) => void;
  onBack: () => void;
}) {
  const player = useVideoPlayer(uri, (p) => { p.pause(); p.currentTime = 0; });
  const [size,   setSize]   = useState({ w: Dimensions.get('window').width, h: 400 });
  const [tapped, setTapped] = useState<{ x: number; y: number } | null>(null);

  function handleTap(e: GestureResponderEvent) {
    const { locationX, locationY } = e.nativeEvent;
    setTapped({ x: locationX, y: locationY });
    setTimeout(() => onTapped(locationX / size.w, locationY / size.h), 300);
  }

  return (
    <View style={styles.flex}>
      <View
        style={styles.videoContainer}
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" />
        <Pressable style={StyleSheet.absoluteFill} onPress={handleTap}>
          {tapped && (
            <Svg style={StyleSheet.absoluteFill} width={size.w} height={size.h} pointerEvents="none">
              <Circle cx={tapped.x} cy={tapped.y} r={12} fill="none" stroke={Arc.color.accent} strokeWidth={3} />
              <Circle cx={tapped.x} cy={tapped.y} r={3} fill={Arc.color.accent} />
            </Svg>
          )}
        </Pressable>
      </View>
      <View style={styles.bottom}>
        <Text style={styles.hint}>Trykk på ballen på tee</Text>
        <Pressable style={[styles.btn, styles.btnSecondary]} onPress={onBack}>
          <Text style={[styles.btnText, { color: Arc.color.ink }]}>Velg annen video</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Seek screen ──────────────────────────────────────────────────────────────

function SeekView({
  uri, onConfirmed, onBack,
}: {
  uri: string;
  onConfirmed: (timeSec: number) => void;
  onBack: () => void;
}) {
  const player   = useVideoPlayer(uri, (p) => { p.pause(); p.currentTime = 0; });
  const [playing,    setPlaying]    = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,   setDuration]   = useState(1);
  const barRef = useRef<View>(null);
  const barWidth = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      setCurrentTime(player.currentTime);
      if (player.duration > 0) setDuration(player.duration);
    }, 50);
    return () => clearInterval(id);
  }, [player]);

  function togglePlay() {
    if (playing) { player.pause(); setPlaying(false); }
    else         { player.play();  setPlaying(true);  }
  }

  function seekFromTouch(e: GestureResponderEvent) {
    const x   = e.nativeEvent.locationX;
    const pct = Math.max(0, Math.min(1, x / barWidth.current));
    const t   = pct * duration;
    player.currentTime = t;
    setCurrentTime(t);
  }

  const progress = duration > 0 ? currentTime / duration : 0;

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(1).padStart(4, '0');
    return `${m}:${sec}`;
  }

  return (
    <View style={styles.flex}>
      <View style={styles.videoContainer}>
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" />
      </View>

      <View style={styles.bottom}>
        <Text style={styles.hint}>Skru til rett før impact og trykk «Sett impact»</Text>

        {/* scrubber */}
        <View style={styles.scrubberRow}>
          <Text style={styles.timeText}>{fmt(currentTime)}</Text>
          <View
            ref={barRef}
            style={styles.scrubberTrack}
            onLayout={(e) => { barWidth.current = e.nativeEvent.layout.width; }}
            onStartShouldSetResponder={() => true}
            onResponderGrant={seekFromTouch}
            onResponderMove={seekFromTouch}
          >
            <View style={[styles.scrubberFill, { width: `${progress * 100}%` }]} />
            <View style={[styles.scrubberThumb, { left: `${progress * 100}%` as any }]} />
          </View>
          <Text style={styles.timeText}>{fmt(duration)}</Text>
        </View>

        {/* play/pause */}
        <Pressable style={[styles.btn, styles.btnSecondary]} onPress={togglePlay}>
          <Text style={[styles.btnText, { color: Arc.color.ink }]}>{playing ? '⏸ Pause' : '▶ Spill'}</Text>
        </Pressable>

        <Pressable style={styles.btn} onPress={() => { player.pause(); onConfirmed(currentTime); }}>
          <Text style={styles.btnText}>Sett impact her</Text>
        </Pressable>

        <Pressable onPress={onBack}>
          <Text style={styles.backLink}>← Tilbake</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Result screen ────────────────────────────────────────────────────────────

function ResultView({
  uri, result, onReset,
}: {
  uri: string;
  result: ShotTraceResult | null;
  onReset: () => void;
}) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.play(); });
  const [size, setSize]           = useState({ w: Dimensions.get('window').width, h: 400 });
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(player.currentTime), 50);
    return () => clearInterval(id);
  }, [player]);

  const { w, h } = size;
  const videoW    = result?.video_width  ?? w;
  const videoH    = result?.video_height ?? h;
  const scale     = Math.min(w / videoW, h / videoH);
  const renderedW = videoW * scale;
  const renderedH = videoH * scale;
  const offsetX   = (w - renderedW) / 2;
  const offsetY   = (h - renderedH) / 2;

  const fps             = result?.fps ?? 30;
  const windowStart     = result?.window_start_sec ?? 0;
  const currentFrame    = Math.round((currentTime - windowStart) * fps);
  const allPoints       = result?.tracked_points ?? [];

  function toXY(p: TrackedPoint) {
    return { x: offsetX + p.x_pct * renderedW, y: offsetY + p.y_pct * renderedH };
  }

  const visible = allPoints.filter(p => p.frame <= currentFrame);

  return (
    <View style={styles.flex}>
      <View
        style={styles.videoContainer}
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" />
        {visible.length > 0 && (
          <Svg style={StyleSheet.absoluteFill} width={w} height={h} pointerEvents="none">
            {visible.length >= 2 && (
              <Path
                d={visible.map((p, i) => {
                  const { x, y } = toXY(p);
                  return i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `L ${x.toFixed(1)} ${y.toFixed(1)}`;
                }).join(' ')}
                stroke={Arc.color.accent}
                strokeWidth={2}
                strokeOpacity={0.5}
                fill="none"
              />
            )}
            {visible.map((p, i) => {
              const { x, y } = toXY(p);
              const isTee = p.frame === result?.impact_frame;
              return (
                <Circle
                  key={i}
                  cx={x} cy={y}
                  r={isTee ? 6 : 3}
                  fill={isTee ? '#fff' : Arc.color.accent}
                  opacity={0.9}
                />
              );
            })}
          </Svg>
        )}
      </View>
      <View style={styles.bottom}>
        {result ? (
          <View style={styles.chips}>
            <StatChip label="Sporing" value={`${result.tracked_points.length} pts`} />
            <StatChip label="Impact"  value={`${(result.impact_frame / result.fps).toFixed(2)}s`} />
            <StatChip label="FPS"     value={`${Math.round(result.fps)}`} />
          </View>
        ) : (
          <Text style={styles.subText}>Ingen ballsporing funnet</Text>
        )}
        <Pressable style={styles.btn} onPress={onReset}>
          <Text style={styles.btnText}>Ny video</Text>
        </Pressable>
      </View>
    </View>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.chipValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#000' },
  safeArea:       { flex: 1 },
  flex:           { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#000',
  },
  title:          { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  videoContainer: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 20, paddingHorizontal: 32, backgroundColor: Arc.color.appBg,
  },
  pickHint:  { fontSize: 18, fontWeight: '600', color: Arc.color.ink, textAlign: 'center' },
  hint:      { fontSize: 15, fontWeight: '500', color: Arc.color.ink2, textAlign: 'center' },
  subText:   { marginTop: 8, fontSize: 15, color: Arc.color.ink3, textAlign: 'center' },
  bottom: {
    backgroundColor: Arc.color.surface,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28, gap: 12,
  },
  scrubberRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scrubberTrack: {
    flex: 1, height: 28, justifyContent: 'center',
    backgroundColor: Arc.color.line, borderRadius: 4, overflow: 'hidden',
  },
  scrubberFill:  { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: Arc.color.accent },
  scrubberThumb: {
    position: 'absolute', top: 4, width: 20, height: 20, marginLeft: -10,
    borderRadius: 10, backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2,
  },
  timeText: { fontFamily: Fonts.mono, fontSize: 12, color: Arc.color.ink2, width: 46 },
  chips:    { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  chip: {
    backgroundColor: Arc.color.accentWash, borderRadius: Arc.radius.sm,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  chipLabel: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 1.4, color: Arc.color.accentD, marginBottom: 3 },
  chipValue: { fontSize: 15, fontWeight: '700', color: Arc.color.ink },
  btn: {
    backgroundColor: Arc.color.accent, borderRadius: Arc.radius.pill,
    paddingVertical: 14, alignItems: 'center',
  },
  btnSecondary: {
    backgroundColor: Arc.color.surface2,
    borderWidth: 1, borderColor: Arc.color.line,
  },
  btnText:  { color: '#fff', fontSize: 16, fontWeight: '700' },
  backLink: { textAlign: 'center', color: Arc.color.ink3, fontSize: 14, paddingVertical: 4 },
});
