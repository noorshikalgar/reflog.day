import '../src/lib/polyfill.ts';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { loadSession, useStore } from '../src/lib/store.ts';
import { useTheme } from '../src/lib/useTheme.ts';

export default function RootLayout() {
  useEffect(() => { loadSession(); }, []);
  const ready = useStore(s => s.ready);
  const paired = useStore(s => !!s.token);
  const t = useTheme();
  if (!ready) return null;

  return (
    <>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Protected guard={paired}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={!paired}>
          <Stack.Screen name="pair" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
