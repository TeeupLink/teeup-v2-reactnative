
import * as NavigationBar from 'expo-navigation-bar';
import {
  Slot,
  useGlobalSearchParams,
  usePathname,
  useRouter
} from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { BackHandler, Platform, StyleSheet, ToastAndroid, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import BottomNavigationBar from '@/components/layout/BottomNavigationBar';
import FullMenu from '@/components/layout/FullMenu';
import GuideBanner, { guideBannerOffset } from '@/components/layout/GuideBanner';
import { AppLayoutProvider } from '@/context/AppLayoutContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { BlockProvider } from '@/context/BlockContext';
import { authApi } from '@/lib/api/api';
import { ResponsiveMetricsProvider, useResponsiveMetrics } from '@/lib/layout/responsiveMetrics';
import { backOrHome, getHistorySnapshot, markHistoryTraversal, navigateWithCap, syncRouteHistory } from '@/lib/navigation/cappedHistory';
import { colors } from '@/styles/colors';

/** Google Tag Manager 컨테이너 ID (웹 전용) */
const GTM_CONTAINER_ID = 'GTM-NG89M36G';

function getNotificationRoute(data = {}) {
  const category = data?.category || data?.type || data?.notification_type;
  const targetId = data?.target_id || data?.targetId || data?.id;
  const meetingType = data?.meeting_type || data?.meetingType;
  const clubId = data?.club_id || data?.clubId;

  if (category === 'meeting' && targetId) {
    const slug = meetingType === 'social' ? 'social' : 'rounding';
    return `/meetings/${slug}/${targetId}`;
  }

  // 선택한 알림 카테고리에 따라 라우팅 경로 반환
  if (category === 'meeting_rounding' && targetId) return `/meetings/rounding/${targetId}`;
  if (category === 'meeting_social' && targetId) return `/meetings/social/${targetId}`;
  if (category === 'club' && targetId) return `/clubs/${targetId}`;
  if (category === 'club_notice' && clubId) return `/clubs/${clubId}/notices`;
  if (category === 'notice' && targetId) return `/notices/${targetId}`;

  return null;
}

function routeByNotification(router, notification) {
  const data = notification?.request?.content?.data;
  if (!data || typeof data !== 'object') return;
  const route = getNotificationRoute(data);
  if (!route) return;
  navigateWithCap(router, route);
}

async function setupNotificationChannel(Notifications) {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: '기본',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function ensureNotificationPermission(Notifications) {
  const permission = await Notifications.getPermissionsAsync();
  if (permission.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return Boolean(requested.granted);
}

function buildRouteWithSearch(pathname, params) {
  const entries = Object.entries(params || {}).filter(([, value]) => value !== undefined);
  if (!entries.length) return pathname;

  const searchParams = new URLSearchParams();
  entries
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          searchParams.append(key, String(item));
        });
        return;
      }

      searchParams.append(key, String(value));
    });

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function AppShell() {
  const metrics = useResponsiveMetrics();
  const { width: windowWidth } = useWindowDimensions();
  const shellMaxWidth = Platform.OS === 'web' ? metrics.shellMaxWidth : undefined;
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const globalSearchParams = useGlobalSearchParams();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const handledNotificationIdsRef = useRef(new Set());
  const lastBackPressedAtRef = useRef(0);
  const isRootEntry = pathname === '/';
  const currentRoute = buildRouteWithSearch(pathname, globalSearchParams);

  useEffect(() => {
    if (isRootEntry) return;
    syncRouteHistory(currentRoute);
  }, [currentRoute, isRootEntry]);

  useEffect(() => {
    if (isRootEntry) return undefined;

    if (Platform.OS === 'android') {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (pathname === '/app' && getHistorySnapshot().length <= 1) {
          const now = Date.now();
          if (now - lastBackPressedAtRef.current < 2000) {
            BackHandler.exitApp();
            return true;
          }
          lastBackPressedAtRef.current = now;
          ToastAndroid.show('한 번 더 누르면 종료됩니다.', ToastAndroid.SHORT);
          return true;
        }
        backOrHome(router);
        return true;
      });

      return () => {
        subscription.remove();
      };
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handlePopstate = () => {
        if (getHistorySnapshot().length <= 1) {
          backOrHome(router);
          return;
        }

        markHistoryTraversal();
      };

      window.addEventListener('popstate', handlePopstate);

      return () => {
        window.removeEventListener('popstate', handlePopstate);
      };
    }

    return undefined;
  }, [isRootEntry, pathname, router]);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    if (isLoading || !isAuthenticated) return undefined;

    let isUnmounted = false;
    let receivedSubscription = null;
    let responseSubscription = null;

    const handleRouteOnce = (notification) => {
      const identifier = notification?.request?.identifier;
      if (!identifier) {
        routeByNotification(router, notification);
        return;
      }

      if (handledNotificationIdsRef.current.has(identifier)) return;
      handledNotificationIdsRef.current.add(identifier);
      routeByNotification(router, notification);
    };

    const setup = async () => {
      try {
        const Notifications = await import('expo-notifications');
        if (isUnmounted) return;

        receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
          const data = notification?.request?.content?.data;
          console.log('[Push Received]', data);
        });

        responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
          handleRouteOnce(response?.notification);
        });

        await setupNotificationChannel(Notifications);
        const granted = await ensureNotificationPermission(Notifications);
        await authApi.syncPushToken({ enabled: true });
        if (!granted || isUnmounted) return;

        const initialResponse = await Notifications.getLastNotificationResponseAsync();
        if (initialResponse?.notification && !isUnmounted) {
          handleRouteOnce(initialResponse.notification);
        }
      } catch (error) {
        console.warn('알림 초기화 실패:', error?.message || error);
      }
    };

    setup();

    return () => {
      isUnmounted = true;
      receivedSubscription?.remove();
      responseSubscription?.remove();
    };
  }, [isAuthenticated, isLoading, router]);

  // 웹 전용: Google Tag Manager (/에서는 로드하지 않음)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || isRootEntry) return;

    const script = document.createElement('script');
    script.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_CONTAINER_ID}');`;
    document.head.appendChild(script);

    const noscript = document.createElement('noscript');
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.googletagmanager.com/ns.html?id=${GTM_CONTAINER_ID}`;
    iframe.height = '0';
    iframe.width = '0';
    iframe.style.display = 'none';
    iframe.style.visibility = 'hidden';
    noscript.appendChild(iframe);
    document.body.insertBefore(noscript, document.body.firstChild);
  }, [isRootEntry]);

  return (
    <View
      style={[
        styles.root,
        { minHeight: metrics.vh(100) },
        Platform.OS === 'web' &&
          !isRootEntry &&
          shellMaxWidth != null && {
            maxWidth: shellMaxWidth,
            width: '100%',
            alignSelf: 'center',
          },
      ]}
    >
      <View style={[styles.shell, { paddingBottom: isRootEntry ? 0 : guideBannerOffset(insets) }]}>
        <View style={styles.main}>
          <Slot />
        </View>
      </View>
      {!isRootEntry ? <GuideBanner /> : null}
      {!isRootEntry ? <BottomNavigationBar /> : null}
      {!isRootEntry ? <FullMenu /> : null}
      {/* !!!!!!!!!!!!!!!!!!!!! 디버그 오버레이 TODO 출시시 삭제 !!!!!!!!!!!!!!!!!!!!!! */}
      {/*<DebugConsoleOverlay />*/}
      {/* !!!!!!!!!!!!!!!!!!!!! 디버그 오버레이 !!!!!!!!!!!!!!!!!!!!!! */}
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    (async () => {
      const Notifications = await import('expo-notifications');
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    })();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setPositionAsync('relative');
      NavigationBar.setBackgroundColorAsync(colors.white);
      NavigationBar.setButtonStyleAsync('dark');
    }
  }, []);

  return (
    <SafeAreaProvider>
      <ResponsiveMetricsProvider>
      {/* 2. 웹 PWA를 위한 Head 설정 추가 */}
      <Head>
        <title>티업링크</title>
        <link rel="manifest" href="/manifest.json" />

        {/* iOS PWA */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="TeeUp" />
        <link rel="apple-touch-icon" href="/icons/icon-600-full.png" />
      </Head>

      <StatusBar style="dark" backgroundColor={colors.white} />
      <AuthProvider>
        <BlockProvider>
          <AppLayoutProvider>
            <AppShell />
          </AppLayoutProvider>
        </BlockProvider>
      </AuthProvider>
      </ResponsiveMetricsProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.neutral[50],
  },
  shell: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  main: {
    flex: 1,
  },
});
