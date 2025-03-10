const jestJupyterLab = require('@jupyterlab/testutils/lib/jest-config');

const esModules = [
  '@codemirror',
  '@hpcc/wasm-graphviz',
  '@jupyter/ydoc',
  '@jupyterlab/',
  '@jupyter/react-components',
  '@jupyter/web-components',
  '@microsoft/',
  'exenv-es6',
  'robust-predicates',
  'd3',
  'delaunator',
  'internmap',
  'lib0',
  'nanoid',
  'nbdime',
  'vscode-ws-jsonrpc',
  'y-protocols',
  'y-websocket',
  'yjs'
].join('|');

const baseConfig = jestJupyterLab(__dirname);

module.exports = {
  ...baseConfig,
  automock: false,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/.ipynb_checkpoints/*'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['lcov', 'text'],
  reporters: ['default', 'github-actions'],
  transformIgnorePatterns: [`<rootDir>/../../node_modules/(?!${esModules}).+`]
};
