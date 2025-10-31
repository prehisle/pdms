import '@testing-library/jest-dom';

import { TextDecoder, TextEncoder } from 'util';

// Polyfill TextEncoder/TextDecoder for environments where Vitest runs without them
if (!globalThis.TextEncoder) {
  // @ts-ignore
  globalThis.TextEncoder = TextEncoder;
}
if (!globalThis.TextDecoder) {
  // @ts-ignore
  globalThis.TextDecoder = TextDecoder;
}

// Mock window.matchMedia used by antd responsive features
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// Mock getComputedStyle to avoid jsdom "Not implemented" errors triggered by antd/rc-table
if (typeof window !== 'undefined') {
  window.getComputedStyle = ((node: Element, pseudoElt?: string | null) => {
    const style = document.createElement('div').style;
    style.display = 'block';
    style.visibility = 'visible';
    style.opacity = '1';
    style.width = '0px';
    style.height = '0px';
    return style;
  }) as typeof window.getComputedStyle;
}
