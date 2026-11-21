import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { authApi } from '@/lib/api/api';
import { tokenStorage } from '@/lib/tokenStorage';
import { signOutFromGoogle } from '@/lib/util/authUtils';



const AuthContext = createContext(null);
const isWeb = Platform.OS === 'web';
const GOOGLE_CALLBACK_PATH = '/auth/google/callback';

function getWebPathname() {
  if (!isWeb || typeof window === 'undefined') return '';
  return window.location.pathname;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const refreshRunIdRef = useRef(0);

  const setAuthError = useCallback((nextError) => {
    setError(nextError);
  }, []);

  const refreshAuth = useCallback(async () => {
    const runId = ++refreshRunIdRef.current;
    setIsLoading(true);
    setAuthError(null);
    try {
      const storedUser = await tokenStorage.getUser();

      if (runId !== refreshRunIdRef.current) return null;

      if (storedUser) {
        setUser(storedUser);
      }

      // 웹은 토큰이 HttpOnly 쿠키라 JS 가 세션 유무를 직접 볼 수 없다. 그래서
      // 예전에는 비로그인 방문자도 페이지를 열 때마다 GET /auth/me (401) →
      // POST /auth/refresh (400 "리프레시 토큰이 필요합니다.") 를 헛되게 두 번
      // 때렸다. 저장된 사용자가 없다는 건 이 브라우저가 로그인한 적이 없다는
      // 뜻이므로(로그인 성공 시 saveAuthData 가 tokenStorage.setUser 로 넣는다)
      // 네이티브의 "토큰 없으면 건너뛰기" 와 같은 식으로 바로 끝낸다.
      // 세션이 만료된 경우에는 storedUser 가 남아 있어 아래 경로를 그대로 타고,
      // 실패하면 catch 에서 clearUser 하므로 다음 방문부터는 다시 건너뛴다.
      if (isWeb && !storedUser) {
        setUser(null);
        return null;
      }

      if (!isWeb) {
        const [accessToken, refreshToken] = await Promise.all([
          tokenStorage.getAccessToken(),
          tokenStorage.getRefreshToken(),
        ]);

        if (!accessToken && !refreshToken) {
          if (runId !== refreshRunIdRef.current) return null;
          setUser(null);
          return null;
        }

        if (!accessToken && refreshToken) {
          await authApi.refreshToken(refreshToken);
          if (runId !== refreshRunIdRef.current) return null;
        }
      }

      const currentUser = await authApi.getCurrentUser();
      if (runId !== refreshRunIdRef.current) return null;
      if (currentUser) {
        setUser(currentUser);
        await tokenStorage.setUser(currentUser);
      }
      return currentUser ?? null;
    } catch (authError) {
      if (runId !== refreshRunIdRef.current) return null;
      setUser(null);
      setAuthError(authError);
      await tokenStorage.clearTokens();
      await tokenStorage.clearUser();
      return null;
    } finally {
      if (runId === refreshRunIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [setAuthError]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      try {
        await signOutFromGoogle();
      } catch (error) {
        console.warn('Google 로그아웃 실패:', error?.message || error);
      }
      setUser(null);
    }
    // if (isWeb) {
    //   window.location.replace('/');
    // }
  }, []);

  useEffect(() => {
    if (getWebPathname() === GOOGLE_CALLBACK_PATH) {
      setIsLoading(false);
      return;
    }
    void refreshAuth();
  }, [refreshAuth]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      error,
      refreshAuth,
      logout,
      setAuthError,
      setUser,
    }),
    [user, isLoading, error, refreshAuth, logout, setAuthError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
};
