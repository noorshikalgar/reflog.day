import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { AppState, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { HabitView } from '../../../shared/src/api.ts';
import { uuidv7 } from '../../../shared/src/ids.ts';
import { api, refresh } from '../../src/lib/api.ts';
import { getState, setState, useStore } from '../../src/lib/store.ts';
import { FONT } from '../../src/lib/theme.ts';
import { useTheme } from '../../src/lib/useTheme.ts';
import { BranchRow } from '../../src/ui/BranchRow.tsx';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const dayLabel = (day: string) => { const d = new Date(day + 'T00:00:00Z'); return `${DAYS[(d.getUTCDay() + 6) % 7]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };

export default function Status() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const today = useStore(s => s.today);
  const online = useStore(s => s.online);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [pulling, setPulling] = useState(false);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', st => st === 'active' && refresh());
    const timer = setInterval(refresh, 60_000);
    return () => { sub.remove(); clearInterval(timer); };
  }, []);

  const onPull = useCallback(async () => { setPulling(true); await refresh(); setPulling(false); }, []);

  const replace = (h: HabitView) => {
    const cur = getState().today;
    if (cur) setState({ today: { ...cur, habits: cur.habits.map(x => (x.id === h.id ? h : x)) } });
  };

  async function commit(h: HabitView) {
    setPending(p => new Set(p).add(h.id));
    try {
      const r = await api.putEntry(uuidv7(), { habit_id: h.id, kind: 'done' });
      replace(r.habit);
      const rows = (getState().today?.habits ?? []).filter(x => x.scheduled);
      if (rows.every(x => x.entry && x.entry.kind !== 'miss')) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setPending(p => { const n = new Set(p); n.delete(h.id); return n; });
    }
  }

  const rows = today?.habits.filter(h => h.scheduled) ?? [];
  const done = rows.filter(h => pending.has(h.id) || (h.entry && h.entry.kind !== 'miss')).length;
  const left = rows.length - done;

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={t.muted} />}>
      <View style={s.top}>
        <Text style={[s.topTxt, { color: t.muted }]}>{today ? dayLabel(today.day) : ''}</Text>
        <Text style={[s.topTxt, { color: t.muted }]}><Text style={{ color: online ? t.ok : t.miss }}>● </Text>{online ? 'synced' : 'offline'}</Text>
      </View>

      <Text style={[s.big, { color: t.text }]}>{done}<Text style={{ color: t.dim }}>/{rows.length}</Text></Text>
      <Text style={[s.state, { color: t.muted }]}>
        {left === 0 && rows.length
          ? <>working tree clean.{'\n'}<Text style={{ color: t.ok }}>all {rows.length} branches pushed.</Text></>
          : <>on branch <Text style={{ color: t.ok }}>today</Text>{'\n'}{left} change{left === 1 ? '' : 's'} not committed</>}
      </Text>

      <View style={s.rows}>
        {rows.map(h => <BranchRow key={h.id} h={h} pending={pending.has(h.id)} onTap={commit} />)}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  topTxt: { fontFamily: FONT.mono, fontSize: 12 },
  big: { fontFamily: FONT.display, fontSize: 104, fontWeight: '300', letterSpacing: -5, fontVariant: ['tabular-nums'], marginTop: 18 },
  state: { fontFamily: FONT.mono, fontSize: 13, lineHeight: 20, marginTop: 4 },
  rows: { gap: 10, marginTop: 22 },
});
