/**
 * 웹에서 비로그인 방문자에게 인증 요청을 헛되게 보내지 않는다.
 *
 * 웹은 토큰이 HttpOnly 쿠키라 JS 가 세션 유무를 직접 볼 수 없다. 그래서 예전에는
 * 페이지를 열 때마다
 *     GET  /auth/me       → 401 Not authenticated
 *     POST /auth/refresh  → 400 "리프레시 토큰이 필요합니다."
 * 를 두 번 보냈다. 공개 페이지(랜딩·공지·FAQ·약관)가 많은 서비스라 전부 헛요청이다.
 *
 * 로그인에 성공하면 saveAuthData 가 tokenStorage.setUser 로 사용자를 남기므로,
 * 저장된 사용자가 없다 = 이 브라우저는 로그인한 적이 없다. 그때는 바로 끝낸다.
 * 세션만 만료된 경우에는 저장된 사용자가 남아 있어 평소 경로를 그대로 탄다.
 */
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

jest.mock('@/lib/api/api', () => ({
  authApi: {
    getCurrentUser: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
    syncPushToken: jest.fn(),
  },
}));

jest.mock('@/lib/tokenStorage', () => ({
  tokenStorage: {
    getUser: jest.fn(),
    setUser: jest.fn(),
    clearUser: jest.fn(),
    getAccessToken: jest.fn(),
    getRefreshToken: jest.fn(),
    clearTokens: jest.fn(),
    setTokens: jest.fn(),
  },
}));

jest.mock('@/lib/util/authUtils', () => ({ signOutFromGoogle: jest.fn() }));

const { authApi } = require('@/lib/api/api');
const { tokenStorage } = require('@/lib/tokenStorage');
// AuthContext 는 모듈 로드 시점에 `const isWeb = Platform.OS === 'web'` 을 굳힌다.
// jest 기본값은 ios 라서 그냥 두면 웹 가드가 아니라 네이티브 조기 종료 경로를 타고,
// 테스트가 엉뚱한 이유로 통과한다. 그래서 require 전에 web 으로 바꿔 둔다.
require('react-native').Platform.OS = 'web';

// AuthContext 는 /auth/google/callback 에서는 부트스트랩을 건너뛴다. jest 환경에는
// window.location 이 없으므로 일반 공개 페이지인 척 스텁을 둔다.
if (typeof global.window === 'undefined') global.window = {};
global.window.location = { pathname: '/terms', search: '', hash: '' };

// jest.setup.js 가 @/context/AuthContext 를 전역 모킹해 useAuth 만 내보낸다.
// 여기서는 실제 구현(AuthProvider 의 부트스트랩 경로)을 봐야 하므로 실모듈을 가져온다.
const { AuthProvider, useAuth } = jest.requireActual('@/context/AuthContext');

function Probe() {
  const { isAuthenticated, isLoading } = useAuth();
  return <Text>{`${isLoading ? 'loading' : 'done'}:${isAuthenticated ? 'in' : 'out'}`}</Text>;
}

// render 를 act 로 감싸면 RNTL 의 host component 탐지가 깨진다. 평소처럼 렌더하고
// waitFor 로 비동기 부트스트랩이 끝나길 기다린다.
const renderAuth = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

describe('웹 비로그인 방문자', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tokenStorage.getUser.mockResolvedValue(null);
  });

  it('저장된 사용자가 없으면 /auth/me 를 부르지 않는다', async () => {
    const { getByText } = renderAuth();

    await waitFor(() => expect(getByText('done:out')).toBeTruthy());
    expect(authApi.getCurrentUser).not.toHaveBeenCalled();
    expect(authApi.refreshToken).not.toHaveBeenCalled();
  });
});

describe('로그인한 적 있는 브라우저', () => {
  const stored = { id: 9, nickname: '버디헌터' };

  beforeEach(() => {
    jest.clearAllMocks();
    tokenStorage.getUser.mockResolvedValue(stored);
  });

  it('저장된 사용자가 있으면 평소대로 /auth/me 로 확인한다', async () => {
    authApi.getCurrentUser.mockResolvedValue({ ...stored, nickname: '버디헌터2' });

    const { getByText } = renderAuth();

    await waitFor(() => expect(getByText('done:in')).toBeTruthy());
    expect(authApi.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(tokenStorage.setUser).toHaveBeenCalledWith({ ...stored, nickname: '버디헌터2' });
  });

  it('세션이 만료돼 실패하면 저장된 사용자를 지운다 (다음 방문부터 다시 건너뛴다)', async () => {
    authApi.getCurrentUser.mockRejectedValue(new Error('401'));

    const { getByText } = renderAuth();

    await waitFor(() => expect(getByText('done:out')).toBeTruthy());
    expect(tokenStorage.clearUser).toHaveBeenCalled();
  });
});
