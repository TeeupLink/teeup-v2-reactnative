import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ModerationMenu from '@/components/moderation/ModerationMenu';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { clubsApi } from '@/lib/api/api';
import {
  createFetchRegulationDetailHandler,
  createRegulationEditHandler,
} from '@/lib/handler/clubs';
import { getRegulationUpdatedDate } from '@/lib/util/clubUtils';
import { extractData } from '@/lib/util/responseUtils';
import { colors } from '@/styles/colors';
import { base, tokens } from '@/styles/style';

const CAN_MANAGE_ROLES = ['LEADER', 'MANAGER'];

export default function ClubRegulationDetailScreen() {
  const router = useRouter();
  const { clubId, regulationId } = useLocalSearchParams();
  const resolvedClubId = Array.isArray(clubId) ? clubId[0] : clubId;
  const resolvedRegulationId = Array.isArray(regulationId) ? regulationId[0] : regulationId;

  const [regulation, setRegulation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [canManage, setCanManage] = useState(false);

  const loadClub = useCallback(async () => {
    if (!resolvedClubId) return;
    try {
      const club = extractData(await clubsApi.getClub(resolvedClubId));
      const role = club?.membership_role || club?.my_role;
      setCanManage(CAN_MANAGE_ROLES.includes(String(role).toUpperCase()));
    } catch {
      setCanManage(false);
    }
  }, [resolvedClubId]);

  const loadRegulation = useMemo(
    () =>
      createFetchRegulationDetailHandler({
        clubId: resolvedClubId,
        regulationId: resolvedRegulationId,
        fetchClubRegulation: clubsApi.getClubRegulation,
        extractData,
        setRegulation,
        setIsLoading,
        setError,
      }),
    [resolvedClubId, resolvedRegulationId, setRegulation, setIsLoading, setError]
  );

  useEffect(() => {
    loadClub();
  }, [loadClub]);

  useEffect(() => {
    loadRegulation();
  }, [loadRegulation]);

  const updatedDate = useMemo(
    () => getRegulationUpdatedDate(regulation),
    [regulation]
  );

  const handleEditPress = useMemo(
    () =>
      createRegulationEditHandler({
        router,
        clubId: resolvedClubId || clubId,
        regulationId: resolvedRegulationId,
      }),
    [router, resolvedClubId, clubId, resolvedRegulationId]
  );

  const handleDelete = useCallback(() => {
    Alert.alert(
      '규정 삭제',
      '이 규정을 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await clubsApi.deleteClubRegulation(resolvedClubId, resolvedRegulationId);
              Alert.alert('삭제 완료', '규정이 삭제되었습니다.', [
                {
                  text: '확인',
                  onPress: () => router.replace(`/clubs/${resolvedClubId}/regulations`),
                },
              ]);
            } catch (err) {
              const msg =
                err?.response?.data?.detail || err?.message || '삭제에 실패했습니다.';
              Alert.alert('삭제 실패', msg);
            }
          },
        },
      ]
    );
  }, [resolvedClubId, resolvedRegulationId, router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="규정 상세"
        rightAction={regulation?.id ? (
          <ModerationMenu
            report={{ targetType: 'REGULATION', targetId: regulation.id, targetName: regulation?.title }}
          />
        ) : null}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <Card style={styles.card}>
          {isLoading ? (
            <View style={styles.stateRow}>
              <ActivityIndicator size="small" color={colors.primary[600]} />
              <Text style={styles.stateText}>규정을 불러오는 중...</Text>
            </View>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <>
              <Text style={styles.title}>{regulation?.title || '규정'}</Text>
              <Text style={styles.meta}>마지막 업데이트 {updatedDate}</Text>
              <Text style={styles.body}>{regulation?.content || '등록된 내용이 없습니다.'}</Text>
            </>
          )}
        </Card>

        {canManage && !isLoading && !error && (
          <View style={styles.actions}>
            <Button
              variant="primary"
              size="lg"
              onPress={handleEditPress}
              style={styles.actionBtn}
            >
              수정하기
            </Button>
            <Button
              variant="outline"
              size="lg"
              onPress={handleDelete}
              style={styles.deleteBtn}
              textStyle={styles.deleteBtnText}
            >
              삭제하기
            </Button>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: base.safeAreaNeutral,
  container: base.containerLg,
  card: {
    marginBottom: tokens.spacing.md,
  },
  title: {
    fontSize: tokens.font.title,
    fontWeight: tokens.fontWeight.bold,
    color: colors.neutral[900],
    marginBottom: tokens.spacing.xs,
  },
  meta: {
    fontSize: tokens.font.xs,
    color: colors.neutral[500],
    marginBottom: tokens.spacing.sm2,
  },
  body: {
    fontSize: tokens.font.sm,
    color: colors.neutral[700],
    lineHeight: 18,
  },
  stateRow: base.stateRow,
  stateText: base.stateText,
  errorText: base.textSmError,
  actions: {
    gap: tokens.spacing.sm2,
  },
  actionBtn: {
    marginBottom: tokens.spacing.xs,
  },
  deleteBtn: {
    borderColor: colors.error[300],
  },
  deleteBtnText: {
    color: colors.error[600],
  },
});
