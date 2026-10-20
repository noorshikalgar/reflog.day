// shared/src/ids.ts uses crypto.getRandomValues; Hermes has no Web Crypto.
import * as ExpoCrypto from 'expo-crypto';

const g = globalThis as { crypto?: { getRandomValues?: <T extends ArrayBufferView>(a: T) => T } };
if (!g.crypto?.getRandomValues) {
  g.crypto = { ...(g.crypto ?? {}), getRandomValues: <T extends ArrayBufferView>(a: T) => ExpoCrypto.getRandomValues(a as never) as T };
}
