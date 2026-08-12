import React from 'react';
import { createRoot } from 'react-dom/client';
import { E2EHarness } from './E2EHarness';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <E2EHarness />
    </React.StrictMode>
  );
}
