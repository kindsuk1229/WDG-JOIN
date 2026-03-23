/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // 우동골 그린 팔레트
        golf: {
          50: '#E1F5EE',
          100: '#9FE1CB',
          200: '#5DCAA5',
          300: '#3AB68D',
          400: '#1D9E75',
          500: '#12875F',
          600: '#0F6E56',
          700: '#0A5A47',
          800: '#085041',
          900: '#04342C',
        },
        // 시맨틱 컬러
        danger: { 50: '#FCEBEB', 600: '#A32D2D' },
        warn: { 50: '#FAEEDA', 600: '#854F0B' },
        info: { 50: '#E6F1FB', 600: '#185FA5' },
      },
      borderRadius: {
        'xl': '16px',
        '2xl': '20px',
      },
      fontFamily: {
        sans: [
          'Pretendard', '-apple-system', 'BlinkMacSystemFont',
          'system-ui', 'Roboto', 'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
