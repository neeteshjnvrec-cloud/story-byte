// Input — cream field with a leading icon and optional password reveal.
import React, { useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { FONTS } from '../../theme/tokens';
import { Icon } from './Icon';

export function Input({ icon, secure, value, onChangeText, placeholder, style, ...rest }) {
  const { theme } = useTheme() || { theme: {} };
  const [hidden, setHidden] = useState(!!secure);

  return (
    <View style={[styles.field, { backgroundColor: theme.card, borderColor: theme.border }, style]}>
      {icon ? <Icon name={icon} size={19} color={theme.textSecondary} /> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textTertiary}
        secureTextEntry={hidden}
        style={[styles.input, { color: theme.text }]}
        {...rest}
      />
      {secure ? (
        <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
          <Icon name={hidden ? 'eye' : 'eye-off'} size={19} color={theme.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 6, marginBottom: 12,
  },
  input: { flex: 1, fontFamily: FONTS.body, fontSize: 15, paddingVertical: 13 },
});

export default Input;
