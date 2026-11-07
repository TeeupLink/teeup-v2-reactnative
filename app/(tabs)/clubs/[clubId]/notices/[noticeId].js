import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ModerationMenu from '@/components/moderation/ModerationMenu';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import HtmlContent from '@/components/ui/HtmlContent';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { clubsApi } from '@/lib/api/api';
import { createFetchNoticeDetailHandler, createNoticeEditHandler } from '@/lib/handler/clubs';
import { extractData } from '@/lib/util/responseUtils';
import { colors } from '@/styles/colors';
import { base, tokens } from '@/styles/style';

const CAN_MANAGE_ROLES = ['LEADER', 'MANAGER'];

export default function ClubNoticeDetailScreen() {
  const router = useRouter();
  const { clubId, noticeId } = useLocalSearchParams();
  const resolvedClubId = Array.isArray(clubId) ? clubId[0] : clubId;
  const resolvedNoticeId = Array.isArray(noticeId) ? noticeId[0] : noticeId;

  const [notice, setNotice] = useState(null);
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

  const loadNotice = useMemo(
    () =>
      createFetchNoticeDetailHandler({
        clubId: resolvedClubId,
        noticeId: resolvedNoticeId,
        fetchClubNotice: clubsApi.getClubNotice,
        extractData,
        setNotice,
        setIsLoading,
        setError,
      }),
    [resolvedClubId, resolvedNoticeId, setNotice, setIsLoading, setError]
  );

  useEffect(() => {
    loadClub();
  }, [loadClub]);

  useEffect(() => {
    loadNotice();
  }, [loadNotice]);

  const handleEditPress = useMemo(
    () =>
      createNoticeEditHandler({
        router,
        clubId: resolvedClubId,
      })(resolvedNoticeId),
    [router, resolvedClubId, resolvedNoticeId]
  );

  const handleDelete = useCallback(() => {
    Alert.alert(
      '공지사항 삭제',
      '이 공지사항을 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await clubsApi.deleteClubNotice(resolvedClubId, resolvedNoticeId);
              Alert.alert('삭제 완료', '공지사항이 삭제되었습니다.', [
                {
                  text: '확인',
                  onPress: () => router.replace(`/clubs/${resolvedClubId}/notices`),
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
  }, [resolvedClubId, resolvedNoticeId, router]);

  const createdDate = notice?.created_at
    ? notice.created_at.slice(0, 10)
    : '-';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="공지사항"
        rightAction={notice?.id ? (
          <ModerationMenu
            report={{ targetType: 'CLUB_NOTICE', targetId: notice.id, targetName: notice?.title }}
            blockUser={notice?.author_id != null ? { userId: notice.author_id, userName: notice?.author_name } : null}
            onBlocked={() => router.back()}
          />
        ) : null}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <Card style={styles.card}>
          {isLoading ? (
            <View style={styles.stateRow}>
              <ActivityIndicator size="small" color={colors.primary[600]} />
              <Text style={styles.stateText}>공지사항을 불러오는 중...</Text>
            </View>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <>
              {notice?.is_important && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>중요</Text>
                </View>
              )}
              <Text style={styles.title}>{notice?.title || '-'}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>{notice?.author_name || '-'}</Text>
                <Text style={styles.meta}>{createdDate}</Text>
                <Text style={styles.meta}>조회 {notice?.view_count ?? 0}</Text>
              </View>
              <View style={styles.content}>
                <HtmlContent
                  html={
                    notice?.content
                      ? String(notice.content).includes('<')
                        ? notice.content
                        : `<p>${String(notice.content)
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/\n/g, '<br/>')}</p>`
                      : ''
                  }
                />
              </View>
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
            <Button variant="outline" size="lg" style={styles.deleteBtn} onPress={handleDelete}>
              <Text style={styles.deleteBtnText}>삭제하기</Text>
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
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: tokens.padding.sm,
    paddingVertical: tokens.padding.xxs,
    borderRadius: tokens.radius.base,
    backgroundColor: colors.secondary[500],
    marginBottom: tokens.spacing.sm2,
  },
  badgeText: {
    fontSize: tokens.font.xs,
    fontWeight: tokens.fontWeight.semibold,
    color: colors.white,
  },
  title: {
    fontSize: tokens.font.title,
    fontWeight: tokens.fontWeight.bold,
    color: colors.neutral[900],
    marginBottom: tokens.spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm2,
    marginBottom: tokens.spacing.sm2,
  },
  meta: {
    fontSize: tokens.font.xs,
    color: colors.neutral[500],
  },
  content: {
    marginTop: tokens.spacing.sm2,
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
    borderWidth: 1,
    borderColor: colors.error[300],
    paddingVertical: tokens.padding.base,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
  },
  deleteBtnText: {
    fontSize: tokens.font.sm,
    fontWeight: tokens.fontWeight.semibold,
    color: colors.error[600],
  },
});
