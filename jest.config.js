const expoPreset = require('jest-expo/jest-preset');

// 변환해야 하는 ESM 전용 node_modules.
// sanitize-html@2.18 은 htmlparser2 ^12 를 요구하고, 그 12 는 "type": "module" 인
// 순수 ESM 이다. Metro(앱 번들)는 그대로 처리하지만 jest 는 변환해 줘야 require 로
// 읽을 수 있다. 빠지면 HtmlContent 를 쓰는 화면이 app-quality 렌더 테스트에서
// "Cannot use import statement outside a module" 로 터진다.
// sanitize-html 도 넣어야 한다. htmlparser2 가 node_modules/sanitize-html/node_modules/
// 아래에 중첩돼 있어서, 바깥 /node_modules/sanitize-html 구간이 먼저 ignore 패턴에
// 걸리면 안쪽은 볼 기회조차 없다.
const ESM_PACKAGES = [
  'sanitize-html',
  'htmlparser2',
  'domhandler',
  'domutils',
  'dom-serializer',
  'domelementtype',
  'entities',
];

const transformIgnorePatterns = expoPreset.transformIgnorePatterns.map((pattern) =>
  pattern.startsWith('/node_modules/(?!')
    ? pattern.replace('(?!(', `(?!(${ESM_PACKAGES.join('|')}|`)
    : pattern,
);

module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns,
  testMatch: ['**/__tests__/**/*.(spec|test).[jt]s?(x)'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  silent: true,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^expo-constants$': '<rootDir>/__mocks__/expo-constants.js',
    '^@/lib/util/authUtils$':
      '<rootDir>/__mocks__/@/lib/util/authUtils.js'
  },
};
