const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

module.exports = [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/release/build/**',
      '**/release/app/dist/**',
      '**/.erb/dll/**',
      '**/*.css.d.ts',
      '**/*.sass.d.ts',
      '**/*.scss.d.ts',
    ],
  },
  js.configs.recommended,
  ...compat.extends('eslint-config-erb'),
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      'import/no-extraneous-dependencies': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-filename-extension': 'off',
      'import/extensions': 'off',
      'import/no-unresolved': 'off',
      'import/no-import-module-exports': 'off',
      'no-shadow': 'off',
      'no-unused-vars': 'off',
      'react/prop-types': 'off',
    },
  }
];
