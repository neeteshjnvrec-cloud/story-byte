// SceneArt — hand-composed SVG illustrations used as story/cover artwork and
// onboarding scenes. Everything is vector (react-native-svg) so it stays crisp
// at any size and ships in the bundle (no network, works offline). Each scene
// is a gradient sky plus layered shapes (moon/sun, stars, hills, clouds…) in
// the warm "storybook" palette. Unknown keys fall back to a calm default.
import React from 'react';
import Svg, {
  Defs, LinearGradient, RadialGradient, Stop, Rect, Circle, Ellipse, Path, G,
} from 'react-native-svg';

const VB = 120; // viewBox is 0..120 square; slice-fills any container

// Sky gradients (top → bottom) per scene.
const SKY = {
  bedtime: ['#3B2F63', '#6B4B86', '#B56A55'],
  sleep:   ['#241C40', '#3B2F63', '#6B4B86'],
  mystery: ['#241C30', '#3A2E5A', '#6E4E86'],
  calm:    ['#F7C97A', '#F0955C', '#C8607A'],
  romance: ['#F7C05A', '#EE8B6B', '#C85C7A'],
  kids:    ['#9BD9EC', '#BFE9E0', '#FFE7B8'],
  hindi:   ['#F7C05A', '#F0955C', '#C85C5C'],
  adventure: ['#9BD9EC', '#BFE9DE', '#8FCB86'],
  fantasy: ['#8BD0C4', '#5EA6A0', '#356E86'],
  default: ['#F3C57A', '#E79A5E', '#C86A6B'],
};

const key = (k) => {
  const s = String(k || '').toLowerCase().replace(/[^a-z]/g, '');
  if (SKY[s]) return s;
  if (['bedtime', 'night'].includes(s)) return 'bedtime';
  if (['scifi', 'thriller', 'horror'].includes(s)) return 'mystery';
  if (['fairytale'].includes(s)) return 'fantasy';
  return 'default';
};

// --- reusable pieces --------------------------------------------------------

const Stars = ({ color = '#FBE7C6' }) => {
  const pts = [
    [22, 20, 1.4], [40, 14, 1], [58, 24, 1.2], [80, 18, 1.5], [96, 30, 1],
    [16, 40, 1], [70, 40, 1], [104, 48, 1.2], [34, 32, 0.8],
  ];
  return (
    <G>
      {pts.map(([x, y, r], i) => (
        <Circle key={i} cx={x} cy={y} r={r} fill={color} opacity={0.9} />
      ))}
      {/* a couple of 4-point sparkles */}
      <Path d="M88 40 l1.4 3.2 3.2 1.4 -3.2 1.4 -1.4 3.2 -1.4 -3.2 -3.2 -1.4 3.2 -1.4 z" fill={color} opacity={0.85} />
      <Path d="M30 52 l1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1 z" fill={color} opacity={0.7} />
    </G>
  );
};

const Cloud = ({ x, y, s = 1, color = '#FFFFFF', opacity = 0.9 }) => (
  <G opacity={opacity}>
    <Ellipse cx={x} cy={y} rx={13 * s} ry={7 * s} fill={color} />
    <Circle cx={x - 9 * s} cy={y + 1 * s} r={6 * s} fill={color} />
    <Circle cx={x + 9 * s} cy={y + 1 * s} r={5 * s} fill={color} />
    <Circle cx={x} cy={y - 4 * s} r={7 * s} fill={color} />
  </G>
);

// A soft glowing celestial body (moon or sun) with a halo.
const Orb = ({ cx, cy, r, id, core, edge, halo }) => (
  <G>
    <Circle cx={cx} cy={cy} r={r * 2.4} fill={`url(#halo${id})`} />
    <Circle cx={cx} cy={cy} r={r} fill={`url(#orb${id})`} />
    <Defs>
      <RadialGradient id={`orb${id}`} cx="50%" cy="45%" r="60%">
        <Stop offset="0" stopColor={core} />
        <Stop offset="1" stopColor={edge} />
      </RadialGradient>
      <RadialGradient id={`halo${id}`} cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor={halo} stopOpacity={0.55} />
        <Stop offset="1" stopColor={halo} stopOpacity={0} />
      </RadialGradient>
    </Defs>
  </G>
);

// Two overlapping hill silhouettes across the bottom.
const Hills = ({ back, front }) => (
  <G>
    <Path d={`M0 92 Q30 74 60 86 T120 82 L120 120 L0 120 Z`} fill={back} />
    <Path d={`M0 104 Q36 88 72 100 T120 98 L120 120 L0 120 Z`} fill={front} />
  </G>
);

// --- scenes -----------------------------------------------------------------

