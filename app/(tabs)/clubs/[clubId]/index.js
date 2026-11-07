import { FontAwesome5 } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView, StyleSheet, Text,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ModerationMenu from '@/components/moderation/ModerationMenu';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { clubsApi, regionApi } from '@/lib/api/api';
import {
  createFetchClubDetailHandler,
  createOpenManageHandler,
  createOpenMembersHandler,
} from '@/lib/handler/clubs';
import { buildClubDetailDisplay } from '@/lib/util/clubUtils';
import { extractData, extractList } from '@/lib/util/responseUtils';
import { colors } from '@/styles/colors';
import { base, tokens } from '@/styles/style';





export default function ClubDetailScreen() {
  const router = useRouter();
  const { clubId } = useLocalSearchParams();
  const resolvedId = Array.isArray(clubId) ? clubId[0] : clubId;
  const [club, setClub] = useState(null);
  const [regionLabel, setRegionLabel] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isJoinSubmitting, setIsJoinSubmitting] = useState(false);
  const [profileRequiredModalOpen, setProfileRequiredModalOpen] = useState(false);
  const [profileRequiredRedirect, setProfileRequiredRedirect] = useState('/mypage/edit?profile_required=1');
  const [profileRequiredMessage, setProfileRequiredMessage] = useState(
    '클럽 가입을 위해서는 실명이 필요합니다. 프로필을 먼저 완성해주세요.'
  );

  const loadClub = useMemo(
    () =>
      createFetchClubDetailHandler({
        clubId: resolvedId,
        fetchClubDetail: clubsApi.getClub,
        extractData,
        setClub,
        setIsLoading,
        setError,
      }),
    [resolvedId, setClub, setIsLoading, setError]
  );

  useEffect(() => {
    loadClub();
  }, [loadClub]);

  useEffect(() => {
    if (!club) {
      setRegionLabel('');
      return;
    }
    let isActive = true;
    const sidoCode = club?.sido_code || club?.sidoCode || '';
    const rawGunguCodes = club?.gungu_codes || club?.gunguCodes || [];
    const gunguCodes = Array.isArray(rawGunguCodes) ? rawGunguCodes : [];

    if (!sidoCode) {
      setRegionLabel('');
      return () => {
        isActive = false;
      };
    }

    const fetchRegionLabel = async () => {
      try {
        const [sidoRes, gunguRes] = await Promise.all([
          regionApi.getSidoList(),
          regionApi.getGunguList(sidoCode),
        ]);
        const sidoList = extractList(sidoRes);
        const gunguList = extractList(gunguRes);
        if (!isActive) return;

        const sidoName = sidoList.find((o) => String(o.code) === String(sidoCode))?.name || '';
        const gunguNameMap = Object.fromEntries(
          gunguList.map((o) => [String(o.code), o.name])
        );
        const gunguNames = gunguCodes
          .map((code) => gunguNameMap[String(code)])
          .filter(Boolean);
        const label = sidoName
          ? gunguNames.length > 0
            ? `${sidoName}, ${gunguNames.join(', ')}`
            : sidoName
          : gunguNames.length > 0
            ? gunguNames.join(', ')
            : '';
        setRegionLabel(label);
      } catch (err) {
        console.error('시도군구 조회 실패:', err);
        if (isActive) setRegionLabel('');
      }
    };

    fetchRegionLabel();
    return () => {
      isActive = false;
    };
  }, [club]);

  const display = useMemo(() => buildClubDetailDisplay(club), [club]);
  const hasRegionCodes = !!(
    club?.sido_code ||
    club?.sidoCode ||
    (Array.isArray(club?.gungu_codes || club?.gunguCodes) && (club?.gungu_codes || club?.gunguCodes).length > 0)
  );
  const locationDisplay =
    regionLabel || (!hasRegionCodes ? display.location : null) || '-';
  const handleManagePress = useMemo(
    () => createOpenManageHandler({ clubId: resolvedId, router }),
    [resolvedId, router]
  );
  const handleOpenMemberListPress = useMemo(
    () => createOpenMembersHandler({ clubId: resolvedId, router }),
    [resolvedId, router]
  );
  const handleOpenApplicationStatusPress = useMemo(
    () => createOpenMembersHandler({ clubId: resolvedId, router, manage: true }),
    [resolvedId, router]
  );
  const handleOpenJoinApplications = useMemo(
    () => () => {
      router.replace({ pathname: '/clubs', params: { tab: 'join-applications' } });
    },
    [router]
  );
  const handleJoinPress = useMemo(
    () => async () => {
      if (!resolvedId) return;
      try {
        setIsJoinSubmitting(true);
        const response = await clubsApi.joinClub(resolvedId);
        if (!response) return;
        const message = response?.message || '클럽 가입 신청이 완료되었습니다.';
        Alert.alert('가입 신청 완료', message, [
          { text: '닫기', style: 'cancel' },
          { text: '가입 신청 내역 보기', onPress: () => handleOpenJoinApplications?.() },
        ]);
        await loadClub?.();
      } catch (joinError) {
        const isProfileNotCompleted =
          joinError?.status === 403 &&
          (
            joinError?.payload?.detail?.code === 'PROFILE_NOT_COMPLETED' ||
            joinError?.code === 'PROFILE_NOT_COMPLETED'
          );
        if (isProfileNotCompleted) {
          setProfileRequiredMessage(
            '클럽 가입을 위해서는 실명이 필요합니다. 프로필을 먼저 완성해주세요.'
          );
          setProfileRequiredRedirect(
            joinError?.redirect ||
            joinError?.payload?.detail?.redirect ||
            '/mypage/edit?profile_required=1'
          );
          setProfileRequiredModalOpen(true);
          return;
        }

        console.error('클럽 가입 신청 실패:', joinError);
        Alert.alert('가입 신청 실패', joinError?.message || '클럽 가입 신청 중 오류가 발생했습니다.');
      } finally {
        setIsJoinSubmitting(false);
      }
    },
    [resolvedId, loadClub, handleOpenJoinApplications]
  );

  const closeProfileRequiredModal = useMemo(
    () => () => setProfileRequiredModalOpen(false),
    []
  );
  const goProfileEditFromModal = useMemo(
    () => () => {
      setProfileRequiredModalOpen(false);
      router.replace(profileRequiredRedirect);
    },
    [router, profileRequiredRedirect]
  );

  const membershipStatus = String(club?.membership_status || '').toUpperCase().trim();
  const membershipRole = String(club?.membership_role || '').toUpperCase().trim();
  const isApprovedMember = membershipStatus === 'ACTIVE' || membershipStatus === 'APPROVED';
  const isManagerOrLeader = isApprovedMember && ['LEADER', 'MANAGER'].includes(membershipRole);
  const isGeneralMember = isApprovedMember && membershipRole === 'MEMBER';
  const isPendingApplicant = membershipStatus === 'PENDING';

  const handleOpenNotices = useMemo(
    () => () => {
      router.push(`/clubs/${resolvedId}/notices`);
    },
    [router, resolvedId]
  );
  const handleOpenRegulations = useMemo(
    () => () => {
      router.push(`/clubs/${resolvedId}/regulations`);
    },
    [router, resolvedId]
  );
  const handleOpenFees = useMemo(
    () => () => {
      router.push(`/clubs/${resolvedId}/fees`);
    },
    [router, resolvedId]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="클럽 상세"
        rightAction={club?.id ? (
          <ModerationMenu report={{ targetType: 'CLUB', targetId: club.id, targetName: club.name }} />
        ) : null}
      />
      <ScrollView contentContainerStyle={styles.container}>
        {isLoading ? (
          <Card style={styles.heroCard}>
            <View style={styles.stateRow}>
              <ActivityIndicator size="small" color={colors.primary[600]} />
              <Text style={styles.stateText}>클럽 정보를 불러오는 중...</Text>
            </View>
          </Card>
        ) : error ? (
          <Card style={styles.heroCard}>
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : (
          <>
            <Card style={styles.heroCard}>
              <Text style={styles.clubName}>{display.clubName}</Text>
              <Text style={styles.clubSubtitle}>{display.clubSubtitle}</Text>
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <FontAwesome5 name="map-marker-alt" size={12} color={colors.neutral[500]} />
                  <Text style={styles.metaText}>{locationDisplay}</Text>
                </View>
                <View style={styles.metaItem}>
                  <FontAwesome5 name="users" size={12} color={colors.neutral[500]} />
                  <Text style={styles.metaText}>멤버 {display.memberCount}명</Text>
                </View>
              </View>
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{display.clubTypeLabel}</Text>
                </View>
                <View style={[styles.badge, styles.badgeAccent]}>
                  <Text style={styles.badgeText}>{display.clubStatusLabel}</Text>
                </View>
              </View>
            </Card>

            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>클럽 소개</Text>
              <Text style={styles.sectionText}>{display.clubIntro}</Text>
            </Card>

            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>운영 정보</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>개설일</Text>
                <Text style={styles.infoValue}>{display.createdAtDisplay}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>활동 지역</Text>
                <Text style={styles.infoValue}>{locationDisplay}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>대표자</Text>
                <Text style={styles.infoValue}>{display.representativeName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>연락처</Text>
                <Text style={styles.infoValue}>{display.contactInfo}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>추가 정보</Text>
                <Text style={styles.infoValue}>{display.additionalInfo}</Text>
              </View>
            </Card>

            {isApprovedMember ? (
              <Card style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>클럽 메뉴</Text>
                <Text style={styles.sectionText}>공지/규정/회비 정보를 확인하세요.</Text>
                <View style={styles.memberMenuGrid}>
                  <View style={styles.memberMenuRowHalf}>
                    <Button variant="outline" size="sm" onPress={handleOpenMemberListPress} style={styles.memberMenuButton}>
                      회원목록
                    </Button>
                    <Button variant="outline" size="sm" onPress={handleOpenNotices} style={styles.memberMenuButton}>
                      클럽 공지사항
                    </Button>
                  </View>
                  <View style={styles.memberMenuRowHalf}>
                    <Button variant="outline" size="sm" onPress={handleOpenRegulations} style={styles.memberMenuButton}>
                      클럽 규정
                    </Button>
                    <Button variant="outline" size="sm" onPress={handleOpenFees} style={styles.memberMenuButton}>
                      클럽 회비
                    </Button>
                  </View>
                </View>
              </Card>
            ) : null}
          </>
        )}

        {!isLoading && !error ? (
          <View style={styles.actionRow}>
            {isManagerOrLeader ? (
              <>
                <Button variant="primary" size="lg" onPress={handleManagePress}>
                  클럽 관리
                </Button>
                <Button variant="outline" size="lg" onPress={handleOpenApplicationStatusPress} style={styles.actionGap}>
                  가입 신청 현황
                </Button>
              </>
            ) : isGeneralMember ? null : isPendingApplicant ? (
              <Button variant="outline" size="lg" onPress={handleOpenJoinApplications}>
                가입 신청 내역 보기
              </Button>
            ) : (
              <Button variant="primary" size="lg" onPress={handleJoinPress} loading={isJoinSubmitting}>
                클럽 가입 신청
              </Button>
            )}
          </View>
        ) : null}
      </ScrollView>

      <Modal
        maxContentWidth={tokens.layout.wideContentMaxPreferred}
        visible={profileRequiredModalOpen}
        title="프로필 미완성"
        onClose={closeProfileRequiredModal}
        animationType="fade"
        containerStyle={styles.modalCard}
        backdropStyle={styles.modalBackdrop}
        footer={(
          <View style={styles.modalActionRow}>
            <Button size="sm" variant="outline" onPress={closeProfileRequiredModal}>
              아니오
            </Button>
            <Button size="sm" onPress={goProfileEditFromModal}>
              예
            </Button>
          </View>
        )}
      >
        <Text style={styles.modalMessage}>
          {profileRequiredMessage}
          {'\n\n'}
          프로필을 만들겠습니까?
        </Text>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: base.safeAreaNeutral,
  container: base.containerLg,
  modalCard: {
    width: '100%',
    alignSelf: 'center',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.52)',
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: tokens.spacing.xs,
  },
  modalMessage: {
    fontSize: tokens.font.sm,
    color: colors.neutral[700],
  },
  heroCard: {
    marginBottom: tokens.spacing.md,
  },
  clubName: {
    fontSize: tokens.font.display,
    fontWeight: tokens.fontWeight.bold,
    color: colors.neutral[900],
    marginBottom: tokens.spacing.xs,
  },
  clubSubtitle: {
    fontSize: tokens.font.md,
    color: colors.neutral[600],
    marginBottom: tokens.spacing.sm2,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: tokens.spacing.sm2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: tokens.spacing.sm2,
  },
  metaText: {
    fontSize: tokens.font.sm,
    color: colors.neutral[600],
    marginLeft: tokens.spacing.xxs,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  badge: {
    paddingHorizontal: tokens.padding.base,
    paddingVertical: tokens.padding.xxs,
    borderRadius: tokens.radius.md,
    backgroundColor: colors.primary[50],
    marginRight: tokens.spacing.xs2,
  },
  badgeAccent: {
    backgroundColor: colors.success[50],
  },
  badgeText: {
    fontSize: tokens.font.xs,
    color: colors.primary[700],
    fontWeight: tokens.fontWeight.semibold,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stateText: {
    marginLeft: tokens.spacing.xs2,
    fontSize: tokens.font.sm,
    color: colors.neutral[500],
  },
  sectionCard: {
    marginBottom: tokens.spacing.md,
  },
  sectionTitle: { ...base.sectionTitleMd, marginBottom: tokens.spacing.xs2 },
  sectionText: {
    fontSize: tokens.font.sm,
    color: colors.neutral[600],
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: tokens.padding.xs2,
  },
  infoLabel: {
    fontSize: tokens.font.sm,
    color: colors.neutral[500],
  },
  infoValue: {
    fontSize: tokens.font.sm,
    color: colors.neutral[800],
    fontWeight: tokens.fontWeight.semibold,
  },
  actionRow: {
    marginTop: tokens.spacing.xs2,
  },
  actionGap: {
    marginTop: tokens.spacing.sm2,
  },
  memberMenuGrid: {
    marginTop: tokens.spacing.sm2,
    gap: tokens.spacing.sm2,
  },
  memberMenuRowHalf: {
    flexDirection: 'row',
    gap: 8,
  },
  memberMenuButton: {
    flex: 1,
  },
  errorText: base.textSmError,
});
