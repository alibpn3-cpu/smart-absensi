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
  preview: {
    host: true,
    port: 6890,
    strictPort: true,
    allowedHosts: ["absen.petrolog.my.id"], 
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Force single React instance
      "react": path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(__dirname, "./node_modules/react/jsx-runtime"),
    },
    dedupe: [
      'react', 
      'react-dom',
      'react/jsx-runtime',
      'leaflet',
      '@turf/turf',
    ],
  },
  optimizeDeps: {
    include: [
      'react', 
      'react-dom',
      'react/jsx-runtime',
      'leaflet',
    ],
    exclude: [],
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
}));