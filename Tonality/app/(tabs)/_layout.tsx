import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useTonalityAuth } from '../../hooks/useTonalityAuth';

export default function TabLayout() {
    const { theme } = useTheme();
    const { isAuthenticated, loading } = useTonalityAuth();

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
                },
                headerShown: false,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color }) => <Ionicons name="home" size={22} color={color} />,
                }}
            />
            <Tabs.Screen
                name="song-of-day"
                options={{
                    title: 'Song of Day',
                    tabBarIcon: ({ color }) => <Ionicons name="musical-note" size={22} color={color} />,
                }}
            />
            <Tabs.Screen
                name="polls"
                options={{
                    title: 'Polls',
                    tabBarIcon: ({ color }) => <Ionicons name="stats-chart" size={22} color={color} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color }) => <Ionicons name="person" size={22} color={color} />,
                }}
            />
        </Tabs>
    );
}
