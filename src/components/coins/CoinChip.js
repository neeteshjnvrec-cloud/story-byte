// Coin balance in a header; opens the Coins screen.
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { useWallet } from '../../context/WalletContext';
import { AppText } from '../ui/AppText';

export function CoinChip() {
  const navigation = useNavigation();
  const { theme } = useTheme() || { theme: {} };
  const { wallet, balance } = useWallet();
  if (!wallet) return null;
  return (
    <Pressable
      onPress={() => navigation.navigate('Coins')}
      hitSlop={6}
      style={[styles.chip, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}
      accessibilityRole="button"
      accessibilityLabel={`${balance} coins. Open coins`}
    >
      <AppText variant="label" color="accent">🪙 {balance}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, borderWidth: 1, marginRight: 4 },
});

export default CoinChip;
