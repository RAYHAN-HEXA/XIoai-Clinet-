module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { es2022: true, node: true },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }
    ]
  },
  ignorePatterns: ['dist', 'coverage', 'node_modules', '.env'],
  overrides: [
    {
      // plain-node dev/debug scripts keep CommonJS require
      files: ['scripts/**/*.js'],
      rules: { '@typescript-eslint/no-var-requires': 'off' }
    }
  ]
};
