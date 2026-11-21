import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '@/styles/style';

import { getShellMaxWidth } from './responsiveLayout';
import { clampNumber, getContentWindowHeight, vhToPx, vwToPx } from './viewportUnits';

export function getBreakpoint(width) {
  const w = Number(width) || 0;
  const tablet = tokens.layout.breakpointTablet ?? 768;
  const largePhone = tokens.layout.breakpointLargePhone ?? 480;
  const phone = tokens.layout.breakpointPhone ?? 360;
  if (w >= tablet) return 'tablet';
  if (w >= largePhone) return 'largePhone';
  if (w >= phone) return 'phone';
  return 'smallPhone';
}

/**
 * @param {number} width
 * @param {number} height
 * @param {import('react-native-safe-area-context').EdgeInsets} insets
 */
export function computeResponsiveMetrics(width, height, insets) {
  const ref = tokens.layout.referenceDesignWidth ?? 390;
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  const shortest = w > 0 && h > 0 ? Math.min(w, h) : 0;

  const uiMin = tokens.layout.uiScaleMin ?? 0.92;
  const uiMax = tokens.layout.uiScaleMax ?? 1.18;
  const uiScale = w > 0 ? clampNumber(uiMin, w / ref, uiMax) : 1;

  const spMin = tokens.layout.spacingScaleMin ?? 0.96;
  const spMax = tokens.layout.spacingScaleMax ?? 1.1;
  const spacingScale = w > 0 ? clampNumber(spMin, w / ref, spMax) : 1;

  const shMin = tokens.layout.shortScaleMin ?? 0.92;
  const shMax = tokens.layout.shortScaleMax ?? 1.15;
  const shortScale = shortest > 0 ? clampNumber(shMin, shortest / ref, shMax) : 1;

  const fontScaleWeak = 1 + (uiScale - 1) * 0.25;
  const breakpoint = getBreakpoint(w);
  const isTablet = breakpoint === 'tablet';

  const tabletMax = tokens.layout.tabletContentMaxWidth ?? 840;
  const gutter = tokens.layout.tabletContentGutter ?? 32;
  const maxContentWidth = isTablet && w > gutter ? Math.min(w - gutter, tabletMax) : w;

  const contentHeight = getContentWindowHeight(h, insets);
  const hForContentVh = contentHeight > 0 ? contentHeight : h;

  return {
    width: w,
    height: h,
    shortestSide: shortest,
    contentHeight,
    uiScale,
    spacingScale,
    shortScale,
    fontScaleWeak,
    breakpoint,
    isTablet,
    maxContentWidth: Math.max(280, maxContentWidth),
    minTouchTarget: tokens.layout.minTouchTarget ?? 44,
    vh: (pct) => vhToPx(pct, h),
    vw: (pct) => vwToPx(pct, w),
    contentVh: (pct) => vhToPx(pct, hForContentVh),
    shellMaxWidth: getShellMaxWidth(w),
  };
}

export const ResponsiveMetricsContext = createContext(
  /** @type {ReturnType<typeof computeResponsiveMetrics> | null} */ (null),
);

export const ZERO_INSETS = Object.freeze({ top: 0, bottom: 0, left: 0, right: 0 });

/* ---------------------------------------------------------------
   하이드레이션 안전장치.

   웹 정적 추출(SSR)에는 창 크기도 safe-area 도 없어서 서버는 width/height 를
   0 으로 렌더한다. 클라이언트 첫 렌더가 곧바로 실제 창 크기를 쓰면 같은 자리에
   다른 픽셀값이 찍혀 하이드레이션이 깨진다. 실제로 app/_layout.js 의 셸에서
     SSR : min-height:0px;   max-width:430px   (getShellMaxWidth(0))
     CLI : min-height:852px; max-width:393px
   가 나와 모든 페이지에서 React #418 이 떴다. 그러면 React 가 서버가 보낸 DOM 을
   버리고 전체를 다시 그리므로 SSR 이점이 사라진다.

   그래서 첫 렌더는 서버와 똑같이 0 을 쓰고, 마운트 직후 실제 값으로 넘어간다.
   네이티브는 SSR 이 없으므로 처음부터 실제 값을 쓴다.
----------------------------------------------------------------- */
export function useIsHydrated() {
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web');
  useEffect(() => {
    if (!hydrated) setHydrated(true);
  }, [hydrated]);
  return hydrated;
}

/** safe-area 를 직접 쓰는 곳에서도 첫 렌더는 서버와 같아야 한다 */
export function useHydrationSafeInsets() {
  const insets = useSafeAreaInsets();
  const hydrated = useIsHydrated();
  return hydrated ? insets : ZERO_INSETS;
}

export function ResponsiveMetricsProvider({ children }) {
  const { width, height } = useWindowDimensions();
  const rawInsets = useSafeAreaInsets();
  const hydrated = useIsHydrated();

  const w = hydrated ? width : 0;
  const h = hydrated ? height : 0;
  const insets = hydrated ? rawInsets : ZERO_INSETS;

  const value = useMemo(
    () => computeResponsiveMetrics(w, h, insets),
    [w, h, insets.top, insets.bottom, insets.left, insets.right],
  );
  return (
    <ResponsiveMetricsContext.Provider value={value}>{children}</ResponsiveMetricsContext.Provider>
  );
}

export function useResponsiveMetrics() {
  const ctx = useContext(ResponsiveMetricsContext);
  if (!ctx) {
    throw new Error('useResponsiveMetrics must be used within ResponsiveMetricsProvider');
  }
  return ctx;
}

/** Provider 밖(테스트 등)에서 null 가능 */
export function useOptionalResponsiveMetrics() {
  return useContext(ResponsiveMetricsContext);
}
