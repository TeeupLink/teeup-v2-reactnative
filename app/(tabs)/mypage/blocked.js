import { FontAwesome5 } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Card from '@/components/ui/Card';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { useBlockedUsers } from '@/context/BlockContext';
import { colors } from '@/styles/colors';
import { base, tokens } from '@/styles/style';

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

export default function BlockedUsersScreen() {
  const { blockedUsers, isLoaded, refresh, unblock } = useBlockedUsers();
  const [unblockingId, setUnblockingId] = useState(null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const handleUnblock = (user) => {
    Alert.alert(
      '차단 해제',
      `'${user.nickname || '사용자'}'님의 차단을 해제하시겠습니까?\n해제하면 이 사용자의 콘텐츠가 다시 표시됩니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '해제',
          onPress: async () => {
            setUnblockingId(user.user_id);
            try {
              await unblock(user.user_id);
            } catch (e) {
              Alert.alert('해제 실패', e?.message || '차단 해제 중 오류가 발생했습니다.');
            } finally {
              setUnblockingId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="차단 관리" />
      <ScrollView contentContainerStyle={styles.container}>
        <Card style={styles.infoCard}>
          <Text style={styles.infoText}>
            차단한 사용자가 작성한 클럽·모임·공지 등 콘텐츠는 표시되지 않습니다.
            차단을 해제하면 다시 볼 수 있습니다.
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>차단한 사용자 {isLoaded ? `(${blockedUsers.length})` : ''}</Text>
          {!isLoaded ? (
            <View style={styles.stateRow}>
              <ActivityIndicator size="small" color={colors.primary[600]} />
              <Text style={styles.stateText}>불러오는 중...</Text>
            </View>
          ) : blockedUsers.length === 0 ? (
            <View style={styles.stateRow}>
              <Text style={styles.stateText}>차단한 사용자가 없습니다.</Text>
            </View>
          ) : (
            blockedUsers.map((user) => (
              <View key={user.user_id} style={styles.row}>
                <View style={styles.avatar}>
                  <FontAwesome5 name="user-slash" size={14} color={colors.neutral[500]} />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.name}>{user.nickname || `사용자 #${user.user_id}`}</Text>
                  <Text style={styles.meta}>차단일 {formatDate(user.blocked_at)}</Text>
                </View>
                <Pressable
                  onPress={() => handleUnblock(user)}
                  disabled={unblockingId === user.user_id}
                  style={({ pressed }) => [styles.unblockBtn, pressed && styles.unblockBtnPressed]}
                >
                  {unblockingId === user.user_id ? (
                    <ActivityIndicator size="small" color={colors.neutral[700]} />
                  ) : (
                    <Text style={styles.unblockText}>차단 해제</Text>
                  )}
                </Pressable>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: base.tabScreenSafeArea,
  container: base.container,
  infoCard: {
    marginBottom: tokens.padding.md,
    backgroundColor: colors.neutral[50],
  },
  infoText: {
    fontSize: tokens.font.sm,
    color: colors.neutral[600],
    lineHeight: 20,
  },
  card: {
    gap: tokens.padding.sm,
  },
  sectionTitle: {
    fontSize: tokens.font.md,
    fontWeight: tokens.fontWeight.bold,
    color: colors.neutral[900],
    marginBottom: tokens.padding.xs,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.padding.sm,
    paddingVertical: tokens.padding.md,
  },
  stateText: {
    fontSize: tokens.font.sm,
    color: colors.neutral[500],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.padding.sm,
    paddingVertical: tokens.padding.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: {
    flex: 1,
  },
  name: {
    fontSize: tokens.font.md,
    fontWeight: tokens.fontWeight.semibold,
    color: colors.neutral[900],
  },
  meta: {
    fontSize: tokens.font.xs,
    color: colors.neutral[500],
    marginTop: 2,
  },
  unblockBtn: {
    paddingHorizontal: tokens.padding.sm,
    paddingVertical: tokens.padding.xs,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    minWidth: 72,
    alignItems: 'center',
  },
  unblockBtnPressed: {
    backgroundColor: colors.neutral[100],
  },
  unblockText: {
    fontSize: tokens.font.sm,
    color: colors.neutral[700],
    fontWeight: tokens.fontWeight.semibold,
  },
});
