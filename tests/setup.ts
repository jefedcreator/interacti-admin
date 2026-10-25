import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './fake-api/msw';

export { server };

/* happy-dom lacks a few browser APIs that Radix reaches for. Add them only when missing. */
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

function stub(target: object, name: string, value: unknown): void {
  if (!(name in target)) {
    Object.defineProperty(target, name, { value, configurable: true, writable: true });
  }
}

stub(Element.prototype, 'hasPointerCapture', () => false);
stub(Element.prototype, 'setPointerCapture', () => {});
stub(Element.prototype, 'releasePointerCapture', () => {});
stub(Element.prototype, 'scrollIntoView', () => {});

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));

afterEach(() => {
  // Vitest runs without globals, so Testing Library cannot register its own cleanup.
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
});

afterAll(() => server.close());
