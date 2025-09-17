module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.eslint.json'],
    tsconfigRootDir: __dirname
  },
  env: {
    node: true,
    es2020: true,
    jest: true
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier'
  ],
  ignorePatterns: ['dist', 'node_modules'],
  settings: {
    'import/resolver': {
      typescript: {
        project: ['./tsconfig.json']
      }
    }
  },
  rules: {
    '@typescript-eslint/naming-convention': [
      'error',
      {
        "selector": 'variableLike',
        "format": ['snake_case']
      },
      {
        "selector": 'typeLike',
        "format": ['PascalCase']
      }
    ],
    '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: false }],
    'import/no-default-export': 'error',
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
        'newlines-between': 'always'
      }
    ]
  }
};
