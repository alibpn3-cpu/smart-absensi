import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  // ================================================================
  // TAMBAHKAN BAGIAN INI
  // Ini untuk konfigurasi 'npm run preview' yang Anda gunakan di Docker
  // ================================================================
  preview: {
    host: true, // Membuat server bisa diakses dari network
    port: 6890, // Sesuaikan port dengan yang di Dockerfile
    strictPort: true,
    // Izinkan Nginx Proxy Manager untuk mengaksesnya
    allowedHosts: ["absen.petrolog.my.id"], 
  },
  // ================================================================
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Force single React instance across all dependencies
    dedupe: [
      'react', 
      'react-dom',
      'react/jsx-runtime',
      '@tanstack/react-query',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-popover',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-dropdown-menu'
    ],
  },
  optimizeDeps: {
    // Pre-bundle and force re-optimization
    include: [
      'react', 
      'react-dom',
      'react/jsx-runtime',
      '@tanstack/react-query',
      '@radix-ui/react-tooltip'
    ],
    esbuildOptions: {
      // Ensure single React instance at build level
      conditions: ['module'],
    },
  },
  // Clear cache on server start
  cacheDir: '.vite',
}));