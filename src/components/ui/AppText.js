// AppText — typed text. `variant` picks a ramp entry (tokens.type), `color`
// picks a theme token. Devanagari strings auto-route to the Noto font since
// the Fraunces/Inter faces don't cover the script.
import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { FONTS } from '../../theme/tokens';

const DEV = /[ऀ-ॿ]/;

const SERIF_VARIANTS = ['displayL', 'displayM', 'h1', 'h2'];

export function AppText({ variant = 'body', color = 'text', style, children, ...rest }) {
  const { theme, tokens } = useTheme();
  const spec = tokens.type[variant] || tokens.type.body;
  const c = theme[color] || color || theme.text;

  // Route Devanagari content to Noto (serif/sans headings included).
  let fontFamily = spec.fontFamily;
  if (typeof children === 'string' && DEV.test(children)) {
    fontFamily = SERIF_VARIANTS.includes(variant) ? FONTS.devSemi : FONTS.devBody;
  }

  return (
    <Text
      style={[{ ...spec, fontFamily, color: c }, style]}
      {...rest}
    >
      {children}
    </Text>
  );
}

export default AppText;
