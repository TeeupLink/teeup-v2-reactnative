import '@testing-library/jest-native/extend-expect';
import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'util';

// Web API polyfill (실제 구현)
global.TextEncoder = TextEncoder;
global.crypto = webcrypto;

// btoa polyfill
global.btoa = (str) =>
  Buffer.from(str, 'binary').toString('base64');

// ---- 이하 기존 mock 유지 ----

jest.mock('expo-router');

jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock').default;
  return {
    __esModule: true,
    ...mock,
  };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  const LinearGradient = ({ children, ...props }) =>
    React.createElement(View, props, children);
  return { LinearGradient };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return new Proxy(
    {},
    {
      get: (_target, name) => (props) =>
        React.createElement(Text, props, String(name)),
    },
  );
});

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    refreshAuth: jest.fn(),
    logout: jest.fn(),
    setUser: jest.fn(),
  }),
}));

jest.mock('@/context/BlockContext', () => ({
  BlockProvider: ({ children }) => children,
  useBlockedUsers: () => ({
    blockedIds: new Set(),
    blockedUsers: [],
    isLoaded: true,
    isBlocked: () => false,
    block: jest.fn(),
    unblock: jest.fn(),
    refresh: jest.fn(),
  }),
  useOptionalBlockedUsers: () => null,
}));

jest.mock('@/context/AppLayoutContext', () => ({
  useAppLayout: () => ({
    isMenuOpen: false,
    toggleMenu: jest.fn(),
    closeMenu: jest.fn(),
  }),
}));

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({ data: [], total_pages: 1 }),
    text: async () => '',
  }),
);

// 네이티브 모듈이 필요한 라이브러리는 jest 에서 로드할 수 없다.
// 화면 렌더 테스트가 전부 여기서 막히므로 가짜 구현을 끼운다.

// 구글 로그인 — RNGoogleSignin 네이티브 바이너리를 찾는다.
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn().mockResolvedValue({ data: null }),
    signOut: jest.fn().mockResolvedValue(undefined),
    getTokens: jest.fn().mockResolvedValue({ idToken: '', accessToken: '' }),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
}));

// 캐러셀 — react-native-worklets 의 네이티브 초기화를 요구한다.
jest.mock('react-native-reanimated-carousel', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children, ...props }) => React.createElement(View, props, children),
  };
});
