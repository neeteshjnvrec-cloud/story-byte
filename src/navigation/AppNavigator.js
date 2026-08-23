// Bottom tab navigation: Home · Browse · Community · Create · Library · Profile
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { FONTS } from '../theme/tokens';
import { HomeScreen } from '../screens/HomeScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { CommunityScreen } from '../screens/CommunityScreen';
import { CreateStoryScreen } from '../screens/CreateStoryScreen';
import { FavoritesScreen } from '../screens/FavoritesScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const ICONS = {
  Home: 'home',
  Browse: 'search',
  Community: 'people',
  Create: 'create',
  Library: 'library',
  Profile: 'person',
};

export function AppNavigator() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.tabBarActive,
        tabBarInactiveTintColor: theme.tabBarInactive,
        tabBarLabelStyle: { fontFamily: FONTS.bodySemi, fontSize: 9, marginTop: 2 },
        // Six tabs at the default item padding truncated the longest label
        // ("Community" → "Commun…"); reclaim the horizontal padding instead.
        tabBarItemStyle: { paddingHorizontal: 0 },
        // Android stacks the tab bar on top of the keyboard, so a focused field
        // loses another ~58dp of the little room it has. Nothing here is
        // reachable mid-typing anyway. No-op on iOS.
        tabBarHideOnKeyboard: true,
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
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen name="Create" component={CreateStoryScreen} />
      <Tab.Screen name="Library" component={FavoritesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default AppNavigator;
