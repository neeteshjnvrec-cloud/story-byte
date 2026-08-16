// Button — primary (solid accent) / ghost (bordered) with optional icon + loading.
import React from 'react';
import { Pressable, ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from './AppText';
import { Icon } from './Icon';

export function Button({ title, onPress, variant = 'primary', loading, disabled, leftIcon, size = 'md', style }) {
  const { theme } = useTheme() || { theme: {} };
  const primary = variant === 'primary';
  const bg = primary ? theme.accent : theme.card;
  const fg = primary ? 'onAccent' : 'text';
  const off = disabled || loading;
  const compact = size === 'small';
  const shadow = primary
    ? { shadowColor: theme.accent, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 4 }
    : null;

  return (
    <Pressable
      onPress={off ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      style={({ pressed }) => [
        styles.btn,
        compact && styles.btnSmall,
        { backgroundColor: bg, borderColor: primary ? bg : theme.border, borderWidth: primary ? 0 : 1 },
        shadow,
        pressed && !off && { opacity: 0.92, transform: [{ scale: 0.995 }] },
        off && { opacity: 0.6 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? theme.onAccent : theme.accent} size={compact ? 'small' : 'small'} />
      ) : (
        <View style={styles.row}>
          {leftIcon ? <Icon name={leftIcon} size={compact ? 17 : 19} color={primary ? theme.onAccent : theme.accent} /> : null}
          <AppText variant="label" color={fg} style={[compact && styles.labelSmall, { fontSize: compact ? 14 : 15 }]}>{title}</AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: 15, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14 },
  labelSmall: { fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
});

export default Button;
