import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { HabitView } from '../../../shared/src/api.ts';
import { FONT, lane } from '../lib/theme.ts';
import { useTheme } from '../lib/useTheme.ts';

const clock = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const DAYS = 'MTWTFSS';
const daysText = (m: number) => DAYS.split('').map((c, i) => (m & (1 << i) ? c : '·')).join('');

export function BranchRow({ h, pending, onTap }: { h: HabitView; pending: boolean; onTap: (h: HabitView) => void }) {
  const t = useTheme();
  const c = lane(t, h.lane);
  const state = pending ? 'done' : h.entry && h.entry.kind !== 'miss' ? h.entry.kind : 'open';
  const sub = h.remind_at ? `remind ${h.remind_at}` : h.days_mask === 127 ? 'every day' : daysText(h.days_mask);

  return (
    <Pressable
      onPress={() => { if (state !== 'open') return; Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onTap(h); }}
      style={({ pressed }) => [s.row, { backgroundColor: pressed ? t.surface2 : t.surface, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
      accessibilityRole="button" accessibilityLabel={`${h.slug}, ${state}`}>
      {state === 'rest'
        ? <View style={[s.rest, { backgroundColor: t.rest }]} />
        : <View style={[s.node, { borderColor: c, backgroundColor: state === 'done' ? c : 'transparent', opacity: h.patina ? 1 - h.patina * 0.15 : 1 }]} />}
      <View style={s.mid}>
        <Text style={[s.name, { color: t.text }]} numberOfLines={1}>{h.emoji ? `${h.emoji} ` : ''}{h.slug}</Text>
        <Text style={[s.sub, { color: t.dim }]}>{sub}</Text>
      </View>
      <View style={s.right}>
        {state === 'rest'
          ? <><Text style={[s.restTxt, { color: t.rest }]}>rest</Text><Text style={[s.hash, { color: t.dim }]}>--allow-empty</Text></>
          : <>
            <Text style={[s.streak, { color: t.text }]}>{h.streak}<Text style={[s.d, { color: t.dim }]}>d{'~'.repeat(h.patina)}</Text></Text>
            <Text style={[s.hash, { color: state === 'done' ? c : t.muted }]}>
              {state === 'done' ? (pending || !h.entry ? '·······' : `${h.entry.hash} · ${clock(h.entry.created_at)}`) : 'tap →'}
            </Text>
          </>}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, height: 76, paddingHorizontal: 18, borderRadius: 22 },
  node: { width: 24, height: 24, borderRadius: 12, borderWidth: 2.5 },
  rest: { width: 18, height: 18, borderRadius: 6, marginHorizontal: 3 },
  mid: { flex: 1, minWidth: 0 },
  name: { fontFamily: FONT.mono, fontSize: 18, fontWeight: '500' },
  sub: { fontFamily: FONT.mono, fontSize: 11, marginTop: 3 },
  right: { alignItems: 'flex-end' },
  streak: { fontFamily: FONT.display, fontSize: 22, fontVariant: ['tabular-nums'] },
  d: { fontFamily: FONT.mono, fontSize: 14 },
  restTxt: { fontFamily: FONT.mono, fontSize: 15 },
  hash: { fontFamily: FONT.mono, fontSize: 11, marginTop: 2 },
});
