import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { Icon } from '@/components/ui';
import { useColors } from '@/theme/use-theme';

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.background },
        headerShadowVisible: false,
        headerTintColor: c.text,
        headerTitleStyle: { fontWeight: '800', fontSize: 22 },
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border, ...(Platform.OS === 'web' ? { height: 62 } : null) },
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textMuted,
        sceneStyle: { backgroundColor: c.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Training',
          tabBarIcon: ({ color, size }) => <Icon name="dumbbell" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          title: 'Übungen',
          tabBarIcon: ({ color, size }) => <Icon name="format-list-bulleted" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <Icon name="account-circle-outline" color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}
