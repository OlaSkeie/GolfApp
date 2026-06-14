import { Circle, Ellipse, Path, Rect, Svg } from 'react-native-svg';

// Monoline-ikonsett (24×24, currentColor-strøk). Portet fra ARC-designspecen.
// Elementer med `solid` fylles med fargen (stroke none); resten er kun strøk.
const ICONS: Record<string, (color: string) => React.ReactNode> = {
  home: () => (
    <>
      <Path d="M4 11.5 12 4l8 7.5" />
      <Path d="M6 10.5V20h12v-9.5" />
    </>
  ),
  analyze: () => (
    <>
      <Circle cx={11} cy={11} r={6.5} />
      <Path d="M16 16l4 4" />
    </>
  ),
  progress: () => (
    <>
      <Path d="M4 15.5 9.5 10l3.2 3.2L20 6" />
      <Path d="M20 6h-4.2M20 6v4.2" />
    </>
  ),
  profile: () => (
    <>
      <Circle cx={12} cy={8.5} r={3.6} />
      <Path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  swing: (c) => (
    <>
      <Path d="M4.5 19c1-7.5 8-12 14.5-12" />
      <Circle cx={5} cy={19} r={1.9} fill={c} stroke="none" />
    </>
  ),
  handicap: () => (
    <>
      <Path d="M8 20V4l9 3.2L8 10.5" />
      <Path d="M5.5 20h6" />
    </>
  ),
  tempo: () => (
    <>
      <Path d="M9 4h6l3 16H6L9 4Z" />
      <Path d="M12 12l3.5-4.5" />
    </>
  ),
  shottrace: (c) => (
    <>
      <Path d="M4 20c3.5-11 12.5-13 16-8.5" strokeDasharray="0.1 3.4" strokeLinecap="round" />
      <Circle cx={18.5} cy={13} r={2.3} />
    </>
  ),
  clubtrace: (c) => (
    <>
      <Ellipse cx={12} cy={12} rx={5} ry={8} transform="rotate(28 12 12)" />
      <Circle cx={8.4} cy={17.5} r={1.6} fill={c} stroke="none" />
    </>
  ),
  analysis: (c) => (
    <>
      <Rect x={3.5} y={5.5} width={17} height={13} rx={3} />
      <Path d="M10.5 9.7v4.6l4-2.3-4-2.3Z" fill={c} stroke="none" />
    </>
  ),
  sparkle: () => (
    <Path d="M12 3.5c.6 3.8 1.7 4.9 5.5 5.5-3.8.6-4.9 1.7-5.5 5.5-.6-3.8-1.7-4.9-5.5-5.5 3.8-.6 4.9-1.7 5.5-5.5Z" />
  ),
  play: (c) => <Path d="M8 5.5v13l11-6.5-11-6.5Z" fill={c} stroke="none" />,
  pause: (c) => (
    <>
      <Rect x={6} y={5} width={4} height={14} rx={1.5} fill={c} stroke="none" />
      <Rect x={14} y={5} width={4} height={14} rx={1.5} fill={c} stroke="none" />
    </>
  ),
  chevron: () => <Path d="M9 5l7 7-7 7" />,
  clock: () => (
    <>
      <Circle cx={12} cy={12} r={8} />
      <Path d="M12 7.5V12l3 2" />
    </>
  ),
  target: () => (
    <>
      <Circle cx={12} cy={12} r={8} />
      <Circle cx={12} cy={12} r={3.4} />
    </>
  ),
  camera: () => (
    <>
      <Rect x={3.5} y={7} width={17} height={12.5} rx={3} />
      <Circle cx={12} cy={13.3} r={3.4} />
      <Path d="M8.5 7l1.4-2.5h4.2L15.5 7" />
    </>
  ),
  check: () => <Path d="M5 12.5 10 17l9-10" />,
};

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  stroke?: number;
};

export function Icon({ name, size = 24, color = '#000', stroke = 1.7 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round">
      {ICONS[name](color)}
    </Svg>
  );
}
