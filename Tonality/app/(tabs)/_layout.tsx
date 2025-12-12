import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useTonalityAuth } from '../../hooks/useTonalityAuth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
    const { theme } = useTheme();
    const { isAuthenticated, loading } = useTonalityAuth();
    const insets = useSafeAreaInsets();

    if (loading || !isAuthenticated) {
        return null;
    }

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: theme.colors.accent,
                tabBarInactiveTintColor: theme.colors.textMuted,
                tabBarStyle: {
                    backgroundColor: theme.colors.tabBar,
                    borderTopColor: theme.colors.tabBorder,
                    paddingTop: 0,
                    paddingBottom: (insets.bottom || 0) + 6,
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                },
                headerShown: false,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color }) => (
                        <Ionicons name="home" size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="friends"
                options={{
                    title: 'Friends',
                    tabBarIcon: ({ color }) => (
                        <Ionicons name="person-add" size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="community"
                options={{
                    title: 'Community',
                    tabBarIcon: ({ color }) => (
                        <Ionicons name="people" size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color }) => (
                        <Ionicons name="person-circle" size={22} color={color} />
                    ),
                }}
            />
            {/* Hidden tabs - accessible via navigation but not shown in tab bar */}
            <Tabs.Screen
                name="song-of-day"
                options={{ href: null }}
            />
            <Tabs.Screen
                name="polls"
                options={{ href: null }}
            />
        </Tabs>
    );
}
