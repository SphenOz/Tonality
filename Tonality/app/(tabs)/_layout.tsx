import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
    return (
        <Tabs screenOptions={{
            tabBarActiveTintColor: '#1DB954',
            tabBarInactiveTintColor: '#B3B3B3',
            tabBarStyle: {
                backgroundColor: '#121212',
                borderTopColor: '#282828',
            },
            headerShown: false
        }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="song-of-day"
                options={{
                    title: 'Song of Day',
                    tabBarIcon: ({ color }) => <Ionicons name="musical-note" size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="polls"
                options={{
                    title: 'Polls',
                    tabBarIcon: ({ color }) => <Ionicons name="stats-chart" size={24} color={color} />,
                }}
            />
        </Tabs>
    );
}
