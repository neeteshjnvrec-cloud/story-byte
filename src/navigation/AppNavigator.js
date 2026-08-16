// Navigation configuration for StoryByte
// Bottom tab navigation with Home, Search, Favorites, Profile
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { HomeScreen } from '../screens/HomeScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { FavoritesScreen } from '../screens/FavoritesScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

// Fallback theme in case context is not available
const FALLBACK_THEME = {
  accent: '#667eea',
  card: '#1e1e1e',
  border: '#2a2a2a',
};

// Emoji-based tab icons (no icon library dependency)
const TabIcon = ({ icon, color }) => (
  <Text style={{ fontSize: 22, color }}>{icon}</Text>
);

export function AppNavigator() {
  const { theme, isDark } = useTheme() || { theme: FALLBACK_THEME, isDark: true };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.accent || FALLBACK_THEME.accent,
        tabBarInactiveTintColor: isDark ? '#666' : '#999',
        tabBarStyle: {
          backgroundColor: theme.card || FALLBACK_THEME.card,
          borderTopColor: theme.border || FALLBACK_THEME.border,
        },
        tabBarIcon: ({ color }) => {
          const icons = {
            Home: '🏠',
            Search: '🔍',
            Favorites: '❤️',
            Profile: '👤'
          };
          return <TabIcon icon={icons[route.name]} color={color} />;
        }
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Favorites" component={FavoritesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default AppNavigator;
