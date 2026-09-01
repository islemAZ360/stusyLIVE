import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1', // Forces IPv4 to fix "localhost refused to connect" on some Windows systems
    port: 5173,
    strictPort: true
  }
});
