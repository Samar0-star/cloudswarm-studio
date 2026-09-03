import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.VITE_NVIDIA_API_KEY || '';
  const groqApiKey = env.VITE_GROQ_API_KEY || '';

  return {
    plugins: [react()],
    define: {
      __NVIDIA_API_KEY__: JSON.stringify(apiKey),
      __GROQ_API_KEY__: JSON.stringify(groqApiKey),
      'process.env.VITE_GEMINI_API_KEYS': JSON.stringify(env.VITE_GEMINI_API_KEYS || ''),
      'process.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || ''),
    },
    server: {
      port: 3000,
      open: false,
      proxy: {
        '/api/groq': {
          target: 'https://api.groq.com/openai/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/groq/, ''),
          secure: false,
          headers: {
            Authorization: `Bearer ${groqApiKey}`,
          },
        },
        '/api/nim': {
          target: 'https://integrate.api.nvidia.com/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/nim/, ''),
          secure: false,
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
        '/api/gemini': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/gemini/, ''),
          secure: false,
        },
        '/api/webmcp': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/webmcp/, ''),
          secure: false,
        },
      },
    },
  };
});
