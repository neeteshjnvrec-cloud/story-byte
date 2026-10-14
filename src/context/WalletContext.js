// Coins state for the signed-in listener: the wallet (live), which long
// episodes are unlocked, and the actions (check in, unlock, finish reward,
// invite). See src/services/wallet.js and the coin rules in
// firestore/firestore.rules.json.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from './AppContext';
import { useTheme } from '../hooks/useTheme';
import { AppText } from '../components/ui/AppText';
import * as wallet from '../services/wallet';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const { user } = useAppContext() || {};
  const uid = user?.uid || null;
  const [state, setState] = useState(null);
  const [unlocked, setUnlocked] = useState(() => new Set());
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    setState(null);
    setUnlocked(new Set());
    if (!uid) return undefined;
    let unsubscribe = () => {};
    let cancelled = false;
    (async () => {
      try {
        await wallet.ensureWallet(uid);
        if (cancelled) return;
        unsubscribe = wallet.subscribeWallet(uid, setState);
        setUnlocked(await wallet.getUnlockedIds(uid));
      } catch (e) {
        console.warn('[Wallet] load failed:', e?.message);
      }
    })();
    return () => { cancelled = true; unsubscribe(); };
  }, [uid]);

  const showToast = useCallback((text) => {
    clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const checkIn = useCallback(async () => {
    if (!uid) return null;
    const result = await wallet.checkIn(uid);
    if (result) showToast(`+${result.coins} coins · day ${result.streak} streak 🔥`);
    return result;
  }, [uid, showToast]);

  const unlock = useCallback(async (story) => {
    if (!uid) throw new Error('sign-in');
    const result = await wallet.unlockStory(uid, story);
    setUnlocked((prev) => new Set(prev).add(story.id));
    if (result?.price) showToast(`Unlocked for ${result.price} coins`);
    return result;
  }, [uid, showToast]);

  const rewardFinish = useCallback(async (story) => {
    if (!uid || !story?.id) return 0;
    try {
      const coins = await wallet.rewardFinish(uid, story);
      if (coins) showToast(`+${coins} coins for finishing the story`);
      return coins;
    } catch (e) {
      console.warn('[Wallet] finish reward:', e?.message);
      return 0;
    }
  }, [uid, showToast]);

  const redeemInvite = useCallback(async (code) => {
    const coins = await wallet.redeemInvite(uid, code);
    showToast(`+${coins} coins from your friend's invite`);
    return coins;
  }, [uid, showToast]);

  /** True when a story is free or already unlocked. */
  const canPlay = useCallback((story) => !wallet.isPaidStory(story) || unlocked.has(story.id), [unlocked]);

  const value = {
    wallet: state,
    balance: state?.balance ?? 0,
    unlocked,
    canPlay,
    checkIn,
    unlock,
    rewardFinish,
    redeemInvite,
    premiumAudioUrl: wallet.getPremiumAudioUrl,
    history: () => (uid ? wallet.getHistory(uid) : Promise.resolve([])),
    showToast,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
      <CoinToast text={toast} />
    </WalletContext.Provider>
  );
}

function CoinToast({ text }) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme() || { theme: {} };
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: text ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  }, [text]);
  if (!text) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.toast, { top: insets.top + 12, opacity, backgroundColor: theme.text }]}
      accessibilityLiveRegion="polite"
    >
      <AppText variant="label" style={{ color: theme.background }}>🪙 {text}</AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});

/** Coins state; a safe empty fallback outside the provider. */
export function useWallet() {
  return useContext(WalletContext) || {
    wallet: null, balance: 0, unlocked: new Set(), canPlay: () => true,
    checkIn: async () => null, unlock: async () => null, rewardFinish: async () => 0,
    redeemInvite: async () => 0, premiumAudioUrl: async () => null, history: async () => [], showToast: () => {},
  };
}
