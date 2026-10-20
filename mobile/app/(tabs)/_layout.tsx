import { NativeTabs } from 'expo-router/native-tabs';
import { useTheme } from '../../src/lib/useTheme.ts';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <NativeTabs tintColor={t.ok} labelStyle={{ fontSize: 10, fontWeight: "500" }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'smallcircle.circle', selected: 'smallcircle.filled.circle' }} md="radio_button_checked" />
        <NativeTabs.Trigger.Label>status</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="log">
        <NativeTabs.Trigger.Icon sf="arrow.triangle.branch" md="commit" />
        <NativeTabs.Trigger.Label>log</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="branches">
        <NativeTabs.Trigger.Icon sf="list.bullet" md="list" />
        <NativeTabs.Trigger.Label>branches</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="person" />
        <NativeTabs.Trigger.Label>profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
