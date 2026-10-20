// Small haptic ticks. Call them inside a tap handler (a user gesture).
// Android: the Vibration API. iPhone (iOS 18+): Safari plays a system haptic when an
// <input type="checkbox" switch> toggles, so we toggle a hidden one. Other devices: no-op.
let label: HTMLLabelElement | null = null;
const coarse = () => matchMedia('(pointer: coarse)').matches;

export function tick() {
  if (!coarse()) return;
  if ('vibrate' in navigator && !/iPhone|iPad/.test(navigator.userAgent)) {
    navigator.vibrate(8);
    return;
  }
  if (!label) {
    label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:-200px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
  }
  label.click();
}
