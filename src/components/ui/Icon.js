// Icon — thin wrapper over @expo/vector-icons (Ionicons) with semantic names
// so screens don't hardcode the icon library. Add names here as needed.
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

const MAP = {
  home: 'home', 'home-outline': 'home-outline',
  search: 'search', browse: 'search',
  library: 'library-outline', albums: 'albums-outline',
  user: 'person', 'user-outline': 'person-outline',
  play: 'play', pause: 'pause',
  prev: 'play-skip-back', next: 'play-skip-forward',
  shuffle: 'shuffle', repeat: 'repeat',
  heart: 'heart-outline', 'heart-fill': 'heart',
  download: 'download-outline', 'check-circle': 'checkmark-circle', check: 'checkmark',
  share: 'share-social-outline',
  moon: 'moon-outline', sun: 'sunny-outline',
  star: 'star', 'star-outline': 'star-outline',
  gear: 'settings-outline', settings: 'settings-outline',
  timer: 'timer-outline', lock: 'lock-closed-outline',
  eye: 'eye-outline', 'eye-off': 'eye-off-outline', mail: 'mail-outline',
  'chev-down': 'chevron-down', 'chev-left': 'chevron-back', 'chev-right': 'chevron-forward',
  flame: 'flame', bell: 'notifications-outline', globe: 'globe-outline',
  headphones: 'headset-outline', speed: 'speedometer-outline', queue: 'list',
  note: 'musical-notes', volume: 'volume-medium', book: 'book-outline',
  plus: 'add', close: 'close', 'x': 'close', more: 'ellipsis-horizontal',
  // Semantic aliases for glyphs that don't exist under the same Ionicons name.
  phone: 'call', edit: 'create', pencil: 'create', camera: 'camera',
  'arrow-left': 'chevron-back', 'arrow-right': 'chevron-forward',
  'arrow-up': 'chevron-up', 'arrow-down': 'chevron-down',
};

export function Icon({ name, size = 22, color, style }) {
  const { theme } = useTheme() || { theme: {} };
  const ionName = MAP[name] || name;
  return <Ionicons name={ionName} size={size} color={color || theme.text} style={style} />;
}

export default Icon;

// Bell icon for notifications
{
  name: 'bell',
  component: (props) => (
    <Svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
    </Svg>
  ),
}
