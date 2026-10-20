import { StyleSheet, Text, View } from 'react-native';
import { FONT } from '../../src/lib/theme.ts';
import { useTheme } from '../../src/lib/useTheme.ts';

export default function Screen() {
  const t = useTheme();
  return (
    <View style={[s.wrap, { backgroundColor: t.bg }]}>
      <Text style={[s.h, { color: t.text }]}>log</Text>
      <Text style={[s.p, { color: t.dim }]}>coming in the next phase (docs/11 §9)</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  h: { fontFamily: FONT.display, fontSize: 34, fontWeight: '300' },
  p: { fontFamily: FONT.mono, fontSize: 12, marginTop: 6 },
});
