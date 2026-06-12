import { Suspense } from 'react';

import App from './App';

// The demo App calls useRoot() (via the renderer hook) at its top level, which
// SUSPENDS until the GPU device is ready. Without a boundary that suspension
// bubbles to the root — React falls back to "synchronously rendering the entire
// root", which Safari's concurrent scheduler surfaces as a spurious
// "change in the order of Hooks" warning. A local Suspense boundary keeps the
// suspension contained, so it resolves cleanly (the hero avoids this entirely by
// using useRootWithStatus instead of useRoot).
export default function PlaygroundApp() {
  return (
    <Suspense fallback={null}>
      <App />
    </Suspense>
  );
}
