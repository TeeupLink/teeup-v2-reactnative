/**
 * 웹 정적 추출(SSR)과 클라이언트 첫 렌더가 어긋나지 않게 막는 장치들.
 *
 * 어긋나면 React 가 #418 을 던지고 서버가 보낸 DOM 을 전부 버리고 다시 그린다.
 * 실제로 두 가지가 어긋나 있었다.
 *
 *  1) 창 크기·safe-area — 서버에는 창이 없어 width/height 가 0 이다.
 *     app/_layout.js 셸에서 SSR 은 min-height:0px / max-width:430px
 *     (getShellMaxWidth(0)), 클라이언트는 min-height:852px / max-width:393px.
 *
 *  2) 아이콘 폰트 — @expo/vector-icons 는 Font.isLoaded() 가 false 면 빈 <Text/> 를
 *     내보낸다. 서버는 항상 false, 클라이언트는 첫 렌더부터 true 라서 같은 자리에
 *     글리프가 생겼다. (createIconSet.js 의 `if (!this.state.fontIsLoaded) return <Text />`)
 *
 * 둘 다 "하이드레이션 전에는 서버와 같은 것을 그린다" 로 맞췄다.
 */
import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import {
  ZERO_INSETS,
  computeResponsiveMetrics,
  useIsHydrated,
} from '@/lib/layout/responsiveMetrics';

describe('useIsHydrated', () => {
  it('웹에서는 마운트 뒤에 true 가 된다', () => {
    const original = Platform.OS;
    Platform.OS = 'web';
    try {
      const { result } = renderHook(() => useIsHydrated());
      // 이펙트가 돈 뒤의 값. 첫 렌더가 false 였는지는 아래 메트릭 테스트로 본다.
      expect(result.current).toBe(true);
    } finally {
      Platform.OS = original;
    }
  });

  it('네이티브는 SSR 이 없으므로 처음부터 true 다', () => {
    const original = Platform.OS;
    Platform.OS = 'ios';
    try {
      const { result } = renderHook(() => useIsHydrated());
      expect(result.current).toBe(true);
    } finally {
      Platform.OS = original;
    }
  });
});

describe('하이드레이션 전 메트릭은 서버가 쓴 값과 같아야 한다', () => {
  // 서버는 창이 없으니 0,0,인셋 0 으로 계산한다
  const server = computeResponsiveMetrics(0, 0, ZERO_INSETS);

  it('서버 쪽 셸 값이 SSR HTML 에서 관측한 것과 같다', () => {
    // 운영 SSR: style="min-height:0px;max-width:430px"
    expect(server.vh(100)).toBe(0);
    expect(server.shellMaxWidth).toBe(430);
  });

  it('실제 창 크기로 계산하면 값이 달라진다 — 그래서 첫 렌더를 맞춰야 한다', () => {
    const client = computeResponsiveMetrics(393, 852, ZERO_INSETS);
    expect(client.vh(100)).toBe(852);
    expect(client.shellMaxWidth).toBe(393);
    expect(client.shellMaxWidth).not.toBe(server.shellMaxWidth);
  });

  it('너비 0 일 때 배율은 1 로 떨어진다 (아이콘·글자 크기가 서버와 같아진다)', () => {
    expect(server.uiScale).toBe(1);
    expect(server.spacingScale).toBe(1);
    expect(server.fontScaleWeak).toBe(1);
    expect(computeResponsiveMetrics(430, 932, ZERO_INSETS).uiScale).toBeGreaterThan(1);
  });

  it('ZERO_INSETS 는 변형할 수 없다', () => {
    expect(ZERO_INSETS).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
    expect(Object.isFrozen(ZERO_INSETS)).toBe(true);
  });
});

describe('SSR 에 들어가는 아이콘은 하이드레이션 가드를 거친다', () => {
  // 가드가 빠지면 그 페이지에서 #418 이 되살아난다. 소스에서 직접 확인한다.
  const read = (p) => require('fs').readFileSync(require('path').join(__dirname, '..', p), 'utf8');

  it.each([
    // [파일, 가드로 쓰는 변수명, 그 변수를 만드는 것]
    ['src/components/ui/ScreenHeader.js', 'hydrated', 'useIsHydrated'],
    ['src/components/layout/GuideBanner.js', 'hydrated', 'useIsHydrated'],
    ['src/components/layout/BottomNavigationBar.js', 'mounted', 'useState'],
  ])('%s 의 FontAwesome5 는 모두 가드 안에 있다', (file, guard, source) => {
    const src = read(file);
    expect(src).toContain(source);

    const lines = src.split('\n');
    const guardRe = new RegExp(`\\b${guard}\\s*\\?`);
    const unguarded = lines.reduce((acc, line, i) => {
      if (!line.includes('<FontAwesome5')) return acc;
      // 같은 줄 또는 바로 앞 줄에 `<guard> ?` 가 있어야 한다
      if (!guardRe.test(line) && !guardRe.test(lines[i - 1] || '')) {
        acc.push(`${i + 1}행: ${line.trim().slice(0, 60)}`);
      }
      return acc;
    }, []);
    expect(unguarded).toEqual([]);
  });
});
