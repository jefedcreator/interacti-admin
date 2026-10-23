import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';

// Placeholder shell. Task 5 replaces this with the real app.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main>
      <img src="/brand/interacti/logo-white.svg" alt="interacti" width={144} />
    </main>
  </StrictMode>,
);
