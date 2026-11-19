import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppText } from '@/components/ui';
import { initDatabase } from '@/db/client';
import { seedDatabase } from '@/db/seed';
import { useSettings } from '@/stores/settings';
import { palette } from '@/theme/colors';
import { useColorMode } from '@/theme/use-theme';

import migrations from '../../drizzle/migrations';

SplashScreen.preventAutoHideAsync().catch(() => {});

function useDatabaseReady() {
  const load = useSettings((s) => s.load);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const database = await initDatabase();
      await migrate(database, migrations);
      await seedDatabase(database);
      await load();
    })()
      .then(() => !cancelled && setReady(true))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e : new Error(String(e))));
    return () => {
      cancelled = true;
    };
  }, [load]);

  return { ready, error };
}

export default function RootLayout() {
  const { ready, error } = useDatabaseReady();
  const mode = useColorMode();
  const c = palette[mode];

  useEffect(() => {
    if (ready || error) SplashScreen.hideAsync().catch(() => {});
  }, [ready, error]);

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center', padding: 24, gap: 8 }}>
        <AppText variant="heading">Datenbank konnte nicht geladen werden</AppText>
        <AppText muted>{error.message}</AppText>
      </View>
    );
  }
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center' }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: c.accent,
      background: c.background,
      card: c.surface,
      text: c.text,
      border: c.border,
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navTheme}>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: c.background },
            headerShadowVisible: false,
            headerTintColor: c.text,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: c.background },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="exercise/[id]" options={{ title: 'Übung' }} />
          <Stack.Screen name="exercise/edit" options={{ title: 'Eigene Übung', presentation: 'modal' }} />
          <Stack.Screen name="settings/index" options={{ title: 'Einstellungen' }} />
          <Stack.Screen name="settings/equipment/index" options={{ title: 'Mein Equipment' }} />
          <Stack.Screen name="settings/equipment/[id]" options={{ title: 'Equipment-Profil' }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
