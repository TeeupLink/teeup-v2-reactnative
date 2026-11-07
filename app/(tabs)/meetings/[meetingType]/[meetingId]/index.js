import { FontAwesome5 } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView, StyleSheet, Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BatchFormationModal from '@/components/meetings/BatchFormationModal';
import FormationHistoryModal from '@/components/meetings/FormationHistoryModal';
import MeetingWorkflowStatus from '@/components/meetings/MeetingWorkflowStatus';
import RoundingCompleteModal from '@/components/meetings/RoundingCompleteModal';
import RoundingJoinModal from '@/components/meetings/RoundingJoinModal';
import SettlementManager from '@/components/meetings/SettlementManager';
import SimpleScoreInputModal from '@/components/meetings/SimpleScoreInputModal';
import SocialJoinModal from '@/components/meetings/SocialJoinModal';
import TeamEditorModal from '@/components/meetings/TeamEditorModal';
import TeamFormationModal from '@/components/meetings/TeamFormationModal';
import TeamFormationPreviewModal from '@/components/meetings/TeamFormationPreviewModal';
import ModerationMenu from '@/components/moderation/ModerationMenu';
import AppToast from '@/components/ui/AppToast';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { meetingDetailTabs } from '@/constants/meetingConstants';
import { useBlockedUsers } from '@/context/BlockContext';
import { meetingsApi, mypageApi, roundsApi, socialsApi, usersApi } from '@/lib/api/api';
import {
  createAutoFormTeamsHandler,
  createCompleteRoundingHandler,
  createConfirmSettlementHandler,
  createConfirmTeamsHandler,
  createFetchApplicationStatusHandler,
  createFetchMeetingDetailHandler,
  createFetchParticipantsHandler,
  createFetchTeamsHandler,
  createFetchUserInfoHandler,
  createJoinHandler,
  createLeaveHandler,
  createRestoreHistoryHandler,
  createSaveHistoryHandler,
  createScoreSuccessHandler,
  createStartRoundingHandler,
  createUpdateUserInfoHandler,
} from '@/lib/handler/meetings';
import { navigateWithCap } from '@/lib/navigation/cappedHistory';
import {
  buildUserInfoFromProfile,
  extractData,
  extractList,
  formatDateTime,
  getCurrentHandicap,
  getIsJoined,
  getMeetingDomainType,
  getMyParticipantId,
  getTypeSlug,
  getUserRole,
} from '@/lib/util/meetingUtils';
import {
  calcHandicapFromAvg,
  ensureProfileCompleted,
  getAverageScoreInitError,
} from '@/lib/util/mypageUtils';
import { colors } from '@/styles/colors';
import { base, tokens } from '@/styles/style';

const TEAM_FORMATION_MODE_LABELS = {
  MIXED: '혼성',
  GENDER_SEPARATED: '성별 분리',
  GENDER_SEPARATED_HANDICAP: '성별 분리 + 핸디캡 기준',
  GENDER_SEPARATED_PREVIOUS_RECORD: '성별 분리 + 직전대회 성적',
  GENDER_SEPARATED_RANDOM: '성별 분리 + 랜덤',
  GENDER_MIXED_HANDICAP: '성별 혼합 + 핸디캡 기준',
  GENDER_MIXED_PREVIOUS_RECORD: '성별 혼합 + 직전대회 성적',
  GENDER_MIXED_RANDOM: '성별 혼합 + 랜덤',
};

const MEETING_SUBTYPE_LABELS = {
  REGULAR: '정기',
  IRREGULAR: '비정기',
  ONE_TIME: '일회성',
};

const SETTLEMENT_METHOD_LABELS = {
  EQUAL_SPLIT: 'N분의 1',
  INDIVIDUAL: '개별 정산',
};

const SOCIAL_SETTLEMENT_METHOD_LABELS = {
  EQUAL_SPLIT: 'N분의 1',
  CLUB_FUND: '전체 회비에서 처리',
  TREASURER_PREPAID: '전체 회비에서 처리',
  INDIVIDUAL: '개별 정산',
};

const SOCIAL_TYPE_LABELS = {
  CASUAL: '캐주얼 모임',
  DINNER: '식사 모임',
  PRACTICE: '연습 모임',
  EVENT: '행사',
};

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '미정';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return `${numeric.toLocaleString('ko-KR')}원`;
}

function formatOptional(value, fallback = '미입력') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? fallback : trimmed;
  }
  return `${value}`;
}

function formatParticipantsCount(meeting, isApplicationClosedEarly) {
  const current = Number.isFinite(Number(meeting?.participant_count))
    ? Number(meeting.participant_count)
    : 0;
  const max =
    meeting?.max_participants !== null && meeting?.max_participants !== undefined
      ? meeting.max_participants
      : null;
  const baseLabel = max ? `${current}/${max}명` : `${current}명`;
  return isApplicationClosedEarly ? `${baseLabel} (신청 마감)` : baseLabel;
}

function formatHoleCount(holeCount) {
  if (holeCount === null || holeCount === undefined) return '미정';
  if (Number.isNaN(Number(holeCount))) return `${holeCount}`;
  return `${holeCount}홀`;
}

function formatTeamSize(teamSize) {
  if (teamSize === null || teamSize === undefined || teamSize === '') return '미정';
  if (Number.isNaN(Number(teamSize))) return `${teamSize}`;
  return `${teamSize}명`;
}

function formatTeeTimes(teeTimes) {
  if (!Array.isArray(teeTimes) || teeTimes.length === 0) return '미정';
  const formatted = teeTimes
    .map((time) => {
      if (!time) return null;
      if (/^\d{1,2}:\d{2}$/.test(time)) return time;
      const parsed = new Date(time);
      if (Number.isNaN(parsed.getTime())) return `${time}`;
      return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
    })
    .filter(Boolean);
  if (formatted.length === 0) return '미정';
  return formatted.join(', ');
}

function isPastDateTime(value, referenceTime = Date.now()) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() <= referenceTime;
}

function getNextDayMidnight(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const nextMidnight = new Date(date);
  nextMidnight.setHours(24, 0, 0, 0);
  return nextMidnight;
}

function getMeetingStatusMeta(meeting) {
  const status = String(meeting?.status || meeting?.application_status || '').toUpperCase();
  if (status === 'IN_PROGRESS') return { label: '진행중', tone: 'warning' };
  if (status === 'COMPLETED') return { label: '완료', tone: 'success' };
  if (status === 'CANCELED') return { label: '취소', tone: 'danger' };
  if (meeting?.settlement_enabled !== false && meeting?.settlement_confirmed) {
    return { label: '정산 완료', tone: 'success' };
  }
  if (meeting?.application_closed_early || isPastDateTime(meeting?.application_deadline)) {
    return { label: '모집 마감', tone: 'warning' };
  }
  return { label: '예정', tone: 'primary' };
}

function getToneStyle(tone) {
  if (tone === 'success') {
    return { backgroundColor: colors.success[50], color: colors.success[700], borderColor: colors.success[600] };
  }
  if (tone === 'warning') {
    return { backgroundColor: colors.warning[50], color: colors.warning[700], borderColor: colors.warning[600] };
  }
  if (tone === 'danger') {
    return { backgroundColor: colors.error[50], color: colors.error[700], borderColor: colors.error[600] };
  }
  return { backgroundColor: colors.info[50], color: colors.info[700], borderColor: colors.info[600] };
}


