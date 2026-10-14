// Home's daily check-in prompt; hidden once today's coins are claimed.
import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useWallet } from '../../context/WalletContext';
import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';
import { hasCheckedInToday, nextStreak, checkInReward } from '../../services/wallet';

export function CheckInCard() {
  const { theme } = useTheme() || { theme: {} };
  const { wallet, checkIn } = useWallet();
  const [busy, setBusy] = useState(false);
  if (!wallet || hasCheckedInToday(wallet)) return null;
  const streak = nextStreak(wallet);
  const coins = checkInReward(streak);

  const claim = async () => {
    setBusy(true);
    try { await checkIn(); } catch (e) {
      Alert.alert('Check-in didn’t go through', 'Please check your connection and phone’s date/time, then try again.');
    } finally { setBusy(false); }
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
      <View style={{ flex: 1 }}>
        <AppText variant="h3">🔥 Day {((streak - 1) % 7) + 1} check-in</AppText>
        <AppText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
          {coins > 5 ? `7-day streak bonus: ${coins} coins!` : `Claim ${coins} coins · day 7 pays 25`}
        </AppText>
      </View>
      <Button title={`+${coins}`} size="small" onPress={claim} loading={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 14,
    padding: 14, borderRadius: 16, borderWidth: 1,
  },
});

export default CheckInCard;
