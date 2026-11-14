import Constants from 'expo-constants';
import { router } from "expo-router";
import { Alert, Platform } from 'react-native';
import { URLSearchParams } from 'react-native-url-polyfill';

import { getNativeAppVersion } from '../appVersion';
import { replaceWithPolicy } from '../navigation/cappedHistory';
import { tokenStorage } from '../tokenStorage';

const extra =
  Constants.expoConfig?.extra ??
  Constants.manifest?.extra;

const API_BASE_URL = extra?.apiBaseUrl;

const isWeb = Platform.OS === 'web';
const CLIENT_TYPE = isWeb ? 'web' : Platform.OS;

// 백엔드 utils/activity.py 가 이 헤더를 읽어 활동 로그에 남긴다. 그런데
// 앱이 여태 보내지 않아서 그 칸이 늘 비어 있었다. 어떤 버전이 실제로
// 돌아다니는지 모르면 강제 업데이트 최소 버전을 어디에 걸지 정할 수 없다.
const APP_VERSION = getNativeAppVersion();

const sensitiveKeys = ['password', 'token', 'authorization', 'refresh', 'access'];
const REFRESH_PATH = '/auth/refresh';
let refreshPromise = null;

function debugLog(...args) {
  console.log(...args);
}

function maskValue(value) {
  if (typeof value !== 'string') return value;
  if (value.length <= 6) return '***';
  return `${value.slice(0, 3)}***${value.slice(-2)}`;
};

function sanitizePayload(payload) {
  if (!payload) return payload;
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizePayload(item));
  }
  if (typeof payload === 'object') {
    return Object.keys(payload).reduce((acc, key) => {
      const lowered = key.toLowerCase();
      if (sensitiveKeys.some((sensitive) => lowered.includes(sensitive))) {
        acc[key] = maskValue(payload[key]);
      } else {
        acc[key] = sanitizePayload(payload[key]);
      }
      return acc;
    }, {});
  }
  return payload;
};

async function parseJsonPayload(response) {
  const isJson = response.headers.get('content-type')?.includes('application/json');
  return isJson ? await response.json() : null;
}

function buildQuery(params = {}) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (!entries.length) return '';

  const query = new URLSearchParams();
  entries.forEach(([key, value]) => {
    query.append(key, String(value));
  });
  return `?${query.toString()}`;
};

