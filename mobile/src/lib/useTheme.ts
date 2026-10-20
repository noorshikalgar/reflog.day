import { THEMES, type Tokens } from './theme.ts';
import { useStore } from './store.ts';

export const useTheme = (): Tokens => THEMES[useStore(s => s.theme)];
