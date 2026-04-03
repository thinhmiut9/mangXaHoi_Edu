import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: process.env.VITE_API_URL || 'http://localhost:5000',
                changeOrigin: true,
            },
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                    'query-vendor': ['@tanstack/react-query'],
                    'chart-vendor': ['recharts'],
                    'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
                    'socket-vendor': ['socket.io-client'],
                    'utils-vendor': ['axios', 'zustand', 'date-fns', 'clsx', 'tailwind-merge'],
                },
            },
        },
        chunkSizeWarningLimit: 600,
    },
});