function buildUrl(path) {
  if (!path) {
    throw new Error('요청 경로를 지정해주세요.');
  }
  if (!API_BASE_URL) {
    throw new Error('API_BASE_URL이 설정되지 않았습니다.');
  }
  const urlPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${urlPath}`;
};

function buildRequestConfig(config = {}) {
  return {
    params: config.params,
    headers: config.headers,
    auth: config.auth !== false,
    redirectOnAuthExpired: config.redirectOnAuthExpired !== false,
  };
}

/** API 오류 응답에서 사용자에게 보여줄 문자열 추출 (detail이 객체일 때 [object Object] 방지) */
function getErrorMessage(payload) {
  if (!payload) return '요청에 실패했습니다.';
  const d = payload.detail;
  if (typeof d === 'string') return d;
  if (typeof payload.message === 'string') return payload.message;
  if (d && typeof d === 'object') {
    if (typeof d.message === 'string') return d.message;
    if (typeof d.msg === 'string') return d.msg;
    if (Array.isArray(d) && d.length > 0) {
      const first = d[0];
      if (first?.loc && first?.msg) return first.msg;
      if (typeof first === 'string') return first;
    }
  }
  return '요청에 실패했습니다.';
}

export { getErrorMessage };

function buildFetchOptions(options = {}) {
  if (!isWeb) return options;
  return {
    ...options,
    credentials: 'include',
  };
}

async function requestTokenRefresh() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshHeaders = {
      'Content-Type': 'application/json',
      'X-Client-Type': CLIENT_TYPE,
    };
    const refreshRequest = {
      method: 'POST',
      headers: refreshHeaders,
    };

    if (!isWeb) {
      const refreshToken = await tokenStorage.getRefreshToken();
      if (!refreshToken) {
        return null;
      }
      refreshRequest.body = JSON.stringify({ refresh_token: refreshToken });
    }

    const refreshUrl = buildUrl(REFRESH_PATH);
    let refreshResponse;
    try {
      refreshResponse = await fetch(refreshUrl, buildFetchOptions(refreshRequest));
    } catch (error) {
      console.warn('[Auth Refresh Network Error]', {
        url: refreshUrl,
        message: error?.message,
      });
      return null;
    }

    const refreshPayload = await parseJsonPayload(refreshResponse);
    debugLog('[Auth Refresh Response]', {
      url: refreshUrl,
      status: refreshResponse.status,
      payload: sanitizePayload(refreshPayload),
    });

    if (!refreshResponse.ok) {
      return null;
    }

    if (isWeb) {
      return { refreshed: true };
    }

    if (!refreshPayload?.access_token) {
      return null;
    }

    await tokenStorage.setTokens(refreshPayload.access_token, refreshPayload.refresh_token);
    return {
      refreshed: true,
      accessToken: refreshPayload.access_token,
    };
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function handleAuthExpired({ redirectOnAuthExpired = true } = {}) {
  console.info('[Auth] Session expired → logout');
  await tokenStorage.clearTokens();
  await tokenStorage.clearUser();
  if (redirectOnAuthExpired) {
    replaceWithPolicy(router, '/login');
  }
}

async function apiRequest(path, options = {}) {
  const {
    method = 'GET',
    params,
    headers = {},
    body,
    formData,
    auth = false,
    redirectOnAuthExpired = true,
  } = options;

  const url = `${buildUrl(path)}${buildQuery(params)}`;
  const isForm = Boolean(formData);

  const requestHeaders = {
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...headers,
    'X-Client-Type': CLIENT_TYPE,
    ...(APP_VERSION ? { 'X-App-Version': APP_VERSION } : {}),
  };

  if (isWeb && requestHeaders.Authorization) {
    delete requestHeaders.Authorization;
  }

  if (auth) {
    if (!isWeb) {
      const token = await tokenStorage.getAccessToken();
      if (token) {
        requestHeaders.Authorization = `Bearer ${token}`;
      }
    }
  }

  const logHeaders = { ...requestHeaders };
  if (logHeaders.Authorization) {
    logHeaders.Authorization = `Bearer ${maskValue(logHeaders.Authorization.replace('Bearer ', ''))}`;
  }

  // debugLog('[API Request]', {
  //   method,
  //   url,
  //   params,
  //   headers: logHeaders,
  //   body: isForm ? '[FormData]' : sanitizePayload(body),
  // });

  const requestOnce = async (headersToUse) => {
    const result = {};
    try {
      result.response = await fetch(url, buildFetchOptions({
        method,
        headers: headersToUse,
        body: isForm ? formData : (body ? JSON.stringify(body) : undefined),
      }));
    } catch (networkError) {
      console.warn('[API Network Error]', {
        method,
        url,
        message: networkError?.message,
      });
      throw networkError;
    }

    result.payload = await parseJsonPayload(result.response);
    return result;
  };

  let { response, payload } = await requestOnce(requestHeaders);

  // debugLog(
  //   '[API Response]\n' +
  //   JSON.stringify({
  //     method,
  //     url,
  //     status: response.status,
  //     payload: sanitizePayload(payload),
  //   }, null, 2)
  // );

  if (!response.ok) {
    const hasAuthHeader = Boolean(requestHeaders.Authorization);
    const hasAuthContext = hasAuthHeader || (isWeb && auth);
    const detailText =
      typeof payload?.detail === 'string'
        ? payload.detail
        : typeof payload?.message === 'string'
          ? payload.message
          : '';
    const isAuthForbidden =
      response.status === 403 &&
      hasAuthContext &&
      (
        detailText.toLowerCase().includes('not authenticated') ||
        payload?.detail?.code === 'NOT_AUTHENTICATED'
      );
    const isAuthFailure = auth && (response.status === 401 || isAuthForbidden);

    if (isAuthFailure) {
      const refreshResult = await requestTokenRefresh();
      if (refreshResult?.refreshed) {
        const retryHeaders = refreshResult.accessToken
          ? {
            ...requestHeaders,
            Authorization: `Bearer ${refreshResult.accessToken}`,
          }
          : requestHeaders;
        const retryResult = await requestOnce(retryHeaders);
        response = retryResult.response;
        payload = retryResult.payload;

        debugLog(
          '[API Retry Response]\n' +
          JSON.stringify({
            method,
            url,
            status: response.status,
            payload: sanitizePayload(payload),
          }, null, 2)
        );

        if (response.ok) {
          return payload;
        }

        const retryHasAuthHeader = Boolean(retryHeaders.Authorization);
        const retryHasAuthContext = retryHasAuthHeader || (isWeb && auth);
        const retryDetailText =
          typeof payload?.detail === 'string'
            ? payload.detail
            : typeof payload?.message === 'string'
              ? payload.message
              : '';
        const retryIsAuthForbidden =
          response.status === 403 &&
          retryHasAuthContext &&
          (
            retryDetailText.toLowerCase().includes('not authenticated') ||
            payload?.detail?.code === 'NOT_AUTHENTICATED'
          );

        if ((response.status === 401 && retryHasAuthContext) || retryIsAuthForbidden) {
          await handleAuthExpired({
            payload,
            status: response.status,
            redirectOnAuthExpired,
          });
          return;
        }
      } else {
        await handleAuthExpired({
          payload,
          status: response.status,
          redirectOnAuthExpired,
        });
        return;
      }
    }

    const error = new Error(getErrorMessage(payload));
    error.status = response.status;
    error.payload = payload;

    // 요청 실패, 약관동의 요구 받은경우
    if (
      response.status === 403 &&
      payload?.detail?.code === "TERMS_NOT_AGREED"
    ) {
      const redirect = "/terms-agree";

      console.info("[Auth] Terms not agreed → redirect", redirect);

      // 뒤로가기 방지
      router.replace(redirect);
      return; // throw 하지 않음
    }

    if (
      response.status === 403 &&
      payload?.detail?.code === "PROFILE_NOT_COMPLETED"
    ) {
      const requestPath = path.startsWith('/') ? path : `/${path}`;
      const isClubJoinRequest =
        method.toUpperCase() === 'POST' &&
        /^\/clubs\/[^/]+\/join\/?$/.test(requestPath);
      const rawRedirect = payload.detail.redirect ?? "/mypage/edit";
      const redirect = (() => {
        if (!rawRedirect.startsWith('/mypage/edit')) return rawRedirect;
        const [path, queryString = ''] = rawRedirect.split('?');
        const params = new URLSearchParams(queryString);
        params.set('profile_required', '1');
        const nextQueryString = params.toString();
        return nextQueryString ? `${path}?${nextQueryString}` : path;
      })();
      const message =
        isClubJoinRequest
          ? "클럽 가입을 위해서는 실명이 필요합니다. 프로필을 먼저 완성해주세요."
          : (
            typeof payload?.detail?.message === "string"
              ? payload.detail.message
              : "프로필을 먼저 완성해주세요."
          );

      console.info("[Auth] Profile not completed → redirect", redirect);

      // 클럽 가입 신청은 호출 화면에서 모달 UX를 띄울 수 있게 throw
      if (isClubJoinRequest) {
        const error = new Error(message);
        error.status = response.status;
        error.payload = payload;
        error.code = "PROFILE_NOT_COMPLETED";
        error.redirect = redirect;
        throw error;
      }

      // 그 외 케이스는 기존처럼 안내 후 프로필 편집으로 유도
      const nextMessage = message;
      if (isWeb && typeof window !== 'undefined') {
        window.alert(nextMessage);
        router.replace(redirect);
        return;
      }
      Alert.alert("안내", nextMessage, [
        { text: "확인", onPress: () => router.replace(redirect) },
      ]);
      return; // throw 하지 않음
    }

    console.warn('[API Error]', {
      method,
      url,
      status: response.status,
      payload: sanitizePayload(payload),
      requiresTermsAgreement: error.requiresTermsAgreement,
    });
    throw error;
  }

  return payload;
};

async function get(url, config = {}) {
  return apiRequest(url, { method: 'GET', ...buildRequestConfig(config) });
}

async function post(url, data, config = {}) {
  return apiRequest(url, {
    method: 'POST',
    body: data,
    ...buildRequestConfig(config),
  });
}

async function put(url, data, config = {}) {
  return apiRequest(url, {
    method: 'PUT',
    body: data,
    ...buildRequestConfig(config),
  });
}

async function patch(url, data, config = {}) {
  return apiRequest(url, {
    method: 'PATCH',
    body: data,
    ...buildRequestConfig(config),
  });
}

// 예약어 delete -> deleteRequest
async function deleteRequest(url, config = {}) {
  return apiRequest(url, { method: 'DELETE', ...buildRequestConfig(config) });
}

async function upload(url, formData, config = {}) {
  return apiRequest(url, {
    method: config.method || 'POST',
    formData,
    ...buildRequestConfig(config),
  });
}

export const apiClient = {
  get,
  post,
  put,
  patch,
  delete: deleteRequest,
  upload,
};

export const oauthRequest = async (path, authData) => {

  const url = `${buildUrl(path)}`;

  const requestHeaders = {
    'Content-Type': 'application/json'
  };

  // console.log('[OAuth Request]', {
  //     url,
  //     method,
  //     headers: requestHeaders,
  //     body: body
  //   });

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(authData)
    });
  } catch (networkError) {
    console.warn('[OAuth Network Error]', {
      method: 'POST',
      url,
      message: networkError?.message,
    });
    throw networkError;
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : null;

  // debugLog('[OAuth Response]', {
  //   method: 'POST',
  //   url,
  //   status: response.status,
  //   payload: sanitizePayload(payload),
  // });

  if (!response.ok) {
    const error = new Error(payload?.detail || payload?.message || 'OAuth 요청에 실패했습니다.');
    error.status = response.status;
    error.payload = payload;
    console.warn('[OAuth Error]', {
      method: 'POST',
      url,
      status: response.status,
      payload: sanitizePayload(payload),
    });
    throw error;
  }

  return payload;
};
