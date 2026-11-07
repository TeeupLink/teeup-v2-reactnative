import { Platform } from 'react-native';

/**
 * 서버로 보낼 FCM 등록 토큰을 얻는다.
 *
 * 플랫폼별로 경로가 다르다.
 * - Android: expo-notifications의 getDevicePushTokenAsync()가 곧 FCM 토큰이다.
 * - iOS: 같은 API는 APNs 디바이스 토큰을 돌려주는데, 백엔드는 firebase-admin의
 *   messaging.send(token=...)로 발송하므로 FCM 토큰이 필요하다.
 *   따라서 Firebase SDK로 APNs 토큰을 FCM 토큰으로 교환해 받는다.
 */
export async function getNativePushToken() {
  if (Platform.OS === 'web') {
    return null;
  }

  if (Platform.OS === 'ios') {
    return getIosFcmToken();
  }

  try {
    const Notifications = await import('expo-notifications');
    const tokenResponse = await Notifications.getDevicePushTokenAsync();
    return tokenResponse?.data ?? null;
  } catch (error) {
    console.warn('FCM 토큰 조회 실패:', error?.message || error);
    return null;
  }
}

async function getIosFcmToken() {
  try {
    const { getApp } = await import('@react-native-firebase/app');
    const {
      getMessaging,
      getToken,
      registerDeviceForRemoteMessages,
      isDeviceRegisteredForRemoteMessages,
    } = await import('@react-native-firebase/messaging');

    const messaging = getMessaging(getApp());

    // APNs 등록이 끝나야 FCM 토큰을 발급받을 수 있다.
    if (!isDeviceRegisteredForRemoteMessages(messaging)) {
      await registerDeviceForRemoteMessages(messaging);
    }

    const token = await getToken(messaging);
    return token ?? null;
  } catch (error) {
    console.warn('iOS FCM 토큰 조회 실패:', error?.message || error);
    return null;
  }
}
