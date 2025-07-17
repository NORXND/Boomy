import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [tailwindcss(), react(
        {
            jsxImportSource: 'react',
            babel: {
                plugins: [
                    ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }]
                ]
            }
        }
    )],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src/app"),
        },
    },
});

