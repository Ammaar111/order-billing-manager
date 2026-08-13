import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    // The dev server holds no data of its own; everything comes from the
    // Express process on 4100.
    proxy: {
      '/api': 'http://localhost:4100',
      '/uploads': 'http://localhost:4100',
    },
  },
});
