// Bottom tab navigation: Home · Browse · Library · Profile
import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { FONTS } from '../theme/tokens';
import { HomeScreen } from '../screens/HomeScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { FavoritesScreen } from '../screens/FavoritesScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { notificationDb } from '../services/notificationDb';
import { HeaderNotificationButton } from '../components/HeaderNotificationButton';

const Tab = createBottomTabNavigator();

const ICONS = {
  Home: 'home',
  Browse: 'search',
  Library: 'library',
  Profile: 'person',
};

export function AppNavigator() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const loadCount = async () => {
      try {
        const count = await notificationDb.getUnreadCount();
        setUnreadCount(count);
      } catch (e) {
        console.error('Failed to load notification count:', e);
      }
    };
    loadCount();
    const interval = setInterval(loadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.tabBarActive,
        tabBarInactiveTintColor: theme.tabBarInactive,
        tabBarLabelStyle: { fontFamily: FONTS.bodySemi, fontSize: 10, marginTop: 2 },
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          height: 58 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom || 10,
        },
        tabBarIcon: ({ color, focused }) => {
          const base = ICONS[route.name] || 'ellipse';
          const name = focused ? base : `${base}-outline`;
          return <Ionicons name={name} size={23} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Browse" component={SearchScreen} />
      <Tab.Screen 
        name="Library" 
        component={FavoritesScreen}
        options={{
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#E53E3E' },
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          headerShown: true,
          headerTitle: 'Profile',
          headerRight: () => <HeaderNotificationButton />,
        }}
      />
    </Tab.Navigator>
  );
}

export default AppNavigator;
