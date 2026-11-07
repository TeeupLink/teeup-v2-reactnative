import { FontAwesome5 } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { roundsApi } from '@/lib/api/api';
import { backOrHome, navigateWithCap } from '@/lib/navigation/cappedHistory';
import { formatDateTime } from '@/lib/util/meetingUtils';
import { extractData, extractList } from '@/lib/util/responseUtils';
import { colors } from '@/styles/colors';
import { base, tokens } from '@/styles/style';

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '미정';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return `${numeric.toLocaleString('ko-KR')}원`;
}

function getParticipantName(participant) {
  return participant?.user_name || participant?.name || participant?.user?.realname || '참가자';
}

export default function MeetingStatsScreen() {
  const router = useRouter();
  const { meetingId } = useLocalSearchParams();
  const resolvedId = Array.isArray(meetingId) ? meetingId[0] : meetingId;

  const [meeting, setMeeting] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [teams, setTeams] = useState([]);
  const [scoreStats, setScoreStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = useCallback(async () => {
    if (!resolvedId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const [meetingResponse, participantsResponse, teamsResponse, scoreStatsResponse] = await Promise.all([
        roundsApi.getRound(resolvedId),
        roundsApi.getRoundParticipants(resolvedId),
        roundsApi.getRoundTeams(resolvedId),
        roundsApi.getRoundScoreStats(resolvedId).catch(() => null),
      ]);

      setMeeting(extractData(meetingResponse));
      setParticipants(extractList(participantsResponse));
      setTeams(extractList(teamsResponse));
      setScoreStats(scoreStatsResponse ? extractData(scoreStatsResponse) : null);
    } catch (fetchError) {
      console.error('모임 통계 조회 실패:', fetchError);
      setError(fetchError?.message || '모임 통계를 불러오지 못했습니다.');
      setMeeting(null);
      setParticipants([]);
      setTeams([]);
      setScoreStats(null);
    } finally {
      setIsLoading(false);
    }
  }, [resolvedId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const scoreSummary = useMemo(() => {
    if (scoreStats) {
      return {
        totalStrokes: scoreStats?.total_strokes ?? '-',
        average: scoreStats?.average_score ?? '-',
        best: scoreStats?.best_hole ?? '-',
        worst: scoreStats?.worst_hole ?? '-',
      };
    }

    const scoreValues = participants
      .map((participant) =>
        Number(
          participant?.score ??
            participant?.total_score ??
            participant?.simple_score ??
            participant?.average_score
        )
      )
      // 점수를 아직 넣지 않은 참가자는 0 으로 들어온다. 그대로 두면
      // 베스트 스코어가 0 이 되고 평균도 끌어내린다. 골프 스코어에
      // 0 은 없으므로 양수만 센다.
      .filter((value) => Number.isFinite(value) && value > 0);

    if (scoreValues.length === 0) {
      return { totalStrokes: '-', average: '-', best: '-', worst: '-' };
    }

    const average = (scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length).toFixed(1);
    return {
      totalStrokes: scoreValues.reduce((sum, value) => sum + value, 0),
      average,
      best: Math.min(...scoreValues),
      worst: Math.max(...scoreValues),
    };
  }, [participants, scoreStats]);

  const statCards = useMemo(
    () => [
      { id: 'participants', label: '참가자', value: `${participants.length}명` },
      { id: 'teams', label: '팀 수', value: `${teams.length}팀` },
      { id: 'total', label: '총 스트로크', value: scoreSummary.totalStrokes },
      { id: 'avg', label: '평균 스코어', value: scoreSummary.average },
      { id: 'best', label: '베스트 스코어', value: scoreSummary.best },
      { id: 'worst', label: '워스트 스코어', value: scoreSummary.worst },
    ],
    [participants.length, scoreSummary.totalStrokes, scoreSummary.average, scoreSummary.best, scoreSummary.worst, teams.length]
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title="모임 통계" />
        <View style={styles.stateRow}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.stateText}>통계 정보를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !meeting) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title="모임 통계" />
        <View style={styles.stateRow}>
          <Text style={styles.errorText}>{error || '모임 정보를 찾을 수 없습니다.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="모임 통계" />
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable style={styles.backButton} onPress={() => backOrHome(router)}>
          <FontAwesome5 name="arrow-left" size={13} color={colors.neutral[600]} />
          <Text style={styles.backText}>모임 상세</Text>
        </Pressable>

        <Card style={styles.summaryCard}>
          <Text style={styles.meetingTitle}>{meeting?.name || meeting?.meeting_name || '모임'}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>모임 시간</Text>
            <Text style={styles.metaValue}>{formatDateTime(meeting?.meeting_time)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>장소</Text>
            <Text style={styles.metaValue}>{meeting?.location || '-'}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>골프장</Text>
            <Text style={styles.metaValue}>{meeting?.course_name || '-'}</Text>
          </View>
        </Card>

        <View style={styles.grid}>
          {statCards.map((item) => (
            <Card key={item.id} style={styles.statCard}>
              <Text style={styles.statLabel}>{item.label}</Text>
              <Text style={styles.statValue}>{item.value}</Text>
            </Card>
          ))}
        </View>

        {scoreStats ? (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>점수 통계</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>총 스트로크</Text>
              <Text style={styles.metaValue}>{scoreStats?.total_strokes ?? '-'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>평균 스코어</Text>
              <Text style={styles.metaValue}>{scoreStats?.average_score ?? '-'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>최고 홀</Text>
              <Text style={styles.metaValue}>{scoreStats?.best_hole ?? '-'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>최악 홀</Text>
              <Text style={styles.metaValue}>{scoreStats?.worst_hole ?? '-'}</Text>
            </View>
          </Card>
        ) : null}

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>참가자 목록</Text>
          {participants.length === 0 ? (
            <Text style={styles.emptyText}>참가자가 없습니다.</Text>
          ) : (
            participants.map((participant) => {
              return (
                <View key={participant?.id || participant?.user_id} style={styles.participantRow}>
                  <View style={styles.participantInfo}>
                    <Text style={styles.participantName}>{getParticipantName(participant)}</Text>
                    <Text style={styles.participantEmail}>{participant?.user_email || '-'}</Text>
                  </View>
                </View>
              );
            })
          )}
        </Card>

        {teams.length > 0 ? (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>팀 구성</Text>
            {teams.map((team, index) => {
              const members = team?.members || team?.team_members || [];
              return (
                <View key={team?.id || index} style={styles.teamCard}>
                  <Text style={styles.teamTitle}>{team?.name || `팀 ${index + 1}`}</Text>
                  {members.map((member, memberIndex) => (
                    <Text key={member?.id || memberIndex} style={styles.teamMember}>
                      {member?.user_name || member?.name || member?.guest_name || '멤버'}
                    </Text>
                  ))}
                </View>
              );
            })}
          </Card>
        ) : null}

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>비용 정보</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>총 비용</Text>
            <Text style={styles.metaValue}>{formatMoney(meeting?.total_cost)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>그린피</Text>
            <Text style={styles.metaValue}>{formatMoney(meeting?.green_fee)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>캐디피</Text>
            <Text style={styles.metaValue}>{formatMoney(meeting?.caddy_fee)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>카트비</Text>
            <Text style={styles.metaValue}>{formatMoney(meeting?.cart_fee)}</Text>
          </View>
        </Card>

        <View style={styles.actionRow}>
          <Button style={styles.actionButton} onPress={() => navigateWithCap(router, `/meetings/${resolvedId}/expense`)}>
            <Text style={styles.actionButtonText}>정산/경비</Text>
          </Button>
          <Button style={styles.actionButton} onPress={() => navigateWithCap(router, `/meetings/${resolvedId}/score`)}>
            <Text style={styles.actionButtonText}>점수 입력</Text>
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: base.safeAreaNeutral,
  container: base.containerLg,
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: tokens.spacing.sm2,
  },
  backText: {
    fontSize: tokens.font.xs,
    color: colors.neutral[600],
  },
  summaryCard: {
    marginBottom: tokens.spacing.md,
  },
  meetingTitle: {
    fontSize: tokens.font.lg,
    fontWeight: tokens.fontWeight.bold,
    color: colors.neutral[900],
    marginBottom: tokens.spacing.sm2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.sm2,
  },
  statCard: {
    width: '48%',
    marginBottom: tokens.spacing.sm2,
  },
  statLabel: {
    fontSize: tokens.font.xs,
    color: colors.neutral[500],
  },
  statValue: {
    marginTop: 4,
    fontSize: tokens.font.lg,
    fontWeight: tokens.fontWeight.bold,
    color: colors.neutral[900],
  },
  sectionCard: {
    marginBottom: tokens.spacing.sm2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: tokens.spacing.md,
  },
  actionButton: {
    flex: 1,
    borderRadius: tokens.radius.md,
    backgroundColor: colors.primary[600],
    paddingVertical: tokens.padding.sm,
    alignItems: 'center',
  },
  actionButtonText: {
    color: colors.white,
    fontSize: tokens.font.sm,
    fontWeight: tokens.fontWeight.semibold,
  },
  sectionTitle: {
    fontSize: tokens.font.base,
    fontWeight: tokens.fontWeight.bold,
    color: colors.neutral[900],
    marginBottom: tokens.spacing.sm2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  metaLabel: {
    fontSize: tokens.font.xs,
    color: colors.neutral[500],
  },
  metaValue: {
    fontSize: tokens.font.sm,
    color: colors.neutral[800],
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  emptyText: {
    fontSize: tokens.font.sm,
    color: colors.neutral[500],
    textAlign: 'center',
    paddingVertical: tokens.padding.xs,
  },
  participantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tokens.padding.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: tokens.font.sm,
    color: colors.neutral[800],
    fontWeight: tokens.fontWeight.semibold,
  },
  participantEmail: {
    fontSize: tokens.font.xs,
    color: colors.neutral[500],
    marginTop: 2,
  },
  teamCard: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: tokens.radius.md,
    padding: tokens.padding.sm,
    marginBottom: tokens.spacing.sm2,
  },
  teamTitle: {
    fontSize: tokens.font.sm,
    fontWeight: tokens.fontWeight.bold,
    color: colors.neutral[900],
    marginBottom: 4,
  },
  teamMember: {
    fontSize: tokens.font.sm,
    color: colors.neutral[700],
    marginTop: 2,
  },
  stateRow: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stateText: {
    fontSize: tokens.font.sm,
    color: colors.neutral[500],
  },
  errorText: base.textSmError,
});
