import { Platform } from 'react-native';

import { googleAuthConfig, googleNativeConfig } from '../../constants/authConstants';
import { authApi } from '../api/api';
import { tokenStorage } from '../tokenStorage';

let AppleAuthentication;
if (Platform.OS === 'ios') {
  AppleAuthentication = require('expo-apple-authentication');
}

let GoogleSignin;
if (Platform.OS !== 'web') {
  console.log('GoogleSignin.configure webClientId:', googleNativeConfig.webClientId);
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
  GoogleSignin.configure({
    webClientId: googleNativeConfig.webClientId,
    // Firebase 프로젝트(668486530275)와 OAuth 클라이언트 프로젝트(791884628850)가
    // 서로 달라 GoogleService-Info.plist에 CLIENT_ID가 없다.
    // 따라서 iOS 클라이언트 ID를 env에서 직접 주입해야 한다.
    ...(Platform.OS === 'ios' && googleAuthConfig.clientId
      ? { iosClientId: googleAuthConfig.clientId }
      : {}),
    offlineAccess: true,
    scopes: ['openid', 'profile', 'email'],
  });
}

export function buildGoogleAuthPayload(authState, oauthState) {
  const payload = {
    provider: 'google',
    authorizationCode: authState?.authorizationCode,
  };

  if (authState?.codeVerifier) {
    payload.codeVerifier = authState.codeVerifier;
  }

  if (oauthState) {
    payload.state = oauthState;
  }

  if (googleAuthConfig.redirectUrl) {
    payload.redirectUri = googleAuthConfig.redirectUrl;
  }

  return payload;
}

export function generateOauthState() { return `google_${Date.now()}_${Math.random().toString(36).slice(2)}`; }

export async function signInWithGoogle({
  refreshAuth,
  router,
  setLoading,
  setErrorMessage,
}) {
  setErrorMessage('');
  setLoading(true);

  try {
    const oauthState = generateOauthState();
    await tokenStorage.setOauthState(oauthState);

    if (Platform.OS === 'web') {
      if (!googleAuthConfig.clientId || !googleAuthConfig.redirectUrl) {
        setErrorMessage('Google 로그인 설정(clientId/redirectUrl)이 누락되었습니다.');
        setLoading(false);
        return;
      }

      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      await tokenStorage.setCodeVerifier(codeVerifier);

      const authUrl = buildGoogleAuthorizeUrl({
        state: oauthState,
        codeChallenge,
        codeChallengeMethod: 'S256',
      });

      window.location.assign(authUrl);
      return;
    }

    // 네이티브: Google Sign-In SDK 사용
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    const serverAuthCode = response?.data?.serverAuthCode;

    if (!serverAuthCode) {
      throw new Error('Google 로그인에서 serverAuthCode를 받지 못했습니다.');
    }

    const payload = {
      provider: 'google',
      authorizationCode: serverAuthCode,
      state: oauthState,
      redirectUri: '',
    };

    await authApi.googleLogin(payload);

    if (refreshAuth) {
      await refreshAuth();
    }

    if (router) {
      router.replace('/app');
    }
  } catch (error) {
    console.error('Google sign-in failed:', {
      code: error?.code,
      message: error?.message,
    });
    const message = error?.message || 'Google 로그인에 실패했습니다.';
    setErrorMessage(message);
  } finally {
    await tokenStorage.clearOauthState();
    setLoading(false);
  }
}

/**
 * Sign in with Apple (iOS 전용)
 *
 * Apple은 사용자 이름을 '최초 1회' 인증에서만 내려주므로, 그때 받은 이름을
 * 서버로 함께 전달한다. 두 번째 로그인부터 fullName은 null이다.
 */
export async function signInWithApple({
  refreshAuth,
  router,
  setLoading,
  setErrorMessage,
}) {
  setErrorMessage('');
  setLoading(true);

  try {
    if (Platform.OS !== 'ios' || !AppleAuthentication) {
      throw new Error('Apple 로그인은 iOS에서만 지원됩니다.');
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential?.identityToken) {
      throw new Error('Apple 로그인에서 identityToken을 받지 못했습니다.');
    }

    const { givenName, familyName } = credential.fullName ?? {};
    // 한국어 이름은 성+이름 순서가 자연스럽다.
    const fullName = [familyName, givenName].filter(Boolean).join('') || null;

    await authApi.appleLogin({
      identityToken: credential.identityToken,
      fullName,
    });

    if (refreshAuth) {
      await refreshAuth();
    }

    if (router) {
      router.replace('/app');
    }
  } catch (error) {
    // 사용자가 시트를 직접 닫은 경우는 에러로 표시하지 않는다.
    if (error?.code === 'ERR_REQUEST_CANCELED') {
      return;
    }

    console.error('Apple sign-in failed:', {
      code: error?.code,
      message: error?.message,
    });
    setErrorMessage(error?.message || 'Apple 로그인에 실패했습니다.');
  } finally {
    setLoading(false);
  }
}

export async function signOutFromGoogle() {
  if (Platform.OS === 'web' || !GoogleSignin) {
    return;
  }

  await GoogleSignin.signOut();
}

export function buildGoogleAuthorizeUrl({
  state,
  codeChallenge,
  codeChallengeMethod,
}) {
  console.log('!!! buildGoogleAuthorizeUrl - redirectUrl:', googleAuthConfig.redirectUrl);
  const params = new URLSearchParams({
    client_id: googleAuthConfig.clientId,
    redirect_uri: googleAuthConfig.redirectUrl,
    response_type: 'code',
    scope: 'openid profile email',
    state,
    prompt: 'select_account',
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  console.log('!!! Generated Google OAuth URL:', authUrl);
  return authUrl;
}

// 웹 OAuth용 PKCE 구현 함수
export function generateCodeVerifier(length = 64) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  const values = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < values.length; i++) {
    result += charset[values[i] % charset.length];
  }
  return result;
}


export const generateCodeChallenge = async (verifier) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);

  const digest = await crypto.subtle.digest('SHA-256', data);

  return base64UrlEncode(new Uint8Array(digest));
};

function base64UrlEncode(buffer) {
  let binary = '';
  const len = buffer.byteLength;

  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