function layers(k) {
  switch (k) {
    case 'bedtime':
    case 'sleep':
    case 'mystery':
      return (
        <>
          <Stars />
          <Orb cx={90} cy={34} r={13} id="Moon" core="#FCE7BE" edge="#F2C46B" halo="#F2C46B" />
          <Hills back="#4A3A6E" front="#2E2450" />
          {/* cozy cottage with a lit window */}
          <G>
            <Path d="M50 104 L50 92 L62 84 L74 92 L74 104 Z" fill="#241C40" />
            <Rect x={57} y={94} width={6} height={6} rx={1} fill="#F2C46B" />
          </G>
        </>
      );
    case 'calm':
    case 'romance':
    case 'hindi':
      return (
        <>
          <Orb cx={60} cy={58} r={20} id="Sun" core="#FFF3D6" edge="#F4A85E" halo="#F6C06B" />
          {/* calm water with reflection */}
          <Path d="M0 84 L120 84 L120 120 L0 120 Z" fill="#C8607A" opacity={0.35} />
          <G stroke="#FFF3D6" strokeWidth={1.4} strokeLinecap="round" opacity={0.7}>
            <Path d="M50 92 h20" /><Path d="M46 100 h28" /><Path d="M52 108 h16" />
          </G>
          {/* two distant birds */}
          <G stroke="#4A2E4A" strokeWidth={1.3} strokeLinecap="round" fill="none" opacity={0.6}>
            <Path d="M24 40 q4 -4 8 0 q4 -4 8 0" />
            <Path d="M84 30 q3 -3 6 0 q3 -3 6 0" />
          </G>
          <Cloud x={30} y={30} s={0.8} color="#FFF6E6" opacity={0.75} />
        </>
      );
    case 'kids':
      return (
        <>
          {/* smiling sun with rays, top-left */}
          <G stroke="#F4A63C" strokeWidth={2.4} strokeLinecap="round">
            {Array.from({ length: 8 }).map((_, i) => {
              const a = (i / 8) * Math.PI * 2;
              return <Path key={i} d={`M${30 + Math.cos(a) * 16} ${32 + Math.sin(a) * 16} L${30 + Math.cos(a) * 22} ${32 + Math.sin(a) * 22}`} />;
            })}
          </G>
          <Circle cx={30} cy={32} r={13} fill="#FFD25A" />
          {/* rainbow arc */}
          <G fill="none" strokeLinecap="round">
            <Path d="M40 118 A44 44 0 0 1 118 84" stroke="#E86A5C" strokeWidth={5} />
            <Path d="M44 118 A38 38 0 0 1 112 88" stroke="#F0A85C" strokeWidth={5} />
            <Path d="M48 118 A32 32 0 0 1 106 92" stroke="#F2C86B" strokeWidth={5} />
            <Path d="M52 118 A26 26 0 0 1 100 96" stroke="#7FB98A" strokeWidth={5} />
          </G>
          <Hills back="#8FCB86" front="#5EA070" />
          <Cloud x={92} y={30} s={0.9} />
          <Cloud x={58} y={20} s={0.6} opacity={0.85} />
        </>
      );
    case 'adventure':
      return (
        <>
          <Orb cx={92} cy={34} r={12} id="Sun2" core="#FFF3D6" edge="#F4A85E" halo="#F6C06B" />
          <Cloud x={30} y={28} s={0.8} />
          {/* mountain range */}
          <Path d="M0 96 L26 60 L46 96 Z" fill="#5E7E86" />
          <Path d="M30 96 L60 48 L92 96 Z" fill="#3E5E6E" />
          <Path d="M52 62 L60 48 L69 62 Z" fill="#EAF2F4" />
          <Hills back="#4E7E5E" front="#356E4A" />
        </>
      );
    case 'fantasy':
    default:
      return (
        <>
          <Orb cx={60} cy={40} r={16} id="Orb0" core="#FFF3D6" edge="#F4B45E" halo="#F6C06B" />
          <Cloud x={26} y={34} s={0.7} opacity={0.8} />
          <Cloud x={96} y={44} s={0.6} opacity={0.7} />
          <Hills back="#5E9E96" front="#356E70" />
        </>
      );
  }
}

export function SceneArt({ sceneKey, style, radius = 0 }) {
  const k = key(sceneKey);
  const sky = SKY[k] || SKY.default;
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${VB} ${VB}`} preserveAspectRatio="xMidYMid slice" style={style}>
      <Defs>
        <LinearGradient id={`sky_${k}`} x1="0" y1="0" x2="0.2" y2="1">
          <Stop offset="0" stopColor={sky[0]} />
          <Stop offset="0.55" stopColor={sky[1]} />
          <Stop offset="1" stopColor={sky[2]} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={VB} height={VB} rx={radius} fill={`url(#sky_${k})`} />
      {layers(k)}
    </Svg>
  );
}

export default SceneArt;
