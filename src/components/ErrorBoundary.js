// App-wide error boundary — catches render/runtime errors so a single screen
// crash shows a recoverable message instead of a white screen.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info?.componentStack);
  }

  handleReset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>😔</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message} numberOfLines={4}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  message: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  button: { backgroundColor: '#818CF8', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 },
  buttonText: { color: '#0B0B10', fontSize: 15, fontWeight: '700' },
});

export default ErrorBoundary;
