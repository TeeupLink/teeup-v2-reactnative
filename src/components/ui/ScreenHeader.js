import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useOptionalResponsiveMetrics } from '@/lib/layout/responsiveMetrics';
import { fontTitle, iconSize } from '@/lib/layout/responsiveTokenHelpers';
import { backOrHome } from '@/lib/navigation/cappedHistory';
import { colors } from '@/styles/colors';
import { tokens } from '@/styles/style';

export default function ScreenHeader({ title, onBack, rightAction }) {
  const router = useRouter();
  const metrics = useOptionalResponsiveMetrics();
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
        <FontAwesome5 name="arrow-left" size={iconSz} color={colors.neutral[700]} />
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
