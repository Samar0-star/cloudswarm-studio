/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        // Achromatic Obsidian Studio Palette (Linear / Vercel style)
        canvas: {
          bg: '#08090A',
          panel: '#0F1011',
          surface: '#141517',
          elevated: '#1A1B1E',
          muted: '#222428',
          border: 'rgba(255, 255, 255, 0.07)',
          'border-hover': 'rgba(255, 255, 255, 0.14)',
        },
        // Precise restrained text hierarchy
        txt: {
          primary: '#F7F8F8',
          secondary: '#C2C6CC',
          muted: '#8A8F98',
          subtle: '#565B65',
        },
        // Technical agent signatures
        agent: {
          alpha: '#38BDF8',  // Sky (Compute & Infra)
          beta: '#818CF8',   // Violet/Indigo (SecOps & IAM)
          gamma: '#34D399',  // Emerald (Storage & Data)
          delta: '#C084FC',  // Purple (FinOps & Cost)
          human: '#FBBF24',  // Amber (Human Director)
        },
        brand: {
          primary: '#5E6AD2',
          'primary-hover': '#6F7BE0',
        }
      },
      animation: {
        'soft-pulse': 'soft-pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'subtle-dash': 'subtle-dash 1.8s linear infinite',
      },
      keyframes: {
        'soft-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'subtle-dash': {
          'to': { strokeDashoffset: '-20' }
        }
      }
    },
  },
  plugins: [],
}
