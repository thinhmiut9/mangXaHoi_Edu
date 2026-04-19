/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary — EduSocial Blue (Facebook-inspired)
        primary: {
          50:  '#e8f3ff',
          100: '#cce4ff',
          200: '#99caff',
          300: '#66afff',
          400: '#3394ff',
          500: '#1877F2', // main
          600: '#1362cc',
          700: '#0e4da6',
          800: '#0a3880',
          900: '#06235a',
        },
        // App Background
        'app-bg': '#F0F2F5',
        // Card
        'card-bg': '#FFFFFF',
        // Text
        'text-primary': '#1C1E21',
        'text-secondary': '#65676B',
        'text-muted': '#8A8D91',
        // Border
        'border-light': '#E4E6EB',
        'border-main': '#CED0D4',
        // Semantic
        success: {
          50:  '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
        },
        warning: {
          50:  '#fffbeb',
          500: '#f59e0b',
          600: '#d97706',
        },
        error: {
          50:  '#fef2f2',
          500: '#ef4444',
          600: '#dc2626',
        },
        info: {
          50:  '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
        },
      },
      fontFamily: {
        sans: [
          'Be Vietnam Pro',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        xs:   ['11px', { lineHeight: '16px' }],
        sm:   ['12px', { lineHeight: '16px' }],
        base: ['14px', { lineHeight: '20px' }],
        md:   ['15px', { lineHeight: '22px' }],
        lg:   ['16px', { lineHeight: '24px' }],
        xl:   ['18px', { lineHeight: '28px' }],
        '2xl':['20px', { lineHeight: '30px' }],
        '3xl':['24px', { lineHeight: '32px' }],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.06)',
        DEFAULT: '0 1px 4px rgba(0,0,0,0.08)',
        md: '0 2px 8px rgba(0,0,0,0.10)',
        lg: '0 4px 16px rgba(0,0,0,0.12)',
        xl: '0 8px 32px rgba(0,0,0,0.14)',
        card: '0 1px 2px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
      },
      spacing: {
        '13': '3.25rem',
        '15': '3.75rem',
        '17': '4.25rem',
        '18': '4.5rem',
      },
      screens: {
        xs: '360px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
      transitionTimingFunction: {
        'ease-smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
