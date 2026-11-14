import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { appApi } from '@/lib/api/api';
import { getNativeAppVersion, getPlatformKey, isOutdated, openStore } from '@/lib/appVersion';
import { colors } from '@/styles/colors';
import { tokens } from '@/styles/style';

/**
 * 스토어에 새 버전이 올라갔을 때 옛 버전 앱을 막는 화면.
 *
 * 왜 필요한가: 이게 없어서 2026-09-24 빌드를 쓰는 기기에 노션 주소
 * 변경을 반영할 수 없었다. OTA(expo-updates)로도 못 고쳤다 - 그 빌드엔
 * 업데이트 설정 자체가 없어 확인을 안 하기 때문이다.
 *
 * 설계에서 지킨 것:
 * - 실패하면 통과시킨다. 서버가 죽었거나 네트워크가 없으면 앱은 그대로
 *   쓸 수 있어야 한다. 차단을 잘못 걸면 사용자는 앱을 아예 못 쓰고,
 *   우리는 그걸 풀어 줄 수단이 없다.
 * - 판정은 서버가 한다(update_required). 서버 응답을 못 믿을 때를 대비해
 *   클라이언트에서도 같은 규칙으로 한 번 더 본다.
 * - 한 번 막으면 안 푼다. 화면이 열렸다 닫히며 깜빡이지 않게.
 * - 웹은 대상이 아니다. 항상 최신이 서빙된다.
 *
 * 한계: 이 코드가 들어간 버전부터만 동작한다. 그보다 낮은 버전은
 * 확인하는 코드가 없어 영원히 막을 수 없다.
 */

const DEFAULT_MESSAGE = '계속 사용하시려면 최신 버전으로 업데이트해 주세요.';

export default function ForceUpdateGate() {
  const [policy, setPolicy] = useState(null);
  const [isOpening, setIsOpening] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  // 한 번 막히면 유지한다. 재조회 결과로 화면이 닫히면 안 된다.
  const isBlockedRef = useRef(false);

  const check = useCallback(async () => {
    if (Platform.OS === 'web') return;
    if (isBlockedRef.current) return;

    const version = getNativeAppVersion();

    try {
      const result = await appApi.getVersionPolicy({
        platform: getPlatformKey(),
        version,
      });

      // 서버 판정을 먼저 믿고, 못 받았으면 같은 규칙으로 직접 본다.
      const required =
        result?.update_required === true ||
        (result?.update_required == null && isOutdated(version, result?.minimum_version));

      if (!required) return;

      isBlockedRef.current = true;
      setPolicy({
        currentVersion: version,
        latestVersion: result?.latest_version || '',
        storeUrl: result?.store_url || '',
        storeWebUrl: result?.store_web_url || '',
        message: result?.message || DEFAULT_MESSAGE,
      });
    } catch (error) {
      // 통과시킨다. 버전 확인에 실패한 것으로 앱을 못 쓰게 만들 수는 없다.
      console.warn('[ForceUpdate] 버전 확인 실패 - 통과시킴:', error?.message || error);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  // 포그라운드로 돌아올 때 다시 본다. 앱을 며칠 띄워 둔 기기도 잡힌다.
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });

    return () => subscription.remove();
  }, [check]);

  // 안드로이드 하드웨어 뒤로가기로 빠져나가지 못하게 한다.
  // Modal 의 onRequestClose 만으로는 루트 레이아웃의 BackHandler 와
  // 순서가 엇갈릴 수 있어 여기서도 막는다.
  useEffect(() => {
    if (!policy || Platform.OS !== 'android') return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [policy]);

  const handleUpdate = useCallback(async () => {
    if (!policy || isOpening) return;

    setIsOpening(true);
    setOpenFailed(false);
    const opened = await openStore(policy.storeUrl, policy.storeWebUrl);
    setIsOpening(false);
    if (!opened) setOpenFailed(true);
  }, [policy, isOpening]);

  if (Platform.OS === 'web' || !policy) return null;

  const storeName = Platform.OS === 'ios' ? 'App Store' : 'Play 스토어';

  return (
    <Modal
      visible
      animationType="fade"
      // 닫을 수 없는 화면이다. 뒤로가기를 눌러도 아무 일도 일어나지 않는다.
      onRequestClose={() => {}}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>업데이트가 필요합니다</Text>
          <Text style={styles.message}>{policy.message}</Text>

          {policy.latestVersion ? (
            <View style={styles.versionRow}>
              <Text style={styles.versionLabel}>현재 {policy.currentVersion || '-'}</Text>
              <Text style={styles.versionArrow}>→</Text>
              <Text style={styles.versionLatest}>최신 {policy.latestVersion}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleUpdate}
            disabled={isOpening}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              isOpening && styles.buttonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${storeName}에서 업데이트`}
          >
            {isOpening ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>{storeName}에서 업데이트</Text>
            )}
          </Pressable>

          {openFailed ? (
            <Text style={styles.failText}>
              스토어를 열지 못했습니다. {storeName}에서 &apos;티업링크&apos;를 직접 검색해 주세요.
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.padding.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.white,
    borderRadius: tokens.radius.lg,
    paddingVertical: tokens.padding.xl,
    paddingHorizontal: tokens.padding.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: tokens.font.xl,
    fontWeight: tokens.fontWeight.bold,
    color: colors.neutral[900],
    marginBottom: tokens.padding.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: tokens.font.base,
    lineHeight: 21,
    color: colors.neutral[600],
    textAlign: 'center',
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.padding.xs,
    marginTop: tokens.padding.md,
    paddingVertical: tokens.padding.xs,
    paddingHorizontal: tokens.padding.sm,
    borderRadius: tokens.radius.sm,
    backgroundColor: colors.neutral[100],
  },
  versionLabel: {
    fontSize: tokens.font.sm,
    color: colors.neutral[500],
  },
  versionArrow: {
    fontSize: tokens.font.sm,
    color: colors.neutral[400],
  },
  versionLatest: {
    fontSize: tokens.font.sm,
    fontWeight: tokens.fontWeight.semibold,
    color: colors.primary[600],
  },
  button: {
    marginTop: tokens.padding.lg,
    width: '100%',
    height: 48,
    borderRadius: tokens.radius.md,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: colors.primary[700],
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: tokens.font.lg,
    fontWeight: tokens.fontWeight.semibold,
    color: colors.white,
  },
  failText: {
    marginTop: tokens.padding.sm,
    fontSize: tokens.font.sm,
    lineHeight: 18,
    color: colors.error[600],
    textAlign: 'center',
  },
});
