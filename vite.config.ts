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
    // Force single React instance to prevent "Cannot read properties of null (reading 'useRef')" error
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // Pre-bundle these dependencies to ensure consistent React instance
    include: ['react', 'react-dom', '@radix-ui/react-tooltip'],
  },
}));