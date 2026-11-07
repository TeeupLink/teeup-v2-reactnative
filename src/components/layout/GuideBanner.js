import { FontAwesome5 } from '@expo/vector-icons';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bottomNavHeight } from '@/components/layout/BottomNavigationBar';
import { colors } from '@/styles/colors';
import { tokens } from '@/styles/style';

// 사용설명서(Notion) 배너. 하단 탭바 바로 위에 고정되며, 탭하면 외부 브라우저로 연다.
export const GUIDE_URL = 'https://justicelab.notion.site/teeup-guide';

export const GUIDE_BANNER_HEIGHT = 44;

export function guideBannerOffset(insets) {
  return bottomNavHeight(insets) + GUIDE_BANNER_HEIGHT;
}

export function openGuide() {
  if (Platform.OS === 'web') {
    window.open(GUIDE_URL, '_blank', 'noopener,noreferrer');
    return;
  }
  Linking.openURL(GUIDE_URL).catch(() => {});
}

export default function GuideBanner() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { bottom: bottomNavHeight(insets) }]}>
      <Pressable
        onPress={openGuide}
        style={({ pressed }) => [styles.banner, pressed && styles.bannerPressed]}
        accessibilityRole="link"
        accessibilityLabel="사용설명서 열기"
      >
        <View style={styles.iconWrap}>
          <FontAwesome5 name="book-open" size={12} color={colors.primary[600]} />
        </View>
        <Text style={styles.text}>티업링크 사용설명서</Text>
        <Text style={styles.subText}>처음이신가요?</Text>
        <FontAwesome5 name="external-link-alt" size={11} color={colors.neutral[400]} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  banner: {
    height: GUIDE_BANNER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.padding.xs,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    paddingHorizontal: tokens.padding.md,
  },
  bannerPressed: {
    backgroundColor: colors.neutral[100],
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[50],
  },
  text: {
    fontSize: tokens.font.sm,
    fontWeight: tokens.fontWeight.semibold,
    color: colors.neutral[800],
  },
  subText: {
    fontSize: tokens.font.xs,
    color: colors.neutral[500],
  },
});
