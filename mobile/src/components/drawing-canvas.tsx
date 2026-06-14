import { memo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { Ellipse, G, Line, Path, Svg } from 'react-native-svg';

export type DrawTool = 'line' | 'arrow' | 'circle' | 'freehand';

type Base = { id: string; color: string };
export type DrawShape =
  | (Base & { type: 'line'; x1: number; y1: number; x2: number; y2: number })
  | (Base & { type: 'arrow'; x1: number; y1: number; x2: number; y2: number })
  | (Base & { type: 'circle'; cx: number; cy: number; rx: number; ry: number })
  | (Base & { type: 'freehand'; d: string });

type Props = {
  width: number;
  height: number;
  tool: DrawTool | null;
  color: string;
  shapes: DrawShape[];
  onAdd: (s: DrawShape) => void;
};

const SW = 2.8;

function ArrowEl({ x1, y1, x2, y2, color }: { x1: number; y1: number; x2: number; y2: number; color: string }) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 16;
  const p1x = x2 - size * Math.cos(angle - Math.PI / 6);
  const p1y = y2 - size * Math.sin(angle - Math.PI / 6);
  const p2x = x2 - size * Math.cos(angle + Math.PI / 6);
  const p2y = y2 - size * Math.sin(angle + Math.PI / 6);
  const head = `M ${p1x.toFixed(1)} ${p1y.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)} L ${p2x.toFixed(1)} ${p2y.toFixed(1)}`;
  return (
    <G stroke={color} strokeWidth={SW} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <Line x1={x1} y1={y1} x2={x2} y2={y2} />
      <Path d={head} />
    </G>
  );
}

export const DrawingCanvas = memo(function DrawingCanvas({ width, height, tool, color, shapes, onAdd }: Props) {
  const [draft, setDraft] = useState<DrawShape | null>(null);
  const draftRef = useRef<DrawShape | null>(null);
  draftRef.current = draft;
  const startXY = useRef({ x: 0, y: 0 });
  const freehandRef = useRef('');
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const onAddRef = useRef(onAdd);
  toolRef.current = tool;
  colorRef.current = color;
  onAddRef.current = onAdd;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !!toolRef.current,
      onMoveShouldSetPanResponder: () => !!toolRef.current,
      onPanResponderGrant: (e) => {
        const t = toolRef.current;
        if (!t) return;
        const { locationX: x, locationY: y } = e.nativeEvent;
        startXY.current = { x, y };
        const base = { id: String(Date.now()), color: colorRef.current };
        if (t === 'freehand') {
          freehandRef.current = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
          setDraft({ ...base, type: 'freehand', d: freehandRef.current });
        } else if (t === 'line') {
          setDraft({ ...base, type: 'line', x1: x, y1: y, x2: x, y2: y });
        } else if (t === 'arrow') {
          setDraft({ ...base, type: 'arrow', x1: x, y1: y, x2: x, y2: y });
        } else {
          setDraft({ ...base, type: 'circle', cx: x, cy: y, rx: 1, ry: 1 });
        }
      },
      onPanResponderMove: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        setDraft((prev) => {
          if (!prev) return null;
          if (prev.type === 'freehand') {
            freehandRef.current += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
            return { ...prev, d: freehandRef.current };
          }
          if (prev.type === 'line') return { ...prev, x2: x, y2: y };
          if (prev.type === 'arrow') return { ...prev, x2: x, y2: y };
          return {
            ...prev,
            cx: (startXY.current.x + x) / 2,
            cy: (startXY.current.y + y) / 2,
            rx: Math.abs(x - startXY.current.x) / 2,
            ry: Math.abs(y - startXY.current.y) / 2,
          };
        });
      },
      onPanResponderRelease: () => {
        const finished = draftRef.current;
        setDraft(null);
        if (finished) onAddRef.current(finished);
      },
    })
  ).current;

  function renderShape(s: DrawShape) {
    const c = { stroke: s.color, strokeWidth: SW, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
    if (s.type === 'line') return <Line key={s.id} {...c} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />;
    if (s.type === 'arrow') return <ArrowEl key={s.id} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} color={s.color} />;
    if (s.type === 'circle') return <Ellipse key={s.id} {...c} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} />;
    return <Path key={s.id} {...c} d={(s as { d: string }).d} />;
  }

  return (
    <View
      {...pan.panHandlers}
      style={[StyleSheet.absoluteFill, { pointerEvents: tool ? 'auto' : 'none' }]}>
      <Svg width={width} height={height}>
        {shapes.map(renderShape)}
        {draft && renderShape(draft)}
      </Svg>
    </View>
  );
});
