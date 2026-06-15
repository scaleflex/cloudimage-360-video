module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  env: {
    browser: true,
    es2020: true,
    node: true,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    // The two streaming adapters use `@ts-ignore` (not `@ts-expect-error`) on
    // their dynamic `import('hls.js'|'dashjs')`: the optional-peer type shim in
    // src/vite-env.d.ts makes the line error-free under `tsc --noEmit` (so
    // `@ts-expect-error` would report an unused directive), yet vite-plugin-dts
    // narrows its file scope during the .d.ts build and re-reports the missing
    // module — which only `@ts-ignore` can silence. Allow it when documented.
    '@typescript-eslint/ban-ts-comment': [
      'error',
      { 'ts-ignore': 'allow-with-description', minimumDescriptionLength: 10 },
    ],
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
  },
  ignorePatterns: ['dist/', 'dist-demo/', 'dist-react-demo/', 'node_modules/', 'coverage/'],
};
