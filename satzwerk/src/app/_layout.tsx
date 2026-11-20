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
import { AppLockOverlay } from '@/components/lock-gate';
import { initRestAlerts } from '@/lib/rest-alerts';
import { subscribeAutoLock } from '@/stores/app-lock';
import { useActiveWorkout } from '@/stores/active-workout';
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
      await useActiveWorkout.getState().hydrate();
      await initRestAlerts().catch(() => {});
      subscribeAutoLock();
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
          <Stack.Screen name="routine/[id]" options={{ title: 'Routine' }} />
          <Stack.Screen name="workout/active" options={{ title: 'Workout', gestureEnabled: false }} />
          <Stack.Screen name="workout/finish" options={{ title: 'Workout abschließen', presentation: 'modal' }} />
          <Stack.Screen name="workout/[id]" options={{ title: 'Workout' }} />
          <Stack.Screen name="review" options={{ title: 'Rückblick' }} />
          <Stack.Screen name="body/index" options={{ title: 'Körper' }} />
          <Stack.Screen name="body/measure" options={{ title: 'Messung', presentation: 'modal' }} />
          <Stack.Screen name="body/metric/[key]" options={{ title: 'Maß' }} />
          <Stack.Screen name="body/photos" options={{ title: 'Fototagebuch' }} />
          <Stack.Screen name="body/photo/[id]" options={{ title: 'Foto' }} />
          <Stack.Screen name="body/compare" options={{ title: 'Vorher / Nachher' }} />
          <Stack.Screen name="habits/index" options={{ title: 'Gewohnheiten' }} />
          <Stack.Screen name="habits/edit" options={{ title: 'Gewohnheit', presentation: 'modal' }} />
          <Stack.Screen name="habits/[id]" options={{ title: 'Gewohnheit' }} />
          <Stack.Screen name="goals/index" options={{ title: 'Ziele' }} />
          <Stack.Screen name="goals/edit" options={{ title: 'Ziel', presentation: 'modal' }} />
          <Stack.Screen name="goals/[id]" options={{ title: 'Ziel' }} />
          <Stack.Screen name="ai/index" options={{ title: 'KI-Trainingsplan' }} />
          <Stack.Screen name="ai/prompt" options={{ title: 'KI-Plan' }} />
          <Stack.Screen name="ai/import" options={{ title: 'KI-Plan importieren' }} />
        </Stack>
        <AppLockOverlay />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
