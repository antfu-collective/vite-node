import antfu from '@antfu/eslint-config'

export default antfu(
  {},
  {
    files: ['./test/**/*.{ts,js}'],
    rules: {
      'no-empty-pattern': 'off',
      'antfu/no-top-level-await': 'off',
      'node/prefer-global/process': 'off',
    },
  },
)
