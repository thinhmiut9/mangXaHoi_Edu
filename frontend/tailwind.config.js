/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          200: 'var(--color-primary-200)',
          300: 'var(--color-primary-300)',
          400: 'var(--color-primary-400)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
          800: 'var(--color-primary-800)',
          900: 'var(--color-primary-900)',
        },
        app: {
          bg: 'var(--color-app-bg)',
        },
        card: 'var(--color-card)',
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
        },
        border: {
          light: 'var(--color-border-light)',
          main: 'var(--color-border-main)',
        },
        hover: {
          bg: 'var(--color-hover-bg)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          500: 'var(--color-success)',
          bg: 'var(--color-success-bg)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          500: 'var(--color-warning)',
          bg: 'var(--color-warning-bg)',
        },
        error: {
          DEFAULT: 'var(--color-error)',
          500: 'var(--color-error)',
          bg: 'var(--color-error-bg)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          500: 'var(--color-info)',
          bg: 'var(--color-info-bg)',
        },
      },
      fontFamily: {
        sans: ['Be Vietnam Pro', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
