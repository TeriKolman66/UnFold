import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { pythonDevServer } from './scripts/python-dev-server';

export default defineConfig({
  plugins: [react(), pythonDevServer()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: { target: ['es2021', 'chrome100', 'safari13'] },
});
