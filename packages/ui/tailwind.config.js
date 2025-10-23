export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Barlow Semi Condensed', 'sans-serif'],
        heading: ['Poppins', 'sans-serif'],
        condensed: ['Barlow Condensed', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        logo: ['Doto', 'sans-serif'],
      },
      colors: {
        dark: {
          50: '#f9fafb',
          100: '#f3f4f6',
          900: '#0f0f0f',
          950: '#0a0a0a',
        },
      },
    },
  },
  plugins: [],
};

