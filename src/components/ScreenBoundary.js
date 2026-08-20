// Screen-level error boundary — catches errors in a single screen without
// breaking the entire app tree. Shows a themed error UI with a retry button.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export class ScreenBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('ScreenBoundary caught:', error?.message, info?.componentStack);
  }

  handleRetry = () => this.setState({ hasError: false });

  render() {
    const { theme } = useTheme() || { theme: {} };
    if (this.state.hasError) {
      return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          <Text style={[styles.title, { color: theme.text }]}>{'Something went wrong'}</Text>
          <Text style={[styles.msg, { color: theme.textSecondary }]}>{this.props.fallbackMsg || ''}</Text>
          <TouchableOpacity style={[styles.btn, { backgroundColor: theme.accent }]} onPress={this.handleRetry}>
            <Text style={[styles.btnText, { color: theme.onAccent }]}>{'Try again'}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  msg: { fontSize: 14, textAlign: 'center', marginBottom: 16, paddingHorizontal: 20 },
  btn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 },
  btnText: { fontSize: 14, fontWeight: '600' },
});

export default ScreenBoundary;
