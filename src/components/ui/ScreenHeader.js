import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useIsHydrated, useOptionalResponsiveMetrics } from '@/lib/layout/responsiveMetrics';
import { fontTitle, iconSize } from '@/lib/layout/responsiveTokenHelpers';
import { backOrHome } from '@/lib/navigation/cappedHistory';
import { colors } from '@/styles/colors';
import { tokens } from '@/styles/style';

export default function ScreenHeader({ title, onBack, rightAction }) {
  const router = useRouter();
  const metrics = useOptionalResponsiveMetrics();
  // 아이콘 폰트는 서버 렌더 시점에 로드돼 있지 않아 @expo/vector-icons 가 빈 <Text/> 를
  // 내보낸다. 클라이언트는 첫 렌더부터 글리프를 그리므로 같은 자리가 달라져
  // 하이드레이션이 깨졌다(React #418). BottomNavigationBar 와 같은 방식으로
  // 마운트 후에만 그린다 — 서버도 '아직 아님' 이라 양쪽이 일치한다.
  const hydrated = useIsHydrated();
  const uiScale = metrics?.uiScale ?? 1;
  const minTouch = metrics?.minTouchTarget ?? 44;
  const backBox = useMemo(
    () => Math.max(minTouch, iconSize(16, uiScale) + 16),
    [minTouch, uiScale],
  );
  const iconSz = useMemo(() => iconSize(16, uiScale), [uiScale]);
  const titleSize = useMemo(() => fontTitle('title', metrics?.fontScaleWeak ?? 1), [metrics?.fontScaleWeak]);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    backOrHome(router);
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={handleBack}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={[styles.backButton, { width: backBox, height: backBox }]}
      >
        {hydrated ? <FontAwesome5 name="arrow-left" size={iconSz} color={colors.neutral[700]} /> : null}
      </Pressable>
      <Text style={[styles.title, { fontSize: titleSize }]}>{title}</Text>
      <View style={[styles.backButton, { width: backBox, height: backBox }]}>
        {rightAction ?? null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.padding.md,
    paddingVertical: tokens.padding.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    backgroundColor: colors.white,
  },
  backButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontWeight: tokens.fontWeight.bold,
    color: colors.neutral[900],
  },
});
