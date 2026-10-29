import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './index.html',
  ],
  theme: {
    extend: {
      colors: {
        bkp: {
          dark: '#1B5E20',    // bg-green-900 (header / sidebar)
          primary: '#2E7D32', // bg-green-700 (tombol utama)
          light: '#E8F5E9',   // bg-green-100 (background halaman)
          surface: '#FFFFFF', // bg-white (card)
          danger: '#EF4444',  // text-red-500 (pelanggaran)
          reward: '#EAB308',  // text-yellow-500 (apresiasi / reward)
        },
      },
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};

export default config;