export default function MeetingDetailScreen() {
  const router = useRouter();
  const { isBlocked } = useBlockedUsers();
  const { meetingType, meetingId } = useLocalSearchParams();
  const meetingTypeValue = Array.isArray(meetingType) ? meetingType[0] : meetingType;
  const meetingIdValue = Array.isArray(meetingId) ? meetingId[0] : meetingId;
  const typeSlug = getTypeSlug(meetingTypeValue);
  const meetingDomainType = getMeetingDomainType(typeSlug);
  const isRoundingMeeting = meetingDomainType === 'ROUND';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [meeting, setMeeting] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [teams, setTeams] = useState([]);
  const [activeTab, setActiveTab] = useState('participants');
  const [user, setUser] = useState(null);
  const [userInfo, setUserInfo] = useState({});
  const [userInfoLoading, setUserInfoLoading] = useState(false);
  const [handicapInfo, setHandicapInfo] = useState(null);
  const [handicapLoading, setHandicapLoading] = useState(false);
  const [isEditingUserInfo, setIsEditingUserInfo] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState(null);
  const [confirmedParticipants, setConfirmedParticipants] = useState([]);
  const [settlement, setSettlement] = useState(null);

  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [teamFormationOpen, setTeamFormationOpen] = useState(false);
  const [teamPreviewOpen, setTeamPreviewOpen] = useState(false);
  const [teamEditorOpen, setTeamEditorOpen] = useState(false);
  const [batchFormationOpen, setBatchFormationOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [roundingCompleteOpen, setRoundingCompleteOpen] = useState(false);
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [previewTeams, setPreviewTeams] = useState([]);
  const [previewFormation, setPreviewFormation] = useState(null);
  const [formationHistory, setFormationHistory] = useState([]);
  const [participantsLoaded, setParticipantsLoaded] = useState(false);
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [closeApplicationModalOpen, setCloseApplicationModalOpen] = useState(false);
  const [guestForm, setGuestForm] = useState({
    name: '',
    gender: 'MALE',
    handicap: '',
    average_score: '',
  });
  const [showRecordIncompleteModal, setShowRecordIncompleteModal] = useState(false);
  const [settlementToast, setSettlementToast] = useState(null);
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());

  useEffect(() => {
    const timer = globalThis.setInterval(() => {
      setNowTimestamp(Date.now());
    }, 60 * 1000);

    return () => {
      globalThis.clearInterval(timer);
    };
  }, []);

  const myParticipantId = useMemo(
    () => getMyParticipantId({ user, participants }),
    [participants, user]
  );

  const currentHandicap = useMemo(
    () => getCurrentHandicap(handicapInfo),
    [handicapInfo]
  );

  const fetchUserInfo = useMemo(
    () =>
      createFetchUserInfoHandler({
        fetchMyProfile: mypageApi.fetchMyProfile,
        fetchUserHandicap: mypageApi.fetchUserHandicap,
        extractData,
        setUser,
        setUserInfo,
        setUserInfoLoading,
        setHandicapInfo,
        setHandicapLoading,
        buildUserInfoFromProfile,
      }),
    [
      setUser,
      setUserInfo,
      setUserInfoLoading,
      setHandicapInfo,
      setHandicapLoading,
    ]
  );

  const fetchMeeting = useMemo(
    () =>
      createFetchMeetingDetailHandler({
        meetingIdValue,
        typeSlug,
        fetchSocial: meetingsApi.fetchSocial,
        fetchRound: meetingsApi.fetchRound,
        extractData,
        setMeeting,
        setLoading,
        setError,
      }),
    [meetingIdValue, typeSlug, setMeeting, setLoading, setError]
  );

  const fetchParticipants = useMemo(
    () =>
      createFetchParticipantsHandler({
        meetingIdValue,
        typeSlug,
        meeting,
        fetchRoundParticipants: meetingsApi.fetchRoundParticipants,
        fetchSocialParticipants: meetingsApi.fetchSocialParticipants,
        fetchGuests: roundsApi.getGuests,
        extractList,
        setParticipants,
        setConfirmedParticipants,
      }),
    [meetingIdValue, typeSlug, meeting, setParticipants, setConfirmedParticipants]
  );

  const fetchTeams = useMemo(
    () =>
      createFetchTeamsHandler({
        meetingIdValue,
        isRoundingMeeting,
        fetchRoundTeams: meetingsApi.fetchRoundTeams,
        extractList,
        setTeams,
      }),
    [meetingIdValue, isRoundingMeeting, setTeams]
  );

  const fetchStatus = useMemo(
    () =>
      createFetchApplicationStatusHandler({
        meetingIdValue,
        isRoundingMeeting,
        fetchApplicationStatus: meetingsApi.fetchApplicationStatus,
        extractData,
        setApplicationStatus,
      }),
    [meetingIdValue, isRoundingMeeting, setApplicationStatus]
  );

  const fetchSettlement = useCallback(async () => {
    if (!meetingIdValue) return;
    try {
      const res = await roundsApi.getMeetingSettlement(meetingIdValue);
      setSettlement(res?.settlement ?? null);
    } catch {
      setSettlement(null);
    }
  }, [meetingIdValue]);

  useEffect(() => {
    fetchUserInfo();
    fetchMeeting();
  }, [fetchMeeting, fetchUserInfo]);

  useEffect(() => {
    if (!meetingIdValue) return;
    if (meeting?.settlement_enabled === false) {
      setSettlement(null);
      return;
    }
    fetchSettlement();
  }, [fetchSettlement, meetingIdValue, meeting?.settlement_enabled]);

  useEffect(() => {
    let mounted = true;

    const fetchDetailCollections = async () => {
      setParticipantsLoaded(false);
      try {
        await Promise.all([
          fetchParticipants(),
          fetchTeams(),
          fetchStatus(),
        ]);
      } finally {
        if (mounted) {
          setParticipantsLoaded(true);
        }
      }
    };

    fetchDetailCollections();

    return () => {
      mounted = false;
    };
  }, [fetchParticipants, fetchTeams, fetchStatus]);

  const checkHasUnenteredRoundingRecord = useCallback(async (excludeMeetingId) => {
    try {
      const res = await usersApi.getMyRoundingMeetings({ limit: 50 });
      const list = extractList(res);
      return list.some(
        (m) =>
          String(m?.id) !== String(excludeMeetingId) &&
          (m?.rounding_completed_at ||
            (m?.settlement_enabled !== false && m?.settlement_confirmed)) &&
          m?.has_hole_scores === false
      );
    } catch (e) {
      console.warn('미입력 라운딩 확인 실패:', e);
      return false;
    }
  }, []);

  const handleUpdateUserInfo = useMemo(
    () =>
      createUpdateUserInfoHandler({
        userInfo,
        userId: user?.id,
        updateMyProfile: mypageApi.updateMyProfile,
        updateUserHandicap: usersApi.updateUserHandicap,
        setProcessingAction,
        setIsEditingUserInfo,
        fetchUserInfo,
        alert: Alert.alert,
      }),
    [userInfo, user?.id, setProcessingAction, setIsEditingUserInfo, fetchUserInfo]
  );

  const handleJoin = useMemo(
    () =>
      createJoinHandler({
        typeSlug,
        meetingIdValue,
        joinSocial: meetingsApi.joinSocial,
        joinRound: meetingsApi.joinRound,
        router,
        setJoinModalOpen,
        setProcessingAction,
        fetchParticipants,
        fetchMeeting,
        alert: Alert.alert,
        checkHasUnenteredRoundingRecord: typeSlug === 'rounding' ? checkHasUnenteredRoundingRecord : undefined,
      }),
    [typeSlug, meetingIdValue, router, setJoinModalOpen, setProcessingAction, fetchParticipants, fetchMeeting, checkHasUnenteredRoundingRecord]
  );

  const handleLeave = useMemo(
    () =>
      createLeaveHandler({
        typeSlug,
        meetingIdValue,
        leaveSocial: meetingsApi.leaveSocial,
        leaveRound: meetingsApi.leaveRound,
        router,
        setProcessingAction,
        fetchParticipants,
        fetchMeeting,
        alert: Alert.alert,
      }),
    [typeSlug, meetingIdValue, router, setProcessingAction, fetchParticipants, fetchMeeting]
  );

  const handleAutoFormTeams = useMemo(
    () =>
      createAutoFormTeamsHandler({
        meetingIdValue,
        autoFormTeams: meetingsApi.autoFormTeams,
        router,
        extractList,
        setProcessingAction,
        setPreviewTeams,
        setTeamPreviewOpen,
        setPreviewFormation,
        setTeams,
        fetchTeams,
        onCloseTeamFormation: () => setTeamFormationOpen(false),
        alert: Alert.alert,
      }),
    [
      meetingIdValue,
      router,
      setProcessingAction,
      setPreviewTeams,
      setTeamPreviewOpen,
      setPreviewFormation,
      setTeams,
      fetchTeams,
    ]
  );

  const handleConfirmTeams = useMemo(
    () =>
      createConfirmTeamsHandler({
        meetingIdValue,
        confirmTeamFormation: meetingsApi.confirmTeamFormation,
        router,
        setProcessingAction,
        onCloseAllTeamFormationModals: () => {
          setTeamFormationOpen(false);
          setTeamPreviewOpen(false);
          setBatchFormationOpen(false);
          setHistoryOpen(false);
          setPreviewFormation(null);
        },
        fetchTeams,
        fetchMeeting,
        alert: Alert.alert,
      }),
    [
      meetingIdValue,
      router,
      setProcessingAction,
      fetchTeams,
      fetchMeeting,
    ]
  );

  const _handleStartRounding = useMemo(
    () =>
      createStartRoundingHandler({
        meetingIdValue,
        startRounding: meetingsApi.startRounding,
        router,
        setProcessingAction,
        fetchMeeting,
        alert: Alert.alert,
      }),
    [meetingIdValue, router, setProcessingAction, fetchMeeting]
  );

  const handleCompleteRounding = useMemo(
    () =>
      createCompleteRoundingHandler({
        meetingIdValue,
        completeRounding: meetingsApi.completeRounding,
        router,
        setProcessingAction,
        setRoundingCompleteOpen,
        fetchMeeting,
        alert: Alert.alert,
      }),
    [meetingIdValue, router, setProcessingAction, setRoundingCompleteOpen, fetchMeeting]
  );

  const openScoreModal = useMemo(() => () => setScoreModalOpen(true), []);
  const showSocialSettlementCompleteToast = useCallback(() => {
    setSettlementToast({
      tone: 'success',
      message: '모임 진행이 모두 마무리되었습니다.',
    });
  }, []);
  const runConfirmSettlement = useMemo(
    () =>
      createConfirmSettlementHandler({
        meetingIdValue,
        confirmSettlement: meetingsApi.confirmSettlement,
        router,
        setProcessingAction,
        fetchMeeting,
        alert: Alert.alert,
        onSuccess: isRoundingMeeting ? openScoreModal : showSocialSettlementCompleteToast,
      }),
    [
      meetingIdValue,
      router,
      setProcessingAction,
      fetchMeeting,
      openScoreModal,
      isRoundingMeeting,
      showSocialSettlementCompleteToast,
    ]
  );
  const handleConfirmSettlement = useCallback(() => {
    if (meeting?.settlement_enabled === false) return;
    if (!isRoundingMeeting) {
      Alert.alert(
        '정산 확정',
        '정산 확정 버튼 누르면, 소셜 모임이 마무리 처리됩니다. 정산을 확정하시겠습니까?',
        [
          { text: '아니오', style: 'cancel' },
          { text: '예', onPress: () => runConfirmSettlement() },
        ]
      );
      return;
    }
    Alert.alert(
      '정산 완료',
      '정산 완료 시 라운딩 종료 처리가 완료됩니다.',
      [
        { text: '취소', style: 'cancel' },
        { text: '확인', onPress: () => runConfirmSettlement() },
      ]
    );
  }, [runConfirmSettlement, isRoundingMeeting, meeting?.settlement_enabled]);

  const handleSyncMeetingToSettlement = useCallback(
    async (payload) => {
      if (!meetingIdValue) return;
      try {
        if (meetingDomainType === 'ROUND') {
          await roundsApi.updateRoundById(meetingIdValue, payload);
        } else {
          await meetingsApi.updateSocialById(meetingIdValue, payload);
        }
        // 정산에서 바뀐 비용을 모임 상세 비용 정보에 즉시 반영
        setMeeting((prev) => {
          if (!prev) return prev;
          const next = { ...prev };
          if (payload.total_cost != null) next.total_cost = payload.total_cost;
          if (payload.green_fee != null) next.green_fee = payload.green_fee;
          if (payload.caddy_fee != null) next.caddy_fee = payload.caddy_fee;
          if (payload.cart_fee != null) next.cart_fee = payload.cart_fee;
          if (payload.other_fee != null) next.other_fee = payload.other_fee;
          if (payload.settlement_method != null) next.settlement_method = payload.settlement_method;
          if (payload.social_cost != null) next.social_cost = payload.social_cost;
          return next;
        });
      } catch (syncError) {
        console.warn('모임 정보 동기화 실패:', syncError);
        Alert.alert('안내', '정산은 저장되었으나 모임 정보 갱신에 실패했습니다.');
      }
    },
    [meetingIdValue, meetingDomainType]
  );

  const ensureMeetingProfile = useMemo(
    () =>
      () =>
        ensureProfileCompleted({
          router,
          alertMessage: '모임 이용 전 프로필을 완성해 주세요!',
        }),
    [router]
  );

  const handleSaveHistory = useMemo(
    () => createSaveHistoryHandler({ previewTeams, setFormationHistory }),
    [previewTeams, setFormationHistory]
  );

  const handleRestoreHistory = useMemo(
    () => createRestoreHistoryHandler({ setTeams }),
    [setTeams]
  );

  const handleScoreSuccess = useMemo(
    () => createScoreSuccessHandler({ setScoreModalOpen, fetchMeeting, fetchParticipants }),
    [setScoreModalOpen, fetchMeeting, fetchParticipants]
  );

  const handleTabPress = useMemo(
    () =>
      (tabId) =>
        () => {
          setActiveTab(tabId);
        },
    [setActiveTab]
  );

  const handleReformTeams = useMemo(
    () => () => handleAutoFormTeams({ preview: true }),
    [handleAutoFormTeams]
  );

  const handleCloseApplicationEarly = useMemo(
    () => async () => {
      const isCompleted = await ensureMeetingProfile();
      if (!isCompleted) return;
      try {
        await meetingsApi.closeApplicationEarly(meetingIdValue);
        fetchMeeting();
        fetchStatus();
      } catch (closeError) {
        Alert.alert('오류', closeError?.message || '모집 마감 처리에 실패했습니다.');
      }
    },
    [meetingIdValue, fetchMeeting, fetchStatus, ensureMeetingProfile]
  );

  const handleOpenCloseApplicationModal = useMemo(
    () => () => {
      setCloseApplicationModalOpen(true);
    },
    []
  );

  const handleDismissCloseApplicationModal = useMemo(
    () => () => {
      setCloseApplicationModalOpen(false);
    },
    []
  );

  const handleConfirmCloseApplicationEarly = useMemo(
    () => async () => {
      setCloseApplicationModalOpen(false);
      await handleCloseApplicationEarly();
    },
    [handleCloseApplicationEarly]
  );

  const handleEditMeeting = useMemo(
    () => async () => {
      const isCompleted = await ensureMeetingProfile();
      if (!isCompleted) return;
      navigateWithCap(router, `/meetings/${typeSlug}/${meetingIdValue}/edit`);
    },
    [router, typeSlug, meetingIdValue, ensureMeetingProfile]
  );

  const handleCancelMeeting = useMemo(
    () => async () => {
      const isCompleted = await ensureMeetingProfile();
      if (!isCompleted) return;
      Alert.alert('모임 취소', '정말 이 모임을 취소하시겠습니까?', [
        { text: '아니오', style: 'cancel' },
        {
          text: '취소하기',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessingAction(true);
              if (typeSlug === 'social') {
                await socialsApi.cancelSocial(meetingIdValue, '개설자에 의한 취소');
              } else {
                await roundsApi.cancelRound(meetingIdValue, '개설자에 의한 취소');
              }
              fetchMeeting();
              fetchParticipants();
              fetchStatus();
            } catch (cancelError) {
              Alert.alert('오류', cancelError?.message || '모임 취소에 실패했습니다.');
            } finally {
              setProcessingAction(false);
            }
          },
        },
      ]);
    },
    [typeSlug, meetingIdValue, fetchMeeting, fetchParticipants, fetchStatus, ensureMeetingProfile]
  );

  const handleCompleteMeeting = useMemo(
    () => async () => {
      const isCompleted = await ensureMeetingProfile();
      if (!isCompleted) return;
      try {
        setProcessingAction(true);
        await roundsApi.completeMeeting(meetingIdValue);
        fetchMeeting();
        fetchParticipants();
        fetchStatus();
      } catch (completeError) {
        Alert.alert('오류', completeError?.message || '모임 완료 처리에 실패했습니다.');
      } finally {
        setProcessingAction(false);
      }
    },
    [meetingIdValue, fetchMeeting, fetchParticipants, fetchStatus, ensureMeetingProfile]
  );

  const handleOpenGuestModal = useMemo(() => () => setGuestModalOpen(true), []);
  const handleCloseGuestModal = useMemo(
    () => () => {
      if (processingAction) return;
      setGuestModalOpen(false);
      setGuestForm({
        name: '',
        gender: 'MALE',
        handicap: '',
        average_score: '',
      });
    },
    [processingAction]
  );

  const handleGuestAverageScoreChange = useMemo(
    () => (value) => {
      if (!/^\d*$/.test(value)) {
        return;
      }

      const nextHandicap = calcHandicapFromAvg(value);
      setGuestForm((prev) => ({
        ...prev,
        average_score: value,
        handicap: nextHandicap === null ? '' : String(nextHandicap),
      }));
    },
    []
  );

  const handleGuestSubmit = useMemo(
    () => async () => {
      const guestName = guestForm.name.trim();
      if (!guestName) {
        setTimeout(() => {
          Alert.alert('확인', '게스트 이름을 입력해주세요.');
        }, 0);
        return;
      }
      const averageScoreError = getAverageScoreInitError(guestForm.average_score);
      if (averageScoreError) {
        setTimeout(() => {
          Alert.alert('확인', averageScoreError);
        }, 0);
        return;
      }
      const calculatedHandicap = calcHandicapFromAvg(guestForm.average_score);
      const handicapValue = calculatedHandicap !== null ? calculatedHandicap : null;
      const averageScoreValue =
        guestForm.average_score !== '' && Number.isFinite(Number(guestForm.average_score))
          ? Number(guestForm.average_score)
          : null;

      const isCompleted = await ensureMeetingProfile();
      if (!isCompleted) return;

      try {
        setProcessingAction(true);
        await roundsApi.addGuest(meetingIdValue, {
          name: guestName,
          gender: guestForm.gender || null,
          handicap: handicapValue,
          average_score: averageScoreValue,
        });
        setGuestModalOpen(false);
        setGuestForm({
          name: '',
          gender: 'MALE',
          handicap: '',
          average_score: '',
        });
        fetchParticipants();
        fetchMeeting();
      } catch (guestError) {
        Alert.alert('오류', guestError?.message || '게스트 추가에 실패했습니다.');
      } finally {
        setProcessingAction(false);
      }
    },
    [guestForm, meetingIdValue, fetchParticipants, fetchMeeting, ensureMeetingProfile]
  );

  const openJoinModal = useMemo(() => () => setJoinModalOpen(true), []);
  const closeJoinModal = useMemo(() => () => setJoinModalOpen(false), []);
  const openTeamFormation = useMemo(() => () => setTeamFormationOpen(true), []);
  const closeTeamFormation = useMemo(() => () => setTeamFormationOpen(false), []);
  const openTeamEditor = useMemo(() => () => setTeamEditorOpen(true), []);
  const closeTeamEditor = useMemo(
    () => () => {
      setTeamEditorOpen(false);
      fetchTeams();
    },
    [fetchTeams]
  );
  const openHistory = useMemo(() => () => setHistoryOpen(true), []);
  const closeHistory = useMemo(() => () => setHistoryOpen(false), []);
  // 팀 편성 모달을 내리고 연다. iOS 는 모달 위에 모달을 띄우면 아무 일도 안 생긴다.
  const openBatchFormation = useMemo(
    () => () => {
      setTeamFormationOpen(false);
      setBatchFormationOpen(true);
    },
    []
  );
  const closeBatchFormation = useMemo(() => () => setBatchFormationOpen(false), []);
  const closeTeamPreview = useMemo(
    () => () => {
      setTeamPreviewOpen(false);
      setPreviewFormation(null);
    },
    []
  );
  const closeRoundingComplete = useMemo(() => () => setRoundingCompleteOpen(false), []);
  const closeScoreModal = useMemo(() => () => setScoreModalOpen(false), []);
  const handleInputLater = useMemo(() => () => setScoreModalOpen(false), []);
  const handleTeamsSave = useMemo(
    () =>
      async (updatedTeams) => {
        if (!isRoundingMeeting || !meetingIdValue) return false;
        const isCompleted = await ensureMeetingProfile();
        if (!isCompleted) return false;

        try {
          setProcessingAction(true);
          const nextTeams = Array.isArray(updatedTeams) ? updatedTeams : [];
          const buildMemberPayload = (member) => {
            if (member?.guest_id) return { guest_id: member.guest_id };
            if (member?.user_id) return { user_id: member.user_id };
            return null;
          };
          await roundsApi.updateRoundTeamsBulk(meetingIdValue, {
            teams: nextTeams.map((team, index) => ({
              name: team?.name || `팀 ${index + 1}`,
              members: (team?.members || team?.team_members || [])
                .map((member) => buildMemberPayload(member))
                .filter(Boolean),
            })),
          });
          Alert.alert('완료', '팀 편성을 저장했습니다.');
          return true;
        } catch (teamSaveError) {
          Alert.alert('오류', teamSaveError?.message || '팀 편집 저장에 실패했습니다.');
          return false;
        } finally {
          setProcessingAction(false);
        }
      },
    [isRoundingMeeting, meetingIdValue, ensureMeetingProfile]
  );

  const handleBatchViewDetail = useMemo(
    () =>
      (result) => {
        const mode = result?.mode || meeting?.team_formation_mode;
        const size = result?.teamSize || meeting?.team_size || 4;
        setPreviewFormation({
          mode,
          teamSize: size,
        });
        setPreviewTeams(result.teams || []);
        // 일괄 비교 모달을 내리고 미리보기를 연다. 모달 위에 모달은 안 뜬다.
        setBatchFormationOpen(false);
        setTeamPreviewOpen(true);
      },
    [meeting?.team_formation_mode, meeting?.team_size]
  );

  const handleHistoryViewDetail = useMemo(
    () =>
      (item) => {
        setPreviewTeams(item.teams || []);
        // 히스토리 모달을 내리고 미리보기를 연다. 모달 위에 모달은 안 뜬다.
        setHistoryOpen(false);
        setTeamPreviewOpen(true);
      },
    []
  );

  const userRole = useMemo(
    () => String(getUserRole({ meeting, user }) || '').toUpperCase(),
    [meeting, user]
  );

  const myParticipant = useMemo(
    () => participants.find((participant) => `${participant?.user_id}` === `${user?.id}`),
    [participants, user?.id]
  );

  useEffect(() => {
    if (!meeting?.id || !isRoundingMeeting || !myParticipant) return;
    const completed =
      meeting?.rounding_completed_at ||
      (meeting?.settlement_enabled !== false && meeting?.settlement_confirmed);
    if (!completed) return;

    let mounted = true;
    (async () => {
      try {
        const res = await usersApi.getMyRoundingMeetings({ limit: 50 });
        const list = extractList(res);
        const thisMeeting = list.find((m) => String(m?.id) === String(meeting.id));
        if (mounted && thisMeeting && thisMeeting.has_hole_scores === false) {
          setShowRecordIncompleteModal(true);
        }
      } catch (e) {
        console.warn('내 라운딩 목록 조회 실패:', e);
      }
    })();
    return () => { mounted = false; };
  }, [
    meeting?.id,
    meeting?.rounding_completed_at,
    meeting?.settlement_confirmed,
    meeting?.settlement_enabled,
    isRoundingMeeting,
    myParticipant,
  ]);

  const _isJoined = useMemo(
    () => getIsJoined({ participants, user }),
    [participants, user]
  );
  const organizerId = meeting?.created_by ?? meeting?.creator_id;
  const isOrganizer = useMemo(
    () =>
      Boolean(
        organizerId !== undefined &&
        organizerId !== null &&
        user?.id !== undefined &&
        user?.id !== null &&
        `${organizerId}` === `${user.id}`
      ),
    [organizerId, user?.id]
  );

  const isClubLeaderOrManager = useMemo(() => {
    const participantClubRole = String(myParticipant?.club_role || myParticipant?.membership_role || '').toUpperCase();
    return (
      participantClubRole === 'LEADER' ||
      participantClubRole === 'MANAGER' ||
      userRole === 'LEADER' ||
      userRole === 'MANAGER'
    );
  }, [myParticipant?.club_role, myParticipant?.membership_role, userRole]);

  const isAdmin = useMemo(
    () => String(userRole || '').toUpperCase() === 'ADMIN',
    [userRole]
  );

  const hasManagerPermission = useMemo(
    () => Boolean(isAdmin || isOrganizer || isClubLeaderOrManager),
    [isAdmin, isOrganizer, isClubLeaderOrManager]
  );

  const isManager = useMemo(
    () => hasManagerPermission,
    [hasManagerPermission]
  );

  const settlementFeatureEnabled = useMemo(
    () => meeting?.settlement_enabled !== false,
    [meeting?.settlement_enabled]
  );

  const meetingStatusMeta = useMemo(
    () => getMeetingStatusMeta(meeting),
    [meeting]
  );

  const participantCount = useMemo(() => {
    if (participants.length > 0) return participants.length;
    const count = Number(meeting?.participant_count);
    return Number.isFinite(count) ? count : 0;
  }, [participants.length, meeting?.participant_count]);

  const normalizedStatus = useMemo(
    () => String(meeting?.status || meeting?.application_status || '').toUpperCase(),
    [meeting?.status, meeting?.application_status]
  );

  const isApplicationClosed = useMemo(() => {
    if (!meeting) return false;
    return Boolean(meeting.application_closed_early) || isPastDateTime(meeting.application_deadline, nowTimestamp);
  }, [meeting, nowTimestamp]);

  const isMeetingTimePassed = useMemo(
    () => isPastDateTime(meeting?.meeting_time, nowTimestamp),
    [meeting?.meeting_time, nowTimestamp]
  );

  const roundingAutoCompleteDeadline = useMemo(
    () => getNextDayMidnight(meeting?.meeting_time),
    [meeting?.meeting_time]
  );

  const isRoundingCompletedForUi = useMemo(
    () =>
      Boolean(
        meeting?.rounding_completed_at ||
        (
          isRoundingMeeting &&
          roundingAutoCompleteDeadline &&
          isPastDateTime(roundingAutoCompleteDeadline, nowTimestamp)
        )
      ),
    [meeting?.rounding_completed_at, isRoundingMeeting, roundingAutoCompleteDeadline, nowTimestamp]
  );

  const isTeamFormationConfirmed = useMemo(
    () => Boolean(meeting?.team_formation_confirmed_at),
    [meeting?.team_formation_confirmed_at]
  );

  const isMeetingInProgress = useMemo(
    () => normalizedStatus === 'IN_PROGRESS',
    [normalizedStatus]
  );

  const isMeetingCanceled = useMemo(
    () => normalizedStatus === 'CANCELED',
    [normalizedStatus]
  );

  const isMeetingCompletedForUi = useMemo(
    () => Boolean(meeting?.is_completed || normalizedStatus === 'COMPLETED' || isRoundingCompletedForUi),
    [meeting?.is_completed, normalizedStatus, isRoundingCompletedForUi]
  );

  const isMinParticipantsNotMet = useMemo(() => {
    if (!meeting || !isApplicationClosed) return false;
    const count = participantCount;
    if (isRoundingMeeting) {
      return count >= 1 && count <= 3;
    }
    return count === 1;
  }, [meeting, isApplicationClosed, isRoundingMeeting, participantCount]);

  const canSettleMeeting = useMemo(() => {
    if (!meeting) return false;
    if (meeting.settlement_enabled === false) return false;
    if (normalizedStatus === 'CANCELED') return false;
    if (isMinParticipantsNotMet) return false;

    if (!isRoundingMeeting) {
      if (meeting?.is_completed || normalizedStatus === 'COMPLETED') return true;
      return isApplicationClosed && isMeetingTimePassed;
    }

    if (meeting?.settlement_confirmed === false && teams.length > 0) return true;
    return teams.length > 0;
  }, [
    meeting,
    normalizedStatus,
    isMinParticipantsNotMet,
    isRoundingMeeting,
    isApplicationClosed,
    isMeetingTimePassed,
    teams.length,
  ]);

  const settlementBlockedMessage = useMemo(() => {
    if (normalizedStatus === 'CANCELED') {
      return '모임이 취소되어 정산을 진행할 수 없습니다.';
    }
    if (isMinParticipantsNotMet) {
      return '참가인원 미달로 모임이 취소되어 정산을 진행할 수 없습니다.';
    }
    return null;
  }, [normalizedStatus, isMinParticipantsNotMet]);

  const canManageSettlement = useMemo(() => isManager, [isManager]);

  const canRenderTopActions = useMemo(
    () => participantsLoaded && !userInfoLoading,
    [participantsLoaded, userInfoLoading]
  );

  const canShowCloseApplicationButton = useMemo(
    () =>
      Boolean(
        canRenderTopActions &&
        isRoundingMeeting &&
        isManager &&
        !isApplicationClosed &&
        !isMeetingInProgress &&
        !isMeetingCanceled &&
        !isMeetingCompletedForUi &&
        !meeting?.settlement_confirmed
      ),
    [
      canRenderTopActions,
      isRoundingMeeting,
      isManager,
      isApplicationClosed,
      isMeetingInProgress,
      isMeetingCanceled,
      isMeetingCompletedForUi,
      meeting?.settlement_confirmed,
    ]
  );

  const canShowJoinButton = useMemo(
    () =>
      Boolean(
        canRenderTopActions &&
        !_isJoined &&
        !isApplicationClosed &&
        !isMeetingInProgress &&
        !isMeetingCanceled &&
        !isMeetingCompletedForUi &&
        !canShowCloseApplicationButton
      ),
    [
      canRenderTopActions,
      _isJoined,
      isApplicationClosed,
      isMeetingInProgress,
      isMeetingCanceled,
      isMeetingCompletedForUi,
      canShowCloseApplicationButton,
    ]
  );

  const canShowLeaveButton = useMemo(
    () =>
      Boolean(
        canRenderTopActions &&
        _isJoined &&
        !isMeetingInProgress &&
        !isMeetingCanceled &&
        !isMeetingCompletedForUi
      ),
    [canRenderTopActions, _isJoined, isMeetingInProgress, isMeetingCanceled, isMeetingCompletedForUi]
  );

  const canShowEditButton = useMemo(
    () =>
      Boolean(
        canRenderTopActions &&
        isManager &&
        !isMeetingCanceled &&
        !isMeetingCompletedForUi
      ),
    [canRenderTopActions, isManager, isMeetingCanceled, isMeetingCompletedForUi]
  );

  const canShowCancelMeetingButton = useMemo(
    () =>
      Boolean(
        canRenderTopActions &&
        isManager &&
        !isMeetingCanceled &&
        !isMeetingInProgress &&
        !isMeetingCompletedForUi
      ),
    [canRenderTopActions, isManager, isMeetingCanceled, isMeetingInProgress, isMeetingCompletedForUi]
  );

  const canShowCompleteRoundingButton = useMemo(
    () =>
      Boolean(
        canRenderTopActions &&
        isRoundingMeeting &&
        isManager &&
        !isMeetingCanceled &&
        !meeting?.settlement_confirmed &&
        isMeetingTimePassed &&
        !isRoundingCompletedForUi
      ),
    [
      canRenderTopActions,
      isRoundingMeeting,
      isManager,
      isMeetingCanceled,
      meeting?.settlement_confirmed,
      isMeetingTimePassed,
      isRoundingCompletedForUi,
    ]
  );

  const canShowConfirmSettlementButton = useMemo(
    () =>
      Boolean(
        canRenderTopActions &&
        isRoundingMeeting &&
        isManager &&
        settlementFeatureEnabled &&
        canSettleMeeting &&
        !settlementBlockedMessage &&
        !isMeetingCanceled &&
        !meeting?.settlement_confirmed &&
        isRoundingCompletedForUi
      ),
    [
      canRenderTopActions,
      isRoundingMeeting,
      isManager,
      settlementFeatureEnabled,
      canSettleMeeting,
      settlementBlockedMessage,
      isMeetingCanceled,
      meeting?.settlement_confirmed,
      isRoundingCompletedForUi,
    ]
  );

  const visibleTabs = useMemo(
    () =>
      meetingDetailTabs.filter((tab) => {
        if (!isRoundingMeeting && tab.key === 'teams') return false;
        if (tab.key === 'settlement' && meeting?.settlement_enabled === false) return false;
        return true;
      }),
    [isRoundingMeeting, meeting?.settlement_enabled]
  );

  const canAccessTeamTab = useMemo(
    () => Boolean(isRoundingMeeting && participantCount >= 4 && isApplicationClosed),
    [isRoundingMeeting, participantCount, isApplicationClosed]
  );

  const canShowParticipantManageActions = useMemo(
    () =>
      Boolean(
        isRoundingMeeting &&
        isManager &&
        !isMeetingInProgress &&
        !isMeetingTimePassed &&
        !isMeetingCanceled &&
        !meeting?.settlement_confirmed
      ),
    [
      isRoundingMeeting,
      isManager,
      isMeetingInProgress,
      isMeetingTimePassed,
      isMeetingCanceled,
      meeting?.settlement_confirmed,
    ]
  );

  const canShowTeamConfirmButton = useMemo(
    () => Boolean(canShowParticipantManageActions && canAccessTeamTab),
    [canShowParticipantManageActions, canAccessTeamTab]
  );

  const isTeamConfirmDisabled = useMemo(
    () => Boolean(processingAction || teams.length === 0 || isTeamFormationConfirmed),
    [processingAction, teams.length, isTeamFormationConfirmed]
  );

  const canShowGuestAddButton = useMemo(
    () => Boolean(canShowParticipantManageActions),
    [canShowParticipantManageActions]
  );

  const canManageTeamsInTab = useMemo(
    () =>
      Boolean(
        isRoundingMeeting &&
        canAccessTeamTab &&
        isManager &&
        !isMeetingTimePassed &&
        !isMeetingCanceled &&
        !meeting?.settlement_confirmed
      ),
    [
      isRoundingMeeting,
      canAccessTeamTab,
      isManager,
      isMeetingTimePassed,
      isMeetingCanceled,
      meeting?.settlement_confirmed,
    ]
  );

  const teamManagePrimaryLabel = useMemo(
    () => (teams.length > 0 ? '다시 편성하기' : '팀 편성 시작'),
    [teams.length]
  );

  const handleTeamManagePrimary = useMemo(
    () => (teams.length > 0 ? openTeamEditor : openTeamFormation),
    [teams.length, openTeamEditor, openTeamFormation]
  );

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab('participants');
    }
  }, [activeTab, visibleTabs]);

  const meetingInfoItems = useMemo(() => {
    if (!meeting) return [];

    const baseItems = [
      {
        key: 'meeting_time',
        label: '모임 일시',
        value: meeting.meeting_time ? formatDateTime(meeting.meeting_time) : '미정',
        icon: 'calendar-alt',
      },
      {
        key: 'application_deadline',
        label: '신청 마감',
        value: meeting.application_deadline ? formatDateTime(meeting.application_deadline) : '미정',
        icon: 'clock',
      },
      {
        key: 'location',
        label: '장소',
        value: formatOptional(isRoundingMeeting ? meeting.location : meeting.venue_name || meeting.location),
        icon: 'map-marker-alt',
      },
      {
        key: 'club_name',
        label: '소속 클럽',
        value: formatOptional(meeting.club_name),
        icon: 'users',
      },
      {
        key: 'participants',
        label: '참가자 수',
        value: formatParticipantsCount(meeting, Boolean(meeting.application_closed_early)),
        icon: 'user-friends',
      },
      {
        key: 'description',
        label: '설명',
        value: formatOptional(meeting.description, '등록된 설명이 없습니다.'),
        icon: 'sticky-note',
        multiline: true,
      },
    ];

    if (isRoundingMeeting) {
      return [
        ...baseItems,
        {
          key: 'course_name',
          label: '골프장명',
          value: formatOptional(meeting.course_name),
          icon: 'golf-ball',
        },
        {
          key: 'hole_count',
          label: '홀 수',
          value: formatHoleCount(meeting.hole_count),
          icon: 'list-ol',
        },
        {
          key: 'reservation_name',
          label: '예약자명',
          value: formatOptional(meeting.reservation_name),
          icon: 'user-tie',
        },
        {
          key: 'tee_times',
          label: '티타임',
          value: formatTeeTimes(meeting.tee_times),
          icon: 'clock',
        },
        {
          key: 'team_size',
          label: '한 조당 인원 수',
          value: formatTeamSize(meeting.team_size),
          icon: 'users-cog',
        },
        {
          key: 'team_formation_mode',
          label: '팀 구성 방식',
          value: formatOptional(
            TEAM_FORMATION_MODE_LABELS[meeting.team_formation_mode] || meeting.team_formation_mode,
            '미정'
          ),
          icon: 'project-diagram',
        },
        {
          key: 'meeting_subtype',
          label: '모임 유형',
          value: formatOptional(
            MEETING_SUBTYPE_LABELS[meeting.meeting_subtype] || meeting.meeting_subtype,
            '미정'
          ),
          icon: 'clipboard-list',
        },
        {
          key: 'settlement_method',
          label: '정산 방법',
          value: formatOptional(
            SETTLEMENT_METHOD_LABELS[settlement?.settlement_method ?? meeting.settlement_method] ||
            (settlement?.settlement_method ?? meeting.settlement_method),
            '미정'
          ),
          icon: 'dollar-sign',
        },
      ];
    }

    const displaySocialMethod = settlement?.settlement_method ?? meeting.settlement_method;
    return [
      ...baseItems,
      {
        key: 'social_type',
        label: '모임 유형',
        value: formatOptional(SOCIAL_TYPE_LABELS[meeting.type] || meeting.type, '미정'),
        icon: 'clipboard-list',
      },
      {
        key: 'settlement_method',
        label: '정산 방법',
        value: formatOptional(
          SOCIAL_SETTLEMENT_METHOD_LABELS[displaySocialMethod] || displaySocialMethod,
          '미정'
        ),
        icon: 'dollar-sign',
      },
    ];
  }, [meeting, settlement, isRoundingMeeting]);

  const costInfoItems = useMemo(() => {
    if (!meeting) return [];

    // 정산이 있으면 정산 관리와 동일한 금액으로 표시 (정산 정보와 맞춤)
    const greenFee = settlement?.green_fee ?? meeting.green_fee;
    const caddyFee = settlement?.caddy_fee ?? meeting.caddy_fee;
    const cartFee = settlement?.cart_fee ?? meeting.cart_fee;
    const otherFee = settlement?.other_fee ?? meeting.other_fee;

    if (isRoundingMeeting) {
      const items = [];
      if (greenFee !== null && greenFee !== undefined) {
        items.push({ key: 'green_fee', label: '그린피(인당)', value: formatCurrency(greenFee) });
      }
      if (caddyFee !== null && caddyFee !== undefined) {
        items.push({ key: 'caddy_fee', label: '캐디비(팀당)', value: formatCurrency(caddyFee) });
      }
      if (cartFee !== null && cartFee !== undefined) {
        items.push({ key: 'cart_fee', label: '카트비(팀당)', value: formatCurrency(cartFee) });
      }
      if (otherFee != null && otherFee !== 0) {
        items.push({ key: 'other_fee', label: '기타 비용', value: formatCurrency(otherFee) });
      }
      return items;
    }

    // 소셜은 비용 정보 미표시 (운영진용 메모로 대체)
    return [];
  }, [meeting, settlement, isRoundingMeeting]);

  const currentUserId = user?.id ?? null;
  const currentUserGender = user?.gender ?? null;

  const renderParticipantRow = useCallback(function renderParticipantRow(participant, index) {
    const participantData = participant ?? {};
    const participantUser = participantData.user ?? {};
    const participantUserId = participantData.user_id ?? participantData.id;
    const isMine = currentUserId !== null && `${participantUserId}` === `${currentUserId}`;
    const participantGender =
      participantData.gender ??
      participantUser.gender ??
      participantData.user_gender ??
      (isMine ? userInfo?.gender ?? currentUserGender : null);
    const genderValue = String(participantGender ?? '').toUpperCase();
    const genderLabel = genderValue === 'MALE' ? '남성' : genderValue === 'FEMALE' ? '여성' : '';
    const organizerId = meeting?.created_by ?? meeting?.creator_id;
    const isOrganizerParticipant =
      organizerId !== undefined && organizerId !== null && `${organizerId}` === `${participantUserId}`;
    const handicapRaw =
      participantData.handicap_index ??
      participantData.handicap ??
      participantUser.handicap_index ??
      participantUser.handicap ??
      participantData.user_handicap ??
      (isMine ? userInfo?.handicap ?? currentHandicap : null);
    const handicapNumber = Number(handicapRaw);
    const handicapLabel = Number.isFinite(handicapNumber)
      ? `핸디캡 ${handicapNumber % 1 === 0 ? handicapNumber.toFixed(0) : handicapNumber.toFixed(1)}`
      : '';
    const isGuest = participantData.is_guest === true;
    const roleLabel = isOrganizerParticipant ? '개설자' : '';
    const guestLabel = isGuest ? '게스트' : '';

    if (!isGuest && !isMine && isBlocked(participantUserId)) return null;
    return (
      <View key={participantData.id ?? index} style={styles.participantCard}>
        <View style={styles.participantTopRow}>
          <View style={styles.participantAvatar}>
            <FontAwesome5 name="user" size={14} color={colors.white} />
          </View>
          <View style={styles.participantMain}>
            <Text style={styles.participantName}>
              {isGuest
                ? participantData.guest_name ?? participantData.user_name ?? '게스트'
                : participantData.user_name ?? participantData.name ?? '참가자'}
            </Text>
            <Text style={styles.participantSubText}>
              {isGuest
                ? '-'
                : participantData.user_email ?? '-'}
            </Text>
            <View style={styles.participantBadgeRow}>
              {genderLabel ? (
                <View style={[styles.miniBadge, styles.genderBadge]}>
                  <Text style={[styles.miniBadgeText, styles.genderBadgeText]}>{genderLabel}</Text>
                </View>
              ) : null}
              {handicapLabel ? (
                <View style={[styles.miniBadge, styles.roleBadge]}>
                  <Text style={[styles.miniBadgeText, styles.roleBadgeText]}>{handicapLabel}</Text>
                </View>
              ) : null}
              {roleLabel ? (
                <View
                  style={[
                    styles.miniBadge,
                    styles.roleBadge,
                    isOrganizerParticipant && styles.organizerBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.miniBadgeText,
                      styles.roleBadgeText,
                      isOrganizerParticipant && styles.organizerBadgeText,
                    ]}
                  >
                    {roleLabel}
                  </Text>
                </View>
              ) : null}
              {guestLabel ? (
                <View style={[styles.miniBadge, styles.guestBadge]}>
                  <Text style={[styles.miniBadgeText, styles.guestBadgeText]}>{guestLabel}</Text>
                </View>
              ) : null}
            </View>
          </View>
          {!isGuest && !isMine && participantUserId != null ? (
            <ModerationMenu
              report={{
                targetType: 'USER',
                targetId: participantUserId,
                targetName: participantData.user_name ?? participantData.name,
              }}
              blockUser={{ userId: participantUserId, userName: participantData.user_name ?? participantData.name }}
            />
          ) : null}
        </View>
      </View>
    );
  }, [
    isBlocked,
    currentUserId,
    currentUserGender,
    userInfo?.gender,
    userInfo?.handicap,
    currentHandicap,
    meeting?.created_by,
    meeting?.creator_id,
  ]);

  const renderTeamCard = useCallback(function renderTeamCard(team, index) {
    const members = team?.members ?? team?.team_members ?? [];
    return (
      <View key={team.id || index} style={styles.teamCard}>
        <View style={styles.teamHeaderRow}>
          <Text style={styles.teamTitle}>{team?.name ?? `팀 ${index + 1}`}</Text>
          <Text style={styles.teamCount}>{members.length}명</Text>
        </View>
        {members.map((member, memberIndex) => {
          const genderValue = String(member?.gender || '').toUpperCase();
          const genderLabel = genderValue === 'MALE' ? '남성' : genderValue === 'FEMALE' ? '여성' : '';
          const handicapValue =
            member?.handicap_index !== null && member?.handicap_index !== undefined
              ? `핸디캡 ${member.handicap_index}`
              : '';
          const recentScoreValue =
            member?.recent_avg_score !== null && member?.recent_avg_score !== undefined
              ? `직전 ${member.recent_avg_score}타`
              : '';

          return (
            <View key={member.id || memberIndex} style={styles.teamMemberCard}>
              <Text style={styles.teamMember}>
                {member?.user_name ?? member?.name ?? member?.guest_name ?? '멤버'}
              </Text>
              <View style={styles.teamMemberBadgeRow}>
                {genderLabel ? (
                  <View style={[styles.miniBadge, styles.genderBadge]}>
                    <Text style={[styles.miniBadgeText, styles.genderBadgeText]}>{genderLabel}</Text>
                  </View>
                ) : null}
                {handicapValue ? (
                  <View style={[styles.miniBadge, styles.roleBadge]}>
                    <Text style={[styles.miniBadgeText, styles.roleBadgeText]}>{handicapValue}</Text>
                  </View>
                ) : null}
                {recentScoreValue ? (
                  <View style={[styles.miniBadge, styles.roleBadge]}>
                    <Text style={[styles.miniBadgeText, styles.roleBadgeText]}>{recentScoreValue}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    );
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title="모임 상세" />
        <View style={styles.stateRow}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.stateText}>모임을 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title="모임 상세" />
        <View style={styles.stateRow}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, styles.safeAreaRelative]}>
      <ScreenHeader
        title="모임 상세"
        rightAction={meeting?.id ? (
          <ModerationMenu
            report={{
              targetType: 'MEETING',
              targetId: meeting.id,
              targetName: meeting?.name || meeting?.meeting_name,
            }}
            blockUser={
              (meeting?.created_by ?? meeting?.creator_id) != null
                ? { userId: meeting.created_by ?? meeting.creator_id, userName: meeting?.created_by_name }
                : null
            }
            onBlocked={() => router.back()}
          />
        ) : null}
      />
      <ScrollView contentContainerStyle={styles.container}>

        <Card style={styles.card}>
          <View style={styles.meetingBadgeRow}>
            <View style={[styles.meetingTypeBadge, isRoundingMeeting ? styles.roundingTypeBadge : styles.socialTypeBadge]}>
              <Text style={[styles.meetingTypeBadgeText, isRoundingMeeting ? styles.roundingTypeBadgeText : styles.socialTypeBadgeText]}>
                {isRoundingMeeting ? '라운딩' : '소셜'}
              </Text>
            </View>
            <View
              style={[
                styles.meetingStatusBadge,
                {
                  backgroundColor: getToneStyle(meetingStatusMeta.tone).backgroundColor,
                  borderColor: getToneStyle(meetingStatusMeta.tone).borderColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.meetingStatusBadgeText,
                  { color: getToneStyle(meetingStatusMeta.tone).color },
                ]}
              >
                {meetingStatusMeta.label}
              </Text>
            </View>
          </View>

          <Text style={styles.title}>{meeting?.name || meeting?.meeting_name || '모임명 없음'}</Text>
          <Text style={styles.subtitle}>{meeting?.club_name || '-'}</Text>

          <View style={styles.topButtonsSection}>
            {canRenderTopActions ? (
              <View style={styles.topButtonsWrap}>
                {canShowJoinButton ? (
                  <Button
                    style={[
                      styles.topButtonBase,
                      styles.topButtonJoin,
                    ]}
                    onPress={openJoinModal}
                  >
                    <FontAwesome5 name="users" size={12} color={colors.white} />
                    <Text style={styles.topButtonText}>참가 신청</Text>
                  </Button>
                ) : null}

                {canShowLeaveButton ? (
                  <Button
                    style={[
                      styles.topButtonBase,
                      styles.topButtonDanger,
                    ]}
                    onPress={handleLeave}
                  >
                    <FontAwesome5 name="users" size={12} color={colors.white} />
                    <Text style={styles.topButtonText}>참가신청 취소</Text>
                  </Button>
                ) : null}

                {canShowEditButton ? (
                  <Button
                    style={[
                      styles.topButtonBase,
                      styles.topButtonEdit,
                    ]}
                    onPress={handleEditMeeting}
                  >
                    <FontAwesome5 name="edit" size={12} color={colors.white} />
                    <Text style={styles.topButtonText}>수정</Text>
                  </Button>
                ) : null}

                {canShowCloseApplicationButton ? (
                  <Button
                    style={[
                      styles.topButtonBase,
                      styles.topButtonWarning,
                      processingAction && styles.topButtonDisabled,
                    ]}
                    onPress={handleOpenCloseApplicationModal}
                    disabled={processingAction}
                  >
                    <Text style={styles.topButtonText}>신청 마감하기</Text>
                  </Button>
                ) : null}

                {canShowCompleteRoundingButton ? (
                  <Button
                    style={[
                      styles.topButtonBase,
                      styles.topButtonOrange,
                      processingAction && styles.topButtonDisabled,
                    ]}
                    onPress={handleCompleteRounding}
                    disabled={processingAction}
                  >
                    <Text style={styles.topButtonText}>라운딩 종료</Text>
                  </Button>
                ) : null}

                {canShowConfirmSettlementButton ? (
                  <Button
                    style={[
                      styles.topButtonBase,
                      styles.topButtonPurple,
                      processingAction && styles.topButtonDisabled,
                    ]}
                    onPress={handleConfirmSettlement}
                    disabled={processingAction}
                  >
                    <Text style={styles.topButtonText}>정산 완료 처리</Text>
                  </Button>
                ) : null}

                {canShowCancelMeetingButton ? (
                  <Button
                    style={[
                      styles.topButtonBase,
                      styles.topButtonDanger,
                      processingAction && styles.topButtonDisabled,
                    ]}
                    onPress={handleCancelMeeting}
                    disabled={processingAction}
                  >
                    <FontAwesome5 name="times" size={12} color={colors.white} />
                    <Text style={styles.topButtonText}>모임 취소</Text>
                  </Button>
                ) : null}
              </View>
            ) : null}
          </View>

          <View style={styles.embeddedSection}>
            <Text style={styles.sectionHeading}>모임 정보</Text>
            <View style={styles.infoList}>
              {meetingInfoItems.map((item) => (
                <View key={item.key} style={styles.infoItemRow}>
                  <FontAwesome5 name={item.icon} size={13} color={colors.primary[600]} style={styles.infoIcon} />
                  <View style={styles.infoTextWrap}>
                    <Text style={styles.infoLabel}>{item.label}</Text>
                    <Text style={[styles.infoValue, item.multiline && styles.infoValueMultiline]}>{item.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {costInfoItems.length > 0 ? (
            <View style={styles.embeddedSection}>
              <Text style={styles.sectionHeading}>비용 정보</Text>
              <View style={styles.infoList}>
                {costInfoItems.map((item) => (
                  <View key={item.key} style={styles.infoItemRow}>
                    <FontAwesome5 name="dollar-sign" size={13} color={colors.primary[600]} style={styles.infoIcon} />
                    <View style={styles.infoTextWrap}>
                      <Text style={styles.infoLabel}>{item.label}</Text>
                      <Text style={styles.infoValue}>{item.value}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {!isRoundingMeeting && isManager ? (
            <View style={styles.embeddedSection}>
              <Text style={styles.sectionHeading}>운영진용 메모</Text>
              <View style={styles.infoList}>
                <View style={styles.infoItemRow}>
                  <FontAwesome5 name="sticky-note" size={13} color={colors.primary[600]} style={styles.infoIcon} />
                  <View style={[styles.infoTextWrap, { flex: 1 }]}>
                    <Text style={[styles.infoValue, styles.infoValueMultiline]}>
                      {meeting?.social_notes?.trim() || '메모가 없습니다.'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ) : null}
        </Card>

        {isRoundingMeeting && (
          <MeetingWorkflowStatus
            meeting={meeting}
            participants={participants}
            teams={teams}
            isManager={isManager}
            applicationStatus={applicationStatus}
            settlementEnabled={settlementFeatureEnabled}
          />
        )}

        {!isRoundingMeeting ? (
          <Card style={styles.card}>
            <Text style={styles.sectionHeading}>모임 관리</Text>
            <Text style={styles.socialManageHint}>
              {settlementFeatureEnabled
                ? '모임이 완료되면 정산 정보를 입력할 수 있습니다.'
                : '모임 완료 처리로 마무리할 수 있습니다. (클럽은 정산 기능이 꺼져 있습니다.)'}
            </Text>
            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.manageActionButtonBase,
                  styles.manageActionButtonGreen,
                  processingAction && styles.manageActionButtonDisabled,
                  pressed && !processingAction && styles.manageActionButtonPressed,
                ]}
                onPress={handleCompleteMeeting}
                disabled={processingAction}
              >
                <FontAwesome5 name="check" size={12} color={colors.white} />
                <Text style={[styles.manageActionTextBase, styles.manageActionTextWhite]}>
                  모임 완료
                </Text>
              </Pressable>
            </View>
          </Card>
        ) : null}

        <Card style={styles.tabsContainerCard}>
          <View style={styles.tabRow}>
            {visibleTabs.map((tab) => {
              const disabled = tab.key === 'teams' && !canAccessTeamTab;

              return (
                <Pressable
                  key={tab.key}
                  onPress={handleTabPress(tab.key)}
                  style={[styles.tabButton, activeTab === tab.key && styles.tabButtonActive]}
                  disabled={disabled}
                >
                  <View style={styles.tabInner}>
                    <Text
                      style={[
                        styles.tabText,
                        activeTab === tab.key && styles.tabTextActive,
                        disabled && styles.tabTextDisabled,
                      ]}
                    >
                      {tab.label}
                    </Text>
                    {tab.key === 'participants' ? (
                      <View style={[styles.tabCountChip, activeTab === tab.key && styles.tabCountChipActive]}>
                        <Text style={[styles.tabCountText, activeTab === tab.key && styles.tabCountTextActive]}>
                          {participants.length}
                        </Text>
                      </View>
                    ) : null}
                    {tab.key === 'teams' && isRoundingMeeting ? (
                      <View style={[styles.tabCountChip, activeTab === tab.key && styles.tabCountChipActive]}>
                        <Text style={[styles.tabCountText, activeTab === tab.key && styles.tabCountTextActive]}>
                          {teams.length}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.tabContentWrap}>
            {activeTab === 'participants' && (
              <View style={styles.tabSection}>
                {isRoundingMeeting ? (
                  <View style={styles.participantSummaryCard}>
                    <View style={styles.participantSummaryHeader}>
                      <View style={styles.participantSummaryHeaderText}>
                        <Text style={styles.participantSummaryTitle}>참가 신청 관리</Text>
                        {isRoundingMeeting ? (
                          <Text style={styles.participantSummaryDescription}>
                            참가자를 확인하고 조기 마감 또는 팀 편성을 진행할 수 있습니다.
                          </Text>
                        ) : null}
                      </View>
                      {isRoundingMeeting && isApplicationClosed ? (
                        <View style={styles.applicationClosedChip}>
                          <Text style={styles.applicationClosedChipText}>신청 마감됨</Text>
                        </View>
                      ) : null}
                    </View>

                    {canShowParticipantManageActions ? (
                      <View style={styles.participantManageActions}>
                        {canShowTeamConfirmButton ? (
                          <Pressable
                            style={({ pressed }) => [
                              styles.manageActionButtonBase,
                              styles.manageActionButtonRed,
                              isTeamConfirmDisabled && styles.manageActionButtonDisabled,
                              pressed && !isTeamConfirmDisabled && styles.manageActionButtonPressed,
                            ]}
                            onPress={handleConfirmTeams}
                            disabled={isTeamConfirmDisabled}
                          >
                            <Text style={[styles.manageActionTextBase, styles.manageActionTextWhite]}>
                              팀 편성 확정
                            </Text>
                          </Pressable>
                        ) : null}
                        {canShowGuestAddButton ? (
                          <Pressable
                            style={({ pressed }) => [
                              styles.manageActionButtonBase,
                              styles.manageActionButtonGreen,
                              processingAction && styles.manageActionButtonDisabled,
                              pressed && !processingAction && styles.manageActionButtonPressed,
                            ]}
                            onPress={handleOpenGuestModal}
                            disabled={processingAction}
                          >
                            <Text style={[styles.manageActionTextBase, styles.manageActionTextWhite]}>
                              게스트 추가
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}

                    <View style={styles.participantSummaryGrid}>
                      <View style={styles.participantSummaryItem}>
                        <Text style={styles.participantSummaryLabel}>참가 인원</Text>
                        <Text style={styles.participantSummaryValue}>
                          {Number.isFinite(Number(applicationStatus?.participant_count))
                            ? Number(applicationStatus.participant_count)
                            : participantCount}명
                        </Text>
                      </View>
                      <View style={styles.participantSummaryItem}>
                        <Text style={styles.participantSummaryLabel}>모집 상태</Text>
                        <Text style={styles.participantSummaryValue}>
                          {isApplicationClosed ? '마감' : '모집 중'}
                        </Text>
                      </View>
                      <View style={styles.participantSummaryItem}>
                        <Text style={styles.participantSummaryLabel}>정원</Text>
                        <Text style={styles.participantSummaryValue}>
                          {meeting?.max_participants !== null && meeting?.max_participants !== undefined
                            ? `${meeting.max_participants}명`
                            : '-'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : null}

                {participants.length === 0 ? (
                  <Text style={styles.emptyText}>참가자가 없습니다.</Text>
                ) : (
                  participants.map(renderParticipantRow)
                )}
              </View>
            )}

            {activeTab === 'teams' && isRoundingMeeting && (
              <View style={styles.tabSection}>
                {meeting?.team_formation_confirmed_at ? (
                  <View style={styles.teamConfirmedBanner}>
                    <Text style={styles.teamConfirmedText}>
                      편성 확정일: {formatDateTime(meeting.team_formation_confirmed_at)}
                    </Text>
                  </View>
                ) : null}
                {canManageTeamsInTab ? (
                  <View style={styles.teamEditRow}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.manageActionButtonBase,
                        teams.length > 0 ? styles.manageActionButtonGreen : styles.manageActionButtonBlue,
                        processingAction && styles.manageActionButtonDisabled,
                        pressed && !processingAction && styles.manageActionButtonPressed,
                      ]}
                      onPress={handleTeamManagePrimary}
                      disabled={processingAction}
                    >
                      <Text style={[styles.manageActionTextBase, styles.manageActionTextWhite]}>
                        {teamManagePrimaryLabel}
                      </Text>
                    </Pressable>
                    {formationHistory.length > 0 ? (
                      <Pressable
                        style={({ pressed }) => [
                          styles.manageActionButtonBase,
                          styles.manageActionButtonIndigo,
                          processingAction && styles.manageActionButtonDisabled,
                          pressed && !processingAction && styles.manageActionButtonPressed,
                        ]}
                        onPress={openHistory}
                        disabled={processingAction}
                      >
                        <Text style={[styles.manageActionTextBase, styles.manageActionTextWhite]}>
                          편성 히스토리
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
                {teams.length === 0 ? (
                  <View style={styles.teamEmptyState}>
                    <Text style={styles.emptyText}>생성된 팀이 없습니다.</Text>
                  </View>
                ) : (
                  teams.map(renderTeamCard)
                )}
              </View>
            )}

            {activeTab === 'settlement' && (
              settlementBlockedMessage ? (
                <View style={styles.tabSection}>
                  <Text style={styles.settlementBlockedTitle}>정산을 진행할 수 없습니다</Text>
                  <Text style={styles.settlementBlockedText}>{settlementBlockedMessage}</Text>
                </View>
              ) : (
                <SettlementManager
                  meetingId={meetingIdValue}
                  meetingType={meetingDomainType}
                  canSettle={canSettleMeeting}
                  canManageSettlement={canManageSettlement}
                  participants={
                    confirmedParticipants.length > 0
                      ? confirmedParticipants
                      : participants
                  }
                  teams={teams}
                  onSettlementCreated={async () => {
                    await fetchMeeting();
                    await fetchSettlement();
                  }}
                  onConfirmSettlement={
                    isRoundingMeeting
                      ? (canShowConfirmSettlementButton ? handleConfirmSettlement : undefined)
                      : (settlementFeatureEnabled ? handleConfirmSettlement : undefined)
                  }
                  onSyncMeetingToSettlement={handleSyncMeetingToSettlement}
                  meeting={meeting}
                />
              )
            )}

          </View>
        </Card>
      </ScrollView>

      <Modal
        maxContentWidth={tokens.layout.wideContentMaxPreferred}
        visible={showRecordIncompleteModal}
        title="안내"
        onClose={() => setShowRecordIncompleteModal(false)}
        animationType="fade"
        containerStyle={styles.modalCard}
        backdropStyle={styles.modalBackdrop}
        footer={(
          <View style={styles.modalActionRow}>
            <Button size="sm" onPress={() => setShowRecordIncompleteModal(false)}>
              확인
            </Button>
          </View>
        )}
      >
        <Text style={styles.modalMessage}>
          해당 라운드에 대한 기록이 완료되지 않았습니다.
        </Text>
      </Modal>

      <RoundingJoinModal
        visible={joinModalOpen && isRoundingMeeting}
        onClose={closeJoinModal}
        meeting={meeting}
        userInfo={userInfo}
        setUserInfo={setUserInfo}
        userInfoLoading={userInfoLoading}
        handicapInfo={handicapInfo}
        handicapLoading={handicapLoading}
        isEditingUserInfo={isEditingUserInfo}
        onEditUserInfo={setIsEditingUserInfo}
        onUpdateUserInfo={handleUpdateUserInfo}
        onJoin={handleJoin}
        processingAction={processingAction}
      />

      <SocialJoinModal
        visible={joinModalOpen && !isRoundingMeeting}
        onClose={closeJoinModal}
        meeting={meeting}
        userInfo={userInfo}
        setUserInfo={setUserInfo}
        userInfoLoading={userInfoLoading}
        isEditingUserInfo={isEditingUserInfo}
        onEditUserInfo={setIsEditingUserInfo}
        onUpdateUserInfo={handleUpdateUserInfo}
        onJoin={handleJoin}
        processingAction={processingAction}
      />

      <Modal
        maxContentWidth={tokens.layout.wideContentMaxPreferred}
        visible={closeApplicationModalOpen}
        title="신청 마감"
        onClose={handleDismissCloseApplicationModal}
        animationType="fade"
        containerStyle={styles.modalCard}
        backdropStyle={styles.modalBackdrop}
        footer={(
          <View style={styles.modalActionRow}>
            <Button size="sm" variant="outline" onPress={handleDismissCloseApplicationModal}>
              닫기
            </Button>
            <Button size="sm" onPress={handleConfirmCloseApplicationEarly}>
              확인
            </Button>
          </View>
        )}
      >
        <Text style={styles.confirmModalText}>
          지금부터는 참가 신청을 받을 수 없습니다. 신청을 마감하시겠습니까?
        </Text>
      </Modal>

      <Modal
        maxContentWidth={tokens.layout.wideContentMaxPreferred}
        visible={guestModalOpen}
        title="게스트 추가"
        onClose={handleCloseGuestModal}
        animationType="fade"
        containerStyle={styles.modalCard}
        backdropStyle={styles.modalBackdrop}
        footer={(
          <View style={styles.modalActionRow}>
            <Button size="sm" variant="outline" onPress={handleCloseGuestModal}>
              닫기
            </Button>
            <Button size="sm" onPress={handleGuestSubmit} loading={processingAction}>
              추가
            </Button>
          </View>
        )}
      >
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>이름</Text>
          <TextInput
            value={guestForm.name}
            onChangeText={(value) => setGuestForm((prev) => ({ ...prev, name: value }))}
            style={styles.input}
            placeholder="게스트 이름"
            placeholderTextColor={colors.neutral[400]}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>성별</Text>
          <View style={styles.guestGenderRow}>
            <Pressable
              style={[
                styles.guestGenderChip,
                guestForm.gender === 'MALE' && styles.guestGenderChipActive,
              ]}
              onPress={() => setGuestForm((prev) => ({ ...prev, gender: 'MALE' }))}
            >
              <Text
                style={[
                  styles.guestGenderText,
                  guestForm.gender === 'MALE' && styles.guestGenderTextActive,
                ]}
              >
                남성
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.guestGenderChip,
                guestForm.gender === 'FEMALE' && styles.guestGenderChipActive,
              ]}
              onPress={() => setGuestForm((prev) => ({ ...prev, gender: 'FEMALE' }))}
            >
              <Text
                style={[
                  styles.guestGenderText,
                  guestForm.gender === 'FEMALE' && styles.guestGenderTextActive,
                ]}
              >
                여성
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.guestFieldRow}>
          <View style={styles.guestHalfField}>
            <Text style={styles.fieldLabel}>평균타수</Text>
            <TextInput
              value={guestForm.average_score}
              onChangeText={handleGuestAverageScoreChange}
              style={styles.input}
              keyboardType="number-pad"
              placeholder="예: 95"
              placeholderTextColor={colors.neutral[400]}
            />
          </View>
          <View style={[styles.guestHalfField, styles.guestHalfFieldLast]}>
            <Text style={styles.fieldLabel}>핸디캡</Text>
            <TextInput
              value={guestForm.handicap}
              editable={false}
              style={[styles.input, styles.guestReadonlyInput]}
              placeholderTextColor={colors.neutral[400]}
            />
          </View>
        </View>
      </Modal>

      <TeamFormationModal
        visible={teamFormationOpen}
        onClose={closeTeamFormation}
        onFormTeams={handleAutoFormTeams}
        meeting={meeting}
        participants={participants}
        processing={processingAction}
        onOpenBatch={openBatchFormation}
      />

      <TeamFormationPreviewModal
        visible={teamPreviewOpen}
        onClose={closeTeamPreview}
        teams={previewTeams}
        formationMode={previewFormation?.mode ?? meeting?.team_formation_mode}
        teamSize={previewFormation?.teamSize || meeting?.team_size || 4}
        onConfirm={handleConfirmTeams}
        onReform={handleReformTeams}
        onSaveHistory={handleSaveHistory}
        processing={processingAction}
      />

      <TeamEditorModal
        visible={teamEditorOpen}
        onClose={closeTeamEditor}
        teams={teams}
        participants={participants}
        meetingId={meetingIdValue}
        onSave={handleTeamsSave}
        processing={processingAction}
      />

      <BatchFormationModal
        visible={batchFormationOpen}
        onClose={closeBatchFormation}
        meeting={meeting}
        onFormTeams={handleAutoFormTeams}
        onViewDetail={handleBatchViewDetail}
        processing={processingAction}
      />

      <FormationHistoryModal
        visible={historyOpen}
        onClose={closeHistory}
        history={formationHistory}
        onRestore={handleRestoreHistory}
        onViewDetail={handleHistoryViewDetail}
        processing={processingAction}
      />

      <RoundingCompleteModal
        visible={roundingCompleteOpen}
        onClose={closeRoundingComplete}
        onInputNow={openScoreModal}
        onInputLater={handleInputLater}
      />

      <SimpleScoreInputModal
        visible={scoreModalOpen}
        onClose={closeScoreModal}
        meetingId={meetingIdValue}
        participantId={myParticipantId}
        currentHandicap={currentHandicap}
        onSuccess={handleScoreSuccess}
      />

      <AppToast toast={settlementToast} onClose={() => setSettlementToast(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: base.safeAreaNeutral,
  safeAreaRelative: { position: 'relative' },
  container: base.containerLg,
  topActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: tokens.spacing.xs2,
  },
  iconGhostButton: {
    width: 30,
    height: 30,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    marginBottom: tokens.spacing.md,
  },
  meetingBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: tokens.spacing.xs2,
  },
  meetingTypeBadge: {
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.padding.sm,
    paddingVertical: tokens.padding.xs2,
    borderWidth: 1,
  },
  roundingTypeBadge: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[600],
  },
  socialTypeBadge: {
    backgroundColor: colors.info[50],
    borderColor: colors.info[600],
  },
  meetingTypeBadgeText: {
    fontSize: tokens.font.xs,
    fontWeight: tokens.fontWeight.semibold,
  },
  roundingTypeBadgeText: {
    color: colors.success[700],
  },
  socialTypeBadgeText: {
    color: colors.info[700],
  },
  meetingStatusBadge: {
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.padding.sm,
    paddingVertical: tokens.padding.xs2,
    borderWidth: 1,
  },
  meetingStatusBadgeText: {
    fontSize: tokens.font.xs,
    fontWeight: tokens.fontWeight.semibold,
  },
  title: {
    fontSize: tokens.font.xl,
    fontWeight: tokens.fontWeight.bold,
    color: colors.neutral[900],
    marginBottom: tokens.spacing.xxs,
  },
  subtitle: { ...base.textSmSubtle, marginBottom: tokens.spacing.sm2 },
  topButtonsSection: {
    marginBottom: tokens.spacing.xs2,
  },
  topButtonsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topButtonBase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: tokens.radius.base,
    paddingHorizontal: tokens.padding.sm,
    paddingVertical: tokens.padding.xs,
  },
  topButtonJoin: {
    backgroundColor: colors.success[600],
  },
  topButtonEdit: {
    backgroundColor: colors.primary[600],
  },
  topButtonWarning: {
    backgroundColor: colors.warning[600],
  },
  topButtonBlue: {
    backgroundColor: colors.blue[600],
  },
  topButtonOrange: {
    backgroundColor: colors.warning[700],
  },
  topButtonPurple: {
    backgroundColor: colors.violet[600],
  },
  topButtonDanger: {
    backgroundColor: colors.error[600],
  },
  topButtonPressed: {
    opacity: 0.9,
  },
  topButtonDisabled: {
    opacity: 0.55,
  },
  topButtonText: {
    fontSize: tokens.font.xs,
    color: colors.white,
    fontWeight: tokens.fontWeight.semibold,
  },
  primaryActionRow: {
    marginTop: tokens.spacing.xs2,
    marginBottom: tokens.spacing.xs2,
  },
  primaryActionButton: {
    alignSelf: 'flex-start',
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: tokens.spacing.xs,
    marginBottom: tokens.spacing.sm,
  },
  quickActionButton: {
    flex: 1,
  },
  managerActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: tokens.spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: tokens.spacing.xs2,
  },
  manageActionButtonBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: tokens.radius.sm,
    paddingHorizontal: tokens.padding.sm,
    paddingVertical: tokens.padding.xs,
  },
  manageActionButtonPressed: {
    opacity: 0.9,
  },
  manageActionButtonDisabled: {
    opacity: 0.5,
  },
  manageActionButtonAmberOutline: {
    borderWidth: 1,
    borderColor: colors.warning[600],
    backgroundColor: colors.warning[50],
  },
  manageActionButtonGreen: {
    backgroundColor: colors.green[600],
  },
  manageActionButtonBlue: {
    backgroundColor: colors.blue[600],
  },
  manageActionButtonPurple: {
    backgroundColor: colors.violet[600],
  },
  manageActionButtonIndigo: {
    backgroundColor: colors.accent[700],
  },
  manageActionButtonRed: {
    backgroundColor: colors.error[600],
  },
  manageActionButtonRoseTint: {
    backgroundColor: colors.error[100],
  },
  manageActionTextBase: {
    fontSize: tokens.font.xs,
    fontWeight: tokens.fontWeight.semibold,
  },
  manageActionTextWhite: {
    color: colors.white,
  },
  manageActionTextAmber: {
    color: colors.warning[700],
  },
  manageActionTextRose: {
    color: colors.error[600],
  },
  embeddedSection: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[50],
    padding: tokens.padding.sm,
    marginTop: tokens.spacing.sm2,
  },
  sectionHeading: {
    fontSize: tokens.font.base,
    fontWeight: tokens.fontWeight.bold,
    color: colors.neutral[900],
    marginBottom: tokens.spacing.sm2,
  },
  infoList: {
    gap: tokens.spacing.xs2,
  },
  infoItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIcon: {
    marginTop: 3,
    marginRight: 8,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoLabel: {
    fontSize: tokens.font.xs,
    color: colors.neutral[500],
    marginBottom: 2,
  },
  infoValue: {
    fontSize: tokens.font.sm,
    color: colors.neutral[900],
    fontWeight: tokens.fontWeight.semibold,
  },
  infoValueMultiline: {
    lineHeight: 19,
  },
  tabsContainerCard: {
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
    padding: 0,
    overflow: 'hidden',
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  tabButton: {
    flex: 1,
    minWidth: 90,
    paddingHorizontal: tokens.padding.xs2,
    paddingVertical: tokens.padding.sm,
    alignItems: 'center',
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary[600],
  },
  tabText: {
    fontSize: tokens.font.sm,
    color: colors.neutral[600],
    fontWeight: tokens.fontWeight.semibold,
  },
  tabTextActive: {
    color: colors.primary[600],
  },
  tabTextDisabled: {
    color: colors.neutral[300],
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabCountChip: {
    borderRadius: tokens.radius.pill,
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tabCountChipActive: {
    backgroundColor: colors.neutral[100],
  },
  tabCountText: {
    fontSize: tokens.font.xxs,
    color: colors.neutral[700],
    fontWeight: tokens.fontWeight.bold,
  },
  tabCountTextActive: {
    color: colors.neutral[700],
  },
  tabContentWrap: {
    padding: tokens.padding.md,
  },
  tabSection: {
    gap: tokens.spacing.sm2,
  },
  socialManageHint: {
    fontSize: tokens.font.sm,
    color: colors.neutral[600],
    marginBottom: tokens.spacing.xs2,
  },
  participantSummaryCard: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: tokens.radius.md,
    backgroundColor: colors.neutral[50],
    padding: tokens.padding.sm,
    marginBottom: tokens.spacing.sm,
  },
  participantSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: tokens.spacing.xs2,
  },
  participantSummaryHeaderText: {
    flex: 1,
  },
  participantSummaryTitle: {
    fontSize: tokens.font.sm,
    color: colors.neutral[900],
    fontWeight: tokens.fontWeight.bold,
  },
  participantSummaryDescription: {
    marginTop: 2,
    fontSize: tokens.font.xs,
    color: colors.neutral[500],
  },
  applicationClosedChip: {
    borderRadius: tokens.radius.pill,
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[600],
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  applicationClosedChipText: {
    fontSize: tokens.font.xxs,
    color: colors.warning[700],
    fontWeight: tokens.fontWeight.semibold,
  },
  participantManageActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: tokens.spacing.sm,
  },
  participantSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  participantSummaryItem: {
    minWidth: 90,
    flex: 1,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: tokens.radius.sm,
    backgroundColor: colors.white,
    paddingHorizontal: tokens.padding.xs2,
    paddingVertical: tokens.padding.xs,
  },
  participantSummaryLabel: {
    fontSize: tokens.font.xxs,
    color: colors.neutral[500],
    marginBottom: 2,
  },
  participantSummaryValue: {
    fontSize: tokens.font.sm,
    color: colors.neutral[900],
    fontWeight: tokens.fontWeight.bold,
  },
  participantCard: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: tokens.radius.md,
    backgroundColor: colors.neutral[50],
    padding: tokens.padding.sm,
    marginBottom: tokens.spacing.xs2,
  },
  participantTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  participantAvatar: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.pill,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing.xs2,
  },
  participantMain: {
    flexDirection: 'column',
    flex: 1,
  },
  participantName: {
    fontSize: tokens.font.sm,
    color: colors.neutral[800],
    fontWeight: tokens.fontWeight.semibold,
  },
  participantSubText: {
    marginTop: 2,
    fontSize: tokens.font.xs,
    color: colors.neutral[500],
  },
  participantBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  miniBadge: {
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  miniBadgeText: {
    fontSize: tokens.font.xs,
    fontWeight: tokens.fontWeight.semibold,
  },
  genderBadge: {
    backgroundColor: colors.info[50],
  },
  genderBadgeText: {
    color: colors.info[700],
  },
  roleBadge: {
    backgroundColor: colors.success[50],
  },
  roleBadgeText: {
    color: colors.success[700],
  },
  organizerBadge: {
    backgroundColor: colors.error[50],
  },
  organizerBadgeText: {
    color: colors.error[700],
  },
  guestBadge: {
    backgroundColor: colors.neutral[100],
  },
  guestBadgeText: {
    color: colors.neutral[700],
  },
  emptyText: {
    fontSize: tokens.font.sm,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  teamCard: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: tokens.radius.md,
    padding: tokens.padding.sm,
    marginTop: tokens.spacing.sm,
  },
  teamConfirmedBanner: {
    borderWidth: 1,
    borderColor: colors.success[200],
    borderRadius: tokens.radius.sm,
    backgroundColor: colors.success[50],
    paddingHorizontal: tokens.padding.sm,
    paddingVertical: tokens.padding.xs2,
    marginBottom: tokens.spacing.xs2,
  },
  teamConfirmedText: {
    fontSize: tokens.font.xs,
    color: colors.success[700],
    fontWeight: tokens.fontWeight.semibold,
  },
  teamEditRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: tokens.spacing.xs2,
  },
  teamEmptyState: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.neutral[300],
    borderRadius: tokens.radius.md,
    backgroundColor: colors.neutral[50],
    paddingVertical: tokens.padding.xl,
    paddingHorizontal: tokens.padding.md,
  },
  teamHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.xs,
  },
  teamCount: {
    fontSize: tokens.font.xs,
    color: colors.neutral[500],
    fontWeight: tokens.fontWeight.semibold,
  },
  teamTitle: {
    fontSize: tokens.font.md,
    fontWeight: tokens.fontWeight.bold,
    color: colors.neutral[900],
  },
  teamMemberCard: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: tokens.radius.sm,
    backgroundColor: colors.white,
    padding: tokens.padding.xs2,
    marginBottom: tokens.spacing.xs2,
  },
  teamMember: {
    fontSize: tokens.font.sm,
    color: colors.neutral[700],
    marginBottom: tokens.spacing.xxs,
  },
  teamMemberBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  settlementBlockedTitle: {
    fontSize: tokens.font.base,
    color: colors.error[700],
    fontWeight: tokens.fontWeight.bold,
    marginBottom: tokens.spacing.xs,
  },
  settlementBlockedText: {
    fontSize: tokens.font.sm,
    color: colors.error[600],
    lineHeight: 20,
  },
  stateRow: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stateText: {
    fontSize: tokens.font.sm,
    color: colors.neutral[600],
  },
  modalBackdrop: {
    paddingHorizontal: tokens.padding.md,
  },
  modalCard: {
    width: '100%',
    alignSelf: 'center',
  },
  modalMessage: {
    fontSize: tokens.font.sm,
    color: colors.neutral[700],
    marginBottom: tokens.spacing.md,
  },
  fieldGroup: {
    marginBottom: tokens.spacing.sm2,
  },
  fieldLabel: {
    fontSize: tokens.font.xs,
    color: colors.neutral[600],
    marginBottom: tokens.spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: tokens.radius.base,
    backgroundColor: colors.white,
    color: colors.neutral[900],
    fontSize: tokens.font.base,
    paddingHorizontal: tokens.padding.sm,
    paddingVertical: tokens.padding.base,
  },
  guestGenderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  guestGenderChip: {
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: tokens.radius.baseLg,
    paddingHorizontal: tokens.padding.sm,
    paddingVertical: tokens.padding.xs2,
    backgroundColor: colors.white,
  },
  guestGenderChipActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  guestGenderText: {
    fontSize: tokens.font.xs,
    color: colors.neutral[700],
    fontWeight: tokens.fontWeight.semibold,
  },
  guestGenderTextActive: {
    color: colors.white,
  },
  guestFieldRow: {
    flexDirection: 'row',
    marginBottom: tokens.spacing.sm2,
  },
  guestHalfField: {
    flex: 1,
  },
  guestHalfFieldLast: {
    marginLeft: 8,
  },
  guestReadonlyInput: {
    backgroundColor: colors.neutral[100],
    color: colors.neutral[700],
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: tokens.spacing.xs,
  },
  confirmModalText: {
    fontSize: tokens.font.base,
    lineHeight: 22,
    color: colors.neutral[700],
  },
  errorText: base.textSmError,
});
