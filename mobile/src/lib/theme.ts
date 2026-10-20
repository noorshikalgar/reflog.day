// Design tokens. Same values as web/src/lib/theme.css (the source of truth).
import type { Theme } from '../../../shared/src/api.ts';

export type Tokens = {
  bg: string; surface: string; surface2: string; line: string; text: string; muted: string; dim: string;
  ok: string; onOk: string; rest: string; miss: string; ring: [string, string, string]; lanes: string[]; dark: boolean;
};

export const THEMES: Record<Theme, Tokens> = {
  terminal: {
    bg: '#0b0d12', surface: '#12151c', surface2: '#1a1e28', line: '#252a36', text: '#e7e9ee', muted: '#8b92a1', dim: '#788092',
    ok: '#3ddc97', onOk: '#05130c', rest: '#f2b84b', miss: '#798194', ring: ['#3ddc97', '#4cc9f0', '#a78bfa'],
    lanes: ['#3ddc97', '#4cc9f0', '#a78bfa', '#ff9f5a', '#f472b6', '#6ea8ff', '#c3e88d', '#2dd4bf', '#ff8a80', '#b8c4d8'], dark: true,
  },
  bathory: {
    bg: '#000000', surface: '#0e0e0e', surface2: '#222222', line: '#222222', text: '#f1f1f1', muted: '#999999', dim: '#7c7c7c',
    ok: '#fbcb97', onOk: '#000000', rest: '#e78a43', miss: '#7d7d7d', ring: ['#fbcb97', '#e78a43', '#8fb3b3'],
    lanes: ['#fbcb97', '#e78a43', '#5f8787', '#c1c1c1', '#9b99a3', '#d9a679', '#8fb3b3', '#aaaaaa', '#b5776a', '#888888'], dark: true,
  },
  gruvbox: {
    bg: '#282828', surface: '#32302f', surface2: '#3c3836', line: '#504945', text: '#ebdbb2', muted: '#bdae93', dim: '#a3978c',
    ok: '#b8bb26', onOk: '#1d2021', rest: '#fabd2f', miss: '#a4978b', ring: ['#b8bb26', '#83a598', '#d3869b'],
    lanes: ['#b8bb26', '#83a598', '#d3869b', '#fe8019', '#8ec07c', '#56a6aa', '#a1a01b', '#74a576', '#c489a4', '#f17626'], dark: true,
  },
  paper: {
    bg: '#f5f4ef', surface: '#ffffff', surface2: '#ecebe5', line: '#dcdad2', text: '#1a1d24', muted: '#4f5562', dim: '#686f7a',
    ok: '#117d4e', onOk: '#ffffff', rest: '#966319', miss: '#666d7e', ring: ['#117d4e', '#0a769c', '#6d4fd8'],
    lanes: ['#107d4e', '#0a769c', '#6d4fd8', '#b25210', '#c0307a', '#2a5fd0', '#517813', '#0d7a6d', '#c2463c', '#56657e'], dark: false,
  },
};

export const lane = (t: Tokens, n: number) => t.lanes[(n - 1) % t.lanes.length];

export const FONT = {
  // SF Pro Rounded on iOS (the "alarm" numbers). Checked in the E0 spike (docs/11 K-1).
  display: 'ui-rounded',
  mono: 'ui-monospace',
};
