// Coins — balance, the 7-day check-in streak, ways to earn, the invite code
// (share it / redeem a friend's) and the coin history.
import React, { useCallback, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet, Share, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useWallet } from '../context/WalletContext';
import { AppText } from '../components/ui/AppText';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { sharedAppLink } from '../utils/shareStory';
import {
  CHECKIN_COINS, STREAK_BONUS_COINS, FINISH_COINS, FINISHES_PER_DAY, INVITEE_COINS, INVITER_COINS,
  INVITE_WINDOW_DAYS, hasCheckedInToday, nextStreak, finishesLeftToday, canRedeemInvite,
} from '../services/wallet';

const HISTORY_LABEL = {
  welcome: 'Welcome bonus', checkin: 'Daily check-in', finish: 'Finished a story',
  invite: 'Friend joined with your code', invited: 'Joined with an invite code', unlock: 'Unlocked an episode',
};

export function CoinsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { wallet, balance, checkIn, redeemInvite, history } = useWallet();
  const [entries, setEntries] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const loadHistory = useCallback(() => {
    history().then(setEntries).catch(() => setEntries([]));
  }, [history]);
  useFocusEffect(loadHistory);

  const checkedIn = hasCheckedInToday(wallet);
  // Where today sits in the 7-day cycle: after checking in, the streak itself;
  // before, the day a check-in now would reach.
  const streakToday = checkedIn ? wallet?.streak || 0 : nextStreak(wallet);
  const cycleDay = ((streakToday - 1) % 7) + 1;

  const doCheckIn = async () => {
    setBusy(true);
    try {
      await checkIn();
      loadHistory();
    } catch (e) {
      Alert.alert('Check-in didn’t go through', 'Please check your connection and phone’s date/time, then try again.');
    } finally { setBusy(false); }
  };

  const shareCode = () => Share.share({
    message: `🙏 StoryByte पर रोज़ नई कथा सुनिए! मेरा invite code ${wallet?.inviteCode} डालें और ${INVITEE_COINS} coins पाएं: ${sharedAppLink('invite')}`,
  }).catch(() => {});

  const redeem = async () => {
    setBusy(true);
    try {
      await redeemInvite(code);
      setCode('');
      loadHistory();
    } catch (e) {
      Alert.alert('Invite code', e.message);
    } finally { setBusy(false); }
  };

  if (!wallet) {
    return <View style={[styles.center, { backgroundColor: theme.background }]}><ActivityIndicator color={theme.accent} /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.head, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityLabel="Back"><Icon name="chev-left" /></Pressable>
        <AppText variant="h2">Coins</AppText>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 140 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.balanceCard, { backgroundColor: theme.accent }]}>
          <AppText variant="caption" style={{ color: theme.onAccent, opacity: 0.85 }}>Your coins</AppText>
          <AppText variant="displayL" style={{ color: theme.onAccent }}>🪙 {balance}</AppText>
          <AppText variant="caption" style={{ color: theme.onAccent, opacity: 0.85 }}>Keep your streak going — rewards coming soon</AppText>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.rowBetween}>
            <AppText variant="h3">Daily check-in</AppText>
            <AppText variant="caption" color="textSecondary">🔥 {wallet.streak || 0}-day streak</AppText>
          </View>
          <View style={styles.days}>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => {
              const done = d < cycleDay || (d === cycleDay && checkedIn);
              const isToday = d === cycleDay;
              return (
                <View key={d} style={[styles.day, {
                  backgroundColor: done ? theme.accent : theme.background,
                  borderColor: isToday ? theme.accent : theme.border,
                }]}>
                  <AppText variant="micro" color={done ? 'onAccent' : 'textSecondary'}>Day {d}</AppText>
                  <AppText variant="label" color={done ? 'onAccent' : 'text'}>{d === 7 ? STREAK_BONUS_COINS : CHECKIN_COINS}</AppText>
                </View>
              );
            })}
          </View>
          <Button
            title={checkedIn ? 'Checked in today ✓ Come back tomorrow' : `Claim today’s ${cycleDay === 7 ? STREAK_BONUS_COINS : CHECKIN_COINS} coins`}
            onPress={doCheckIn}
            disabled={checkedIn}
            loading={busy && !checkedIn}
            style={{ marginTop: 14 }}
          />
          <AppText variant="caption" color="textSecondary" style={{ marginTop: 8 }}>
            Missing a day starts the streak again from day 1.
          </AppText>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <AppText variant="h3" style={{ marginBottom: 6 }}>More ways to earn</AppText>
          <EarnRow theme={theme} icon="headset-outline" title={`Finish a story: +${FINISH_COINS}`}
            note={`Listen to the end. ${finishesLeftToday(wallet)} of ${FINISHES_PER_DAY} left today.`} />
          <EarnRow theme={theme} icon="people-outline" title={`Invite a friend: +${INVITER_COINS}`}
            note={`They get +${INVITEE_COINS} when they enter your code.`} />
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <AppText variant="h3">Your invite code</AppText>
          <View style={[styles.codeBox, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}>
            <AppText variant="h1" color="accent" style={{ letterSpacing: 4 }} selectable>{wallet.inviteCode}</AppText>
          </View>
          <AppText variant="caption" color="textSecondary">
            {wallet.inviteCount ? `${wallet.inviteCount} friend${wallet.inviteCount === 1 ? '' : 's'} joined so far.` : 'Share it with friends and family who love kathas.'}
          </AppText>
          <Button title="Share invite" leftIcon="share" onPress={shareCode} style={{ marginTop: 12 }} />

          {canRedeemInvite(wallet) ? (
            <View style={{ marginTop: 18 }}>
              <AppText variant="label">Got a code from a friend?</AppText>
              <AppText variant="caption" color="textSecondary" style={{ marginBottom: 8 }}>
                Enter it within {INVITE_WINDOW_DAYS} days of joining for +{INVITEE_COINS} coins.
              </AppText>
              <Input icon="people" value={code} onChangeText={(t) => setCode(t.toUpperCase())}
                placeholder="Invite code" autoCapitalize="characters" maxLength={10} />
              <Button title="Redeem" variant="ghost" onPress={redeem} loading={busy} disabled={code.trim().length < 6} style={{ marginTop: 10 }} />
            </View>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <AppText variant="h3" style={{ marginBottom: 6 }}>History</AppText>
          {entries === null ? <ActivityIndicator color={theme.accent} /> : entries.length === 0 ? (
            <AppText variant="caption" color="textSecondary">No coin activity yet.</AppText>
          ) : entries.map((e) => (
            <View key={e.id} style={[styles.historyRow, { borderBottomColor: theme.divider }]}>
              <View style={{ flex: 1 }}>
                <AppText variant="body" numberOfLines={1}>{HISTORY_LABEL[e.type] || e.type}</AppText>
                {e.title ? <AppText variant="caption" color="textSecondary" numberOfLines={1}>{e.title}</AppText> : null}
              </View>
              <AppText variant="label" style={{ color: e.amount < 0 ? theme.error : theme.success }}>
                {e.amount > 0 ? `+${e.amount}` : e.amount}
              </AppText>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function EarnRow({ theme, icon, title, note }) {
  return (
    <View style={styles.earnRow}>
      <View style={[styles.earnIcon, { backgroundColor: theme.accentSoft }]}><Icon name={icon} size={18} color={theme.accent} /></View>
      <View style={{ flex: 1 }}>
        <AppText variant="label">{title}</AppText>
        <AppText variant="caption" color="textSecondary">{note}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  balanceCard: { borderRadius: 22, padding: 22, alignItems: 'center', gap: 4 },
  card: { marginTop: 16, borderRadius: 18, borderWidth: 1, padding: 16 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  days: { flexDirection: 'row', gap: 6, marginTop: 12 },
  day: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, gap: 2 },
  earnRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  earnIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  codeBox: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginVertical: 10 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});

export default CoinsScreen;
