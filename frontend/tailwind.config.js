const colors = require('tailwindcss/colors');

module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        pink: colors.pink,
        yellow: colors.yellow,
        purple: colors.purple,
        green: colors.green,
        blue: colors.blue,
        gray: colors.gray,
        white: colors.white,
        black: colors.black,
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
