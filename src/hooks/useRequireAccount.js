// For actions that need an account (save, like, rate, comment, create,
// coins): returns true when signed in; for a guest it offers sign in instead
// and returns false.
//
//   const requireAccount = useRequireAccount();
//   if (!requireAccount('Sign in to save stories to your library.')) return;
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppContext } from '../context/AppContext';

export function useRequireAccount() {
  const { user } = useAppContext();
  const navigation = useNavigation();
  return useCallback((reason, { beforeSignIn } = {}) => {
    if (user) return true;
    Alert.alert('Sign in to continue', reason, [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Sign in',
        onPress: () => {
          beforeSignIn?.();
          navigation.navigate('Login');
        },
      },
    ]);
    return false;
  }, [user, navigation]);
}
