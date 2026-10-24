// Icon — thin wrapper over @expo/vector-icons (Ionicons) with semantic names
// so screens don't hardcode the icon library. Add names here as needed.
import React from 'react';
import { Platform } from 'react-native';
// Only the Ionicons set: '@expo/vector-icons' itself bundles all 15 icon
// fonts (~3.9 MB), and Ionicons is the only one the app uses.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../hooks/useTheme';

// The share glyph is the one icon users read as "the OS share button", so it
// follows the platform instead of picking one look for both: iOS expects the
// box-with-an-up-arrow, Android the three-node graph. Anything else (a paper
// plane, say) reads as "send a DM to one person" rather than "share anywhere".
const SHARE_ICON = Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline';

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
  share: SHARE_ICON, send: 'paper-plane-outline',
  bookmark: 'bookmark-outline', 'bookmark-fill': 'bookmark',
  moon: 'moon-outline', sun: 'sunny-outline',
  star: 'star', 'star-outline': 'star-outline',
  gear: 'settings-outline', settings: 'settings-outline',
  timer: 'timer-outline', lock: 'lock-closed-outline',
  eye: 'eye-outline', 'eye-off': 'eye-off-outline', mail: 'mail-outline',
  'chev-down': 'chevron-down', 'chev-left': 'chevron-back', 'chev-right': 'chevron-forward',
  flame: 'flame', bell: 'notifications-outline', globe: 'globe-outline', whatsapp: 'logo-whatsapp',
  telegram: 'paper-plane',
  'bell-slash': 'notifications-off-outline', 'bell-off': 'notifications-off-outline',
  info: 'information-circle-outline', trash: 'trash-outline',
  people: 'people-outline', sparkles: 'sparkles',
  headphones: 'headset-outline', speed: 'speedometer-outline', queue: 'list',
  note: 'musical-notes', volume: 'volume-medium', book: 'book-outline',
  plus: 'add', close: 'close', 'x': 'close', more: 'ellipsis-horizontal',
  chat: 'chatbubble-outline', comment: 'chatbubble-outline', 'chat-fill': 'chatbubble',
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

