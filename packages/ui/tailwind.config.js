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
        // Muted professional color palette - darker blues
        navy: '#0f1c24',
        slate: '#1a2830',
        orange: '#FF7D2D',
        peach: '#FF9A4A',
        gold: '#FAC846',
        cream: '#F6DA80',
        sage: '#A0C382',
        olive: '#8AB572',
        teal: '#5F9B8C',
        mint: '#7BAEA2',
        rust: '#C25C4A',

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

