import { StyleSheet, View } from 'react-native';
import { Line, Svg } from 'react-native-svg';

import type { PoseLines, PosePoint } from '@/types';

type Props = {
  lines: PoseLines;
  width: number;   // panel width on screen
  height: number;  // panel height on screen
};

const COL = {
  head: '#facc15',     // hode – rise-referanse
  spine: '#34d399',    // torso/ryggrad
  pelvis: '#fb923c',   // bekken – early extension (bak rumpa)
};
const SW = 2;

function L(key: string, x1: number, y1: number, x2: number, y2: number, color: string) {
  return (
    <Line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={SW}
      strokeOpacity={0.9} strokeLinecap="round" />
  );
}

function mid(a: PosePoint, b: PosePoint): PosePoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

type XY = { x: number; y: number };

function extend(a: XY, b: XY, before: number, after: number) {
  const dx = b.x - a.x, dy = b.y - a.y;
  return { x1: a.x - dx * before, y1: a.y - dy * before, x2: b.x + dx * after, y2: b.y + dy * after };
}

export function PoseLinesOverlay({ lines, width, height }: Props) {
  const { video_width: vw, video_height: vh } = lines;
  if (!vw || !vh) return null;

  // contentFit="cover": skaler så videoen dekker panelet, sentrer, beskjær overflod
  const scale = Math.max(width / vw, height / vh);
  const dispW = vw * scale;
  const dispH = vh * scale;
  const offX = (width - dispW) / 2;
  const offY = (height - dispH) / 2;
  const map = (p: PosePoint): XY => ({ x: offX + p.x * dispW, y: offY + p.y * dispH });

  const midShoulder = lines.left_shoulder && lines.right_shoulder ? mid(lines.left_shoulder, lines.right_shoulder) : null;
  const midHip = lines.left_hip && lines.right_hip ? mid(lines.left_hip, lines.right_hip) : null;
  // Hvilken vei vender spilleren? Nesa er mot ballen (front). Rumpa er motsatt.
  const noseS = lines.nose ? map(lines.nose) : null;
  const hipS = midHip ? map(midHip) : null;
  const frontSign = noseS && hipS ? Math.sign(noseS.x - hipS.x) || 1 : 1;

  const els: React.ReactNode[] = [];

  // Hode – horisontal linje over hodet (rise-referanse)
  // Bruker segmentert topp hvis tilgjengelig, ellers offset over nesen
  if (lines.nose) {
    const n = map(lines.nose);
    const headY = lines.head_top_y != null
      ? offY + lines.head_top_y * dispH
      : n.y - 35;
    const hw = width * 0.08;
    els.push(L('head-h', n.x - hw, headY, n.x + hw, headY, COL.head));
  }

  // Bekken – vertikal linje ved utsiden av rumpa (early extension)
  // Bruker segmentert kant hvis tilgjengelig, ellers estimert offset
  if (hipS) {
    const buttX = lines.butt_edge_x != null
      ? offX + lines.butt_edge_x * dispW
      : (() => {
          const shS = midShoulder ? map(midShoulder) : null;
          const torso = shS ? Math.hypot(shS.x - hipS.x, shS.y - hipS.y) : height * 0.25;
          return hipS.x - frontSign * 0.30 * torso;
        })();
    els.push(L('pelvis', buttX, 0, buttX, height, COL.pelvis));
  }

  // Torso/ryggrad – hofte→skulder, forlenget begge veier (positur-plan)
  if (midShoulder && midHip) {
    const sh = map(midShoulder);
    const hp = map(midHip);
    const e = extend(hp, sh, 0.25, 0.45);
    els.push(L('spine', e.x1, e.y1, e.x2, e.y2, COL.spine));
  }

  if (!els.length) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height}>{els}</Svg>
    </View>
  );
}
