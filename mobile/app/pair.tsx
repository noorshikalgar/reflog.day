import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, refresh } from '../src/lib/api.ts';
import { saveSession } from '../src/lib/store.ts';
import { FONT } from '../src/lib/theme.ts';
import { useTheme } from '../src/lib/useTheme.ts';

export default function Pair() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [server, setServer] = useState('http://10.27.27.220:8742');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function pair() {
    setBusy(true); setError('');
    const base = server.trim().replace(/\/+$/, '');
    try {
      const { token } = await api.pair(base, code);
      if (!token) throw new Error('server too old: update reflog on the server');
      await saveSession(base, token);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refresh();
      router.replace('/');
    } catch (e) {
      setError((e as Error).message === 'Network request failed' ? 'cannot reach the server' : (e as Error).message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={[s.wrap, { backgroundColor: t.bg, paddingTop: insets.top + 48 }]}>
      <Text style={[s.cmd, { color: t.muted }]}>$ git remote add this-iphone</Text>
      <Text style={[s.h1, { color: t.text }]}>pair device</Text>
      <Text style={[s.p, { color: t.muted }]}>Server address, then the 6-digit code from the server log or Profile → Devices.</Text>

      <Text style={[s.label, { color: t.dim }]}>SERVER</Text>
      <TextInput value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} keyboardType="url"
        style={[s.input, { backgroundColor: t.surface, color: t.text, borderColor: t.line }]} placeholderTextColor={t.dim} />

      <Text style={[s.label, { color: t.dim }]}>CODE</Text>
      <TextInput value={code} onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode"
        placeholder="000000" placeholderTextColor={t.dim} maxLength={6}
        style={[s.input, s.code, { backgroundColor: t.surface, color: t.text, borderColor: t.line }]} />

      <Pressable disabled={busy || code.length !== 6} onPress={pair}
        style={({ pressed }) => [s.btn, { backgroundColor: t.ok, opacity: code.length !== 6 ? 0.4 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
        {busy ? <ActivityIndicator color={t.onOk} /> : <Text style={[s.btnText, { color: t.onOk }]}>pair</Text>}
      </Pressable>
      <Text style={[s.err, { color: t.muted }]}>{error}</Text>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 20 },
  cmd: { fontFamily: FONT.mono, fontSize: 12 },
  h1: { fontFamily: FONT.display, fontSize: 44, fontWeight: '300', letterSpacing: -1.2, marginTop: 4, marginBottom: 10 },
  p: { fontSize: 15, lineHeight: 21, marginBottom: 24 },
  label: { fontSize: 12, fontWeight: '500', letterSpacing: 0.6, marginBottom: 6, marginLeft: 4 },
  input: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, height: 54, fontSize: 16, fontFamily: FONT.mono, marginBottom: 18 },
  code: { fontSize: 30, letterSpacing: 10, textAlign: 'center', height: 72 },
  btn: { height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnText: { fontFamily: FONT.mono, fontSize: 16, fontWeight: '600' },
  err: { fontFamily: FONT.mono, fontSize: 13, textAlign: 'center', marginTop: 14 },
});
