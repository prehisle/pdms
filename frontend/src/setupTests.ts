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
  window.getComputedStyle = () => ({
    getPropertyValue: () => '',
    display: 'block',
    visibility: 'visible',
    opacity: '1',
    width: '0px',
    height: '0px',
  }) as CSSStyleDeclaration;
}
