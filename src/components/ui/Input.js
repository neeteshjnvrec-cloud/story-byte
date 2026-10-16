// Input — cream field with a leading icon, optional password reveal and an
// optional label above it; the border takes the accent colour while typing.
import React, { useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { FONTS } from '../../theme/tokens';
import { Icon } from './Icon';
import { AppText } from './AppText';

export function Input({ icon, secure, value, onChangeText, placeholder, style, label, onFocus, onBlur, ...rest }) {
  const { theme } = useTheme() || { theme: {} };
  const [hidden, setHidden] = useState(!!secure);
  const [focused, setFocused] = useState(false);

  const field = (
    <View style={[styles.field, { backgroundColor: theme.card, borderColor: focused ? theme.accent : theme.border }, label && { marginBottom: 0 }, style]}>
      {icon ? <Icon name={icon} size={19} color={theme.textSecondary} /> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textTertiary}
        secureTextEntry={hidden}
        style={[styles.input, { color: theme.text }]}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        {...rest}
      />
      {secure ? (
        <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
          <Icon name={hidden ? 'eye' : 'eye-off'} size={19} color={theme.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
  if (!label) return field;
  return (
    <View style={{ marginBottom: 14 }}>
      <AppText variant="label" color="textSecondary" style={styles.label}>{label}</AppText>
      {field}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 6, marginBottom: 12,
  },
  input: { flex: 1, fontFamily: FONTS.body, fontSize: 15, paddingVertical: 13 },
  label: { fontSize: 13, marginBottom: 6, marginLeft: 2 },
});

export default Input;
