import { FontAwesome5 } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView, StyleSheet, Text,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { useBlockedUsers } from '@/context/BlockContext';
import { clubsApi } from '@/lib/api/api';
import { createFetchNoticesHandler, createNoticePressHandler } from '@/lib/handler/clubs';
import { normalizeClubNotices } from '@/lib/util/clubUtils';
import { extractData, extractList } from '@/lib/util/responseUtils';
import { colors } from '@/styles/colors';
import { base, tokens } from '@/styles/style';

const CAN_CREATE_ROLES = ['LEADER', 'MANAGER'];

export default function ClubNoticesScreen() {
  const router = useRouter();
  const { clubId } = useLocalSearchParams();
  const resolvedId = Array.isArray(clubId) ? clubId[0] : clubId;
  const [notices, setNotices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [canCreateNotice, setCanCreateNotice] = useState(false);

  const loadRole = useCallback(async () => {
    if (!resolvedId) return;
    try {
      const club = extractData(await clubsApi.getClub(resolvedId));
      const role = club?.membership_role || club?.my_role;
      setCanCreateNotice(CAN_CREATE_ROLES.includes(String(role).toUpperCase()));
    } catch {
      setCanCreateNotice(false);
    }
  }, [resolvedId]);

  useEffect(() => {
    loadRole();
  }, [loadRole]);

  const loadNotices = useMemo(
    () =>
      createFetchNoticesHandler({
        clubId: resolvedId,
        fetchClubNotices: clubsApi.getClubNotices,
        extractList,
        setNotices,
        setIsLoading,
        setError,
      }),
    [resolvedId, setNotices, setIsLoading, setError]
  );

  useEffect(() => {
    loadNotices();
  }, [loadNotices]);

  const { isBlocked } = useBlockedUsers();
  const normalizedNotices = useMemo(
    () => normalizeClubNotices(notices).filter((n) => !isBlocked(n.authorId)),
    [notices, isBlocked],
  );
  const handleCreatePress = useMemo(
    () => () => {
      router.push(`/clubs/${resolvedId}/notices/create`);
    },
    [router, resolvedId]
  );
  const handleNoticePress = useMemo(
    () => createNoticePressHandler({ router, clubId: resolvedId }),
    [router, resolvedId]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="공지사항" />
      <ScrollView contentContainerStyle={styles.container}>
        {canCreateNotice && (
          <View style={styles.headerRow}>
            <Text style={styles.subtitle}>클럽 공지사항을 확인하세요.</Text>
            <Button variant="primary" size="sm" onPress={handleCreatePress}>
              공지사항 등록
            </Button>
          </View>
        )}
        <Card style={styles.noticeCard}>
          {isLoading ? (
            <View style={styles.stateRow}>
              <ActivityIndicator size="small" color={colors.primary[600]} />
              <Text style={styles.stateText}>공지사항을 불러오는 중...</Text>
            </View>
          ) : error ? (
            <View style={styles.stateRow}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : normalizedNotices.length === 0 ? (
            <View style={styles.stateRow}>
              <Text style={styles.stateText}>등록된 공지사항이 없습니다.</Text>
            </View>
          ) : (
            normalizedNotices.map((notice) => (
              <Pressable
                key={notice.id}
                style={styles.noticeRow}
                onPress={handleNoticePress(notice.id)}
              >
                <View style={styles.noticeIcon}>
                  <FontAwesome5 name="bullhorn" size={14} color={colors.primary[600]} />
                </View>
                <View style={styles.noticeInfo}>
                  <Text style={styles.noticeTitle}>{notice.title}</Text>
                  <Text style={styles.noticeDate}>{notice.date}</Text>
                </View>
                {notice.pinned && (
                  <View style={styles.noticeBadge}>
                    <Text style={styles.noticeBadgeText}>고정</Text>
                  </View>
                )}
                <FontAwesome5 name="chevron-right" size={12} color={colors.neutral[400]} />
              </Pressable>
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: base.safeAreaNeutral,
  container: base.containerLg,
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm2,
  },
  subtitle: base.textSmMuted,
  noticeCard: {
    paddingVertical: tokens.padding.xxs,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.padding.md,
    paddingVertical: tokens.padding.sm,
  },
  noticeIcon: {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.lg,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing.sm2,
  },
  noticeInfo: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: tokens.font.base,
    fontWeight: tokens.fontWeight.semibold,
    color: colors.neutral[800],
  },
  noticeDate: {
    fontSize: tokens.font.xs,
    color: colors.neutral[500],
    marginTop: tokens.spacing.hairline,
  },
  noticeBadge: {
    paddingHorizontal: tokens.padding.xs,
    paddingVertical: tokens.padding.xxs,
    borderRadius: tokens.radius.base,
    backgroundColor: colors.secondary[500],
  },
  noticeBadgeText: {
    fontSize: tokens.font.xxs,
    fontWeight: tokens.fontWeight.semibold,
    color: colors.white,
  },
  stateRow: base.stateRow,
  stateText: base.stateText,
  errorText: base.textSmError,
});
