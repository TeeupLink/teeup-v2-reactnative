import { FontAwesome5 } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useEffect, useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView, StyleSheet, Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppHeader from '@/components/layout/AppHeader';
import MeetingCard from '@/components/meetings/MeetingCard';
import MeetingDateField from '@/components/meetings/MeetingDateField';
import Button from '@/components/ui/Button';
import PaginationNav from '@/components/ui/PaginationNav';
import { meetingTabs, meetingValidTabs } from '@/constants/meetingConstants';
import { useAuth } from '@/context/AuthContext';
import { useBlockedUsers } from '@/context/BlockContext';
import { meetingsApi } from '@/lib/api/api';
import {
  createCreateMeetingHandler,
  createDateChangeHandler,
  createFetchParticipatingMeetingsHandler,
  createFetchRoundingMeetingsHandler,
  createFetchSocialMeetingsHandler,
  createMeetingPressHandler,
  createNextPageHandler,
  createPageNumberHandler,
  createPrevPageHandler,
  createResetDatesHandler,
  createSearchHandler,
  createSearchInputChangeHandler,
  createStatusFilterHandler,
  createTabChangeHandler,
} from '@/lib/handler/meetings';
import {
  extractList,
  getActiveFilters,
  getPageNumbers,
} from '@/lib/util/meetingUtils';
import { colors } from '@/styles/colors';
import { base, tokens } from '@/styles/style';

import LoginScreen from '../../login';


export default function MeetingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const initialTab = useMemo(
    () => (meetingValidTabs.includes(tabParam) ? tabParam : 'rounding'),
    [tabParam]
  );
  const [activeTab, setActiveTab] = useState(initialTab);

  const [roundingMeetings, setRoundingMeetings] = useState([]);
  const [socialMeetings, setSocialMeetings] = useState([]);
  const [participatingMeetings, setParticipatingMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [roundingPage, setRoundingPage] = useState(1);
  const [socialPage, setSocialPage] = useState(1);
  const [participatingPage, setParticipatingPage] = useState(1);
  const [roundingTotalPages, setRoundingTotalPages] = useState(1);
  const [socialTotalPages, setSocialTotalPages] = useState(1);
  const [participatingTotalPages, setParticipatingTotalPages] = useState(1);

  const [roundingSearchInput, setRoundingSearchInput] = useState('');
  const [roundingSearchQuery, setRoundingSearchQuery] = useState('');
  const [roundingStartDate, setRoundingStartDate] = useState('');
  const [roundingEndDate, setRoundingEndDate] = useState('');
  const [roundingStatusFilter, setRoundingStatusFilter] = useState('active');

  const [socialSearchInput, setSocialSearchInput] = useState('');
  const [socialSearchQuery, setSocialSearchQuery] = useState('');
  const [socialStartDate, setSocialStartDate] = useState('');
  const [socialEndDate, setSocialEndDate] = useState('');
  const [socialStatusFilter, setSocialStatusFilter] = useState('active');

  const [participatingSearchInput, setParticipatingSearchInput] = useState('');
  const [participatingSearchQuery, setParticipatingSearchQuery] = useState('');
  const [participatingStartDate, setParticipatingStartDate] = useState('');
  const [participatingEndDate, setParticipatingEndDate] = useState('');
  const [participatingStatusFilter, setParticipatingStatusFilter] = useState('active');

  useEffect(() => {
    if (!tabParam) return;
    if (!meetingValidTabs.includes(tabParam)) return;
    setActiveTab(tabParam);
  }, [tabParam]);

  const fetchRoundingMeetings = useMemo(
    () =>
      createFetchRoundingMeetingsHandler({
        fetchRounds: meetingsApi.fetchRounds,
        extractList,
        roundingPage,
        roundingSearchQuery,
        roundingStartDate,
        roundingEndDate,
        roundingStatusFilter,
        setRoundingMeetings,
        setRoundingTotalPages,
      }),
    [
      roundingPage,
      roundingSearchQuery,
      roundingStartDate,
      roundingEndDate,
      roundingStatusFilter,
      setRoundingMeetings,
      setRoundingTotalPages,
    ]
  );

  const fetchSocialMeetings = useMemo(
    () =>
      createFetchSocialMeetingsHandler({
        fetchSocials: meetingsApi.fetchSocials,
        extractList,
        socialPage,
        socialSearchQuery,
        socialStartDate,
        socialEndDate,
        socialStatusFilter,
        setSocialMeetings,
        setSocialTotalPages,
      }),
    [
      socialPage,
      socialSearchQuery,
      socialStartDate,
      socialEndDate,
      socialStatusFilter,
      setSocialMeetings,
      setSocialTotalPages,
    ]
  );

  const fetchParticipatingMeetings = useMemo(
    () =>
      createFetchParticipatingMeetingsHandler({
        fetchMyParticipatingMeetings: meetingsApi.fetchMyParticipatingMeetings,
        extractList,
        participatingPage,
        participatingSearchQuery,
        participatingStartDate,
        participatingEndDate,
        participatingStatusFilter,
        setParticipatingMeetings,
        setParticipatingTotalPages,
      }),
    [
      participatingPage,
      participatingSearchQuery,
      participatingStartDate,
      participatingEndDate,
      participatingStatusFilter,
      setParticipatingMeetings,
      setParticipatingTotalPages,
    ]
  );

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) {
        setLoading(false);
        return undefined;
      }

      const loadData = async () => {
        setLoading(true);
        setError(null);

        try {
          if (activeTab === 'rounding') {
            await fetchRoundingMeetings(roundingPage, roundingSearchQuery);
          } else if (activeTab === 'social') {
            await fetchSocialMeetings(socialPage, socialSearchQuery);
          } else {
            await fetchParticipatingMeetings(participatingPage, participatingSearchQuery);
          }
        } finally {
          setLoading(false);
        }
      };

      loadData();
      return undefined;
    }, [
      activeTab,
      fetchParticipatingMeetings,
      fetchRoundingMeetings,
      fetchSocialMeetings,
      isAuthenticated,
      participatingPage,
      participatingSearchQuery,
      roundingPage,
      roundingSearchQuery,
      socialPage,
      socialSearchQuery,
    ])
  );

  const handleTabChange = useMemo(
    () =>
      createTabChangeHandler({
        setActiveTab,
        setRoundingPage,
        setSocialPage,
        setParticipatingPage,
        router,
      }),
    [setActiveTab, setRoundingPage, setSocialPage, setParticipatingPage, router]
  );

  const handleTabPress = useMemo(
    () =>
      (tabId) =>
        () => {
          handleTabChange(tabId);
        },
    [handleTabChange]
  );

  const handleSearch = useMemo(
    () =>
      createSearchHandler({
        activeTab,
        roundingSearchInput,
        socialSearchInput,
        participatingSearchInput,
        setRoundingSearchQuery,
        setSocialSearchQuery,
        setParticipatingSearchQuery,
        setRoundingPage,
        setSocialPage,
        setParticipatingPage,
      }),
    [
      activeTab,
      roundingSearchInput,
      socialSearchInput,
      participatingSearchInput,
      setRoundingSearchQuery,
      setSocialSearchQuery,
      setParticipatingSearchQuery,
      setRoundingPage,
      setSocialPage,
      setParticipatingPage,
    ]
  );

  const handleCreateMeeting = useMemo(
    () => createCreateMeetingHandler({ router }),
    [router]
  );

  const handleMeetingClick = useMemo(
    () => createMeetingPressHandler({ router }),
    [router]
  );

  const handleStartDateChange = useMemo(
    () =>
      createDateChangeHandler({
        activeTab,
        setRoundingDate: setRoundingStartDate,
        setSocialDate: setSocialStartDate,
        setParticipatingDate: setParticipatingStartDate,
        setRoundingPage,
        setSocialPage,
        setParticipatingPage,
      }),
    [
      activeTab,
      setRoundingStartDate,
      setSocialStartDate,
      setParticipatingStartDate,
      setRoundingPage,
      setSocialPage,
      setParticipatingPage,
    ]
  );

  const handleEndDateChange = useMemo(
    () =>
      createDateChangeHandler({
        activeTab,
        setRoundingDate: setRoundingEndDate,
        setSocialDate: setSocialEndDate,
        setParticipatingDate: setParticipatingEndDate,
        setRoundingPage,
        setSocialPage,
        setParticipatingPage,
      }),
    [
      activeTab,
      setRoundingEndDate,
      setSocialEndDate,
      setParticipatingEndDate,
      setRoundingPage,
      setSocialPage,
      setParticipatingPage,
    ]
  );

  const handleResetDates = useMemo(
    () =>
      createResetDatesHandler({
        activeTab,
        setRoundingStartDate,
        setRoundingEndDate,
        setSocialStartDate,
        setSocialEndDate,
        setParticipatingStartDate,
        setParticipatingEndDate,
        setRoundingPage,
        setSocialPage,
        setParticipatingPage,
      }),
    [
      activeTab,
      setRoundingStartDate,
      setRoundingEndDate,
      setSocialStartDate,
      setSocialEndDate,
      setParticipatingStartDate,
      setParticipatingEndDate,
      setRoundingPage,
      setSocialPage,
      setParticipatingPage,
    ]
  );

  const handleSearchInputChange = useMemo(
    () =>
      createSearchInputChangeHandler({
        activeTab,
        setRoundingSearchInput,
        setSocialSearchInput,
        setParticipatingSearchInput,
      }),
    [activeTab, setRoundingSearchInput, setSocialSearchInput, setParticipatingSearchInput]
  );

  const handleStatusFilterChange = useMemo(
    () =>
      createStatusFilterHandler({
        activeTab,
        setRoundingStatusFilter,
        setSocialStatusFilter,
        setParticipatingStatusFilter,
        setRoundingPage,
        setSocialPage,
        setParticipatingPage,
      }),
    [
      activeTab,
      setRoundingStatusFilter,
      setSocialStatusFilter,
      setParticipatingStatusFilter,
      setRoundingPage,
      setSocialPage,
      setParticipatingPage,
    ]
  );

  const handlePrevPage = useMemo(
    () =>
      createPrevPageHandler({
        activeTab,
        roundingPage,
        socialPage,
        participatingPage,
        setRoundingPage,
        setSocialPage,
        setParticipatingPage,
      }),
    [
      activeTab,
      roundingPage,
      socialPage,
      participatingPage,
      setRoundingPage,
      setSocialPage,
      setParticipatingPage,
    ]
  );

  const handleNextPage = useMemo(
    () =>
      createNextPageHandler({
        activeTab,
        roundingPage,
        socialPage,
        participatingPage,
        roundingTotalPages,
        socialTotalPages,
        participatingTotalPages,
        setRoundingPage,
        setSocialPage,
        setParticipatingPage,
      }),
    [
      activeTab,
      roundingPage,
      socialPage,
      participatingPage,
      roundingTotalPages,
      socialTotalPages,
      participatingTotalPages,
      setRoundingPage,
      setSocialPage,
      setParticipatingPage,
    ]
  );

  const handlePageNumberChange = useMemo(
    () => createPageNumberHandler({ activeTab, setRoundingPage, setSocialPage, setParticipatingPage }),
    [activeTab, setRoundingPage, setSocialPage, setParticipatingPage]
  );

  const hasActiveFilters = getActiveFilters({
    activeTab,
    roundingSearchQuery,
    roundingStartDate,
    roundingEndDate,
    socialSearchQuery,
    socialStartDate,
    socialEndDate,
    participatingSearchQuery,
    participatingStartDate,
    participatingEndDate,
  });

  const { isBlocked } = useBlockedUsers();
  const currentMeetingsRaw = activeTab === 'rounding'
    ? roundingMeetings
    : activeTab === 'social'
      ? socialMeetings
      : participatingMeetings;
  // 차단한 사용자가 주최한 모임은 목록에서 숨긴다
  const currentMeetings = currentMeetingsRaw.filter(
    (m) => !isBlocked(m?.created_by ?? m?.creator_id),
  );
  const currentPage = activeTab === 'rounding'
    ? roundingPage
    : activeTab === 'social'
      ? socialPage
      : participatingPage;
  const totalPages = activeTab === 'rounding'
    ? roundingTotalPages
    : activeTab === 'social'
      ? socialTotalPages
      : participatingTotalPages;

  const pageNumbers = useMemo(
    () => getPageNumbers({ currentPage, totalPages }),
    [currentPage, totalPages]
  );

  const startDate = activeTab === 'rounding'
    ? roundingStartDate
    : activeTab === 'social'
      ? socialStartDate
      : participatingStartDate;
  const endDate = activeTab === 'rounding'
    ? roundingEndDate
    : activeTab === 'social'
      ? socialEndDate
      : participatingEndDate;
  const showResetDates = Boolean(startDate || endDate);
  const statusFilter = activeTab === 'rounding'
    ? roundingStatusFilter
    : activeTab === 'social'
      ? socialStatusFilter
      : participatingStatusFilter;
  const searchInput = activeTab === 'rounding'
    ? roundingSearchInput
    : activeTab === 'social'
      ? socialSearchInput
      : participatingSearchInput;
  const activeTabLabel = activeTab === 'rounding'
    ? '라운딩'
    : activeTab === 'social'
      ? '소셜'
      : '내가 참가한';
  const showCreateFromEmpty = activeTab === 'rounding' || activeTab === 'social';
  const canCreateMeeting = true;

  if (authLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  if (error === 'AUTH_REQUIRED') {
    return <LoginScreen />;
  }

  return (
    <View style={styles.safeArea}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <AppHeader />
      </SafeAreaView>
      <View style={styles.headerContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>모임 목록</Text>
          <View style={styles.createRow}>
            <Button
              onPress={handleCreateMeeting('rounding')}
              style={[
                styles.createButton,
                styles.createButtonRounding,
              ]}
            >
              <FontAwesome5 name="plus" size={12} color={colors.white} />
              <Text style={styles.createButtonText}>라운딩 생성</Text>
            </Button>
            <Button
              onPress={handleCreateMeeting('social')}
              style={[
                styles.createButton,
                styles.createButtonSocial,
              ]}
            >
              <FontAwesome5 name="plus" size={12} color={colors.white} />
              <Text style={styles.createButtonText}>소셜 생성</Text>
            </Button>
          </View>
        </View>

        <View style={styles.tabBar}>
          <View style={styles.tabBarRow}>
            {meetingTabs.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={handleTabPress(tab.id)}
                  style={[styles.tabButton, selected && styles.tabButtonActive]}
                >
                  <Text style={[styles.tabText, selected && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
      <View style={styles.content}>
        <ScrollView contentContainerStyle={styles.container}>

          <View style={styles.filtersBlock}>
            <View style={styles.dateRow}>
              <MeetingDateField value={startDate} onChange={handleStartDateChange} styles={styles} />
              <Text style={styles.dateDivider}>~</Text>
              <MeetingDateField value={endDate} onChange={handleEndDateChange} styles={styles} />
              {showResetDates ? (
                <Pressable onPress={handleResetDates} style={styles.resetButton}>
                  <Text style={styles.resetButtonText}>초기화</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.searchRow}>
              <View style={styles.searchInputWrap}>
                <FontAwesome5 name="search" size={14} color={colors.neutral[400]} />
                <TextInput
                  value={searchInput}
                  onChangeText={handleSearchInputChange}
                  placeholder="모임명으로 검색..."
                  placeholderTextColor={colors.neutral[400]}
                  style={styles.searchInput}
                  returnKeyType="search"
                  onSubmitEditing={handleSearch}
                />
              </View>
              <Pressable onPress={handleSearch} style={styles.searchButton}>
                <Text style={styles.searchButtonText}>검색</Text>
              </Pressable>
            </View>
          </View>

        <View style={styles.statusRow}>
          <Pressable
            onPress={handleStatusFilterChange('active')}
            style={[
              styles.statusButton,
              statusFilter === 'active'
                ? styles.statusButtonActive
                : styles.statusButtonInactive,
            ]}
          >
            <Text
              style={[
                styles.statusButtonText,
                statusFilter === 'active' && styles.statusButtonTextActive,
              ]}
            >
              진행
            </Text>
          </Pressable>
          <Text style={styles.statusDivider}>|</Text>
          <Pressable
            onPress={handleStatusFilterChange('completed')}
            style={[
              styles.statusButton,
              statusFilter === 'completed'
                ? styles.statusButtonActive
                : styles.statusButtonInactive,
            ]}
          >
            <Text
              style={[
                styles.statusButtonText,
                statusFilter === 'completed' && styles.statusButtonTextActive,
              ]}
            >
              완료/취소
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
          </View>
        ) : currentMeetings.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome5 name="calendar-alt" size={44} color={colors.neutral[300]} />
            {hasActiveFilters ? (
              <>
                <Text style={styles.emptyTitle}>
                  조건에 해당하는 {activeTabLabel} 모임이 없습니다
                </Text>
                <Text style={styles.emptySubtitle}>검색 조건을 변경해보세요.</Text>
              </>
            ) : (
              <>
                <Text style={styles.emptyTitle}>
                  {statusFilter === 'completed'
                    ? `완료/취소된 ${activeTabLabel} 모임이 없습니다`
                    : `진행 중인 ${activeTabLabel} 모임이 없습니다`}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {statusFilter === 'completed'
                    ? '완료되거나 취소된 모임이 없습니다.'
                    : '현재 진행 중이거나 진행 예정인 모임이 없습니다.'}
                </Text>
                {statusFilter !== 'completed' && showCreateFromEmpty && canCreateMeeting ? (
                  <Button
                    onPress={handleCreateMeeting(activeTab)}
                    style={[
                      styles.emptyCreateButton,
                      activeTab === 'rounding'
                        ? styles.createButtonRounding
                        : styles.createButtonSocial,
                    ]}
                  >
                    <Text style={styles.emptyCreateButtonText}>
                      {activeTab === 'rounding' ? '라운딩' : '소셜'} 모임 생성하기
                    </Text>
                  </Button>
                ) : null}
              </>
            )}
          </View>
        ) : (
          <>
            <View style={styles.cardList}>
              {currentMeetings.map((meeting) => {
                const meetingId = meeting?.id || meeting?.meeting_id;
                if (!meetingId) return null;
                return (
                  <MeetingCard
                    key={meetingId}
                    meeting={{ ...meeting, id: meetingId }}
                    onPress={handleMeetingClick(meeting)}
                    styles={styles}
                    currentUserId={user?.id ?? null}
                  />
                );
              })}
            </View>

            {totalPages > 0 && (
              <PaginationNav
                mode="numbered"
                currentPage={currentPage}
                totalPages={totalPages}
                pageNumbers={pageNumbers}
                onPrev={handlePrevPage}
                onNext={handleNextPage}
                onPage={handlePageNumberChange}
                styles={styles}
                styleKeys={{
                  container: 'paginationRow',
                  navButton: 'pageNavButton',
                  navButtonDisabled: 'pageNavButtonDisabled',
                  navText: 'pageNavText',
                  numbersRow: 'pageNumbersRow',
                  numberButton: 'pageNumber',
                  numberButtonActive: 'pageNumberActive',
                  numberButtonInactive: 'pageNumberInactive',
                  numberText: 'pageNumberText',
                  numberTextActive: 'pageNumberTextActive',
                }}
              />
            )}
          </>
        )}

        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: base.tabScreenSafeArea,
  headerSafeArea: base.tabScreenHeaderSafeArea,
  headerContainer: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
  },
  container: base.container,
  content: {
    flex: 1,
  },
  stateContainer: base.stateCenter,
  loadingBlock: {
    paddingVertical: tokens.padding.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noClubState: {
    paddingVertical: tokens.padding.xxxl,
    alignItems: 'center',
  },
  noClubTitle: {
    marginTop: tokens.spacing.md,
    fontSize: tokens.font.xl,
    fontWeight: tokens.fontWeight.bold,
    color: colors.neutral[900],
  },
  noClubSubtitle: {
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
    fontSize: tokens.font.sm,
    color: colors.neutral[600],
    textAlign: 'center',
    lineHeight: 18,
  },
  headerRow: base.tabScreenHeaderRow,
  title: base.tabScreenTitle,
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  createButton: {
    ...base.headerCreateButton,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  createButtonPressed: {
    opacity: 0.9,
  },
  createButtonRounding: {
    backgroundColor: colors.primary[600],
  },
  createButtonSocial: {
    backgroundColor: colors.accent[600],
  },
  createButtonText: base.headerCreateButtonText,
  createHint: {
    marginTop: tokens.spacing.xs2,
    fontSize: tokens.font.xs,
    color: colors.neutral[500],
  },
  tabBar: base.tabScreenTabBar,
  tabBarRow: base.tabScreenTabBarRow,
  tabButton: base.tabScreenTabButton,
  tabButtonActive: base.tabScreenTabButtonActive,
  tabText: base.tabScreenTabText,
  tabTextActive: base.tabScreenTabTextActive,
  filtersBlock: {
    gap: 12,
    marginBottom: tokens.spacing.md,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateField: {
    flex: 1,
  },
  dateInput: {
    ...base.formInput,
    paddingHorizontal: tokens.padding.base,
  },
  dateInputText: {
    fontSize: tokens.font.sm,
    color: colors.neutral[900],
    fontWeight: tokens.fontWeight.semibold,
  },
  dateInputPlaceholder: {
    color: colors.neutral[400],
    fontWeight: tokens.fontWeight.medium,
  },
  dateDivider: {
    color: colors.neutral[500],
    fontSize: tokens.font.sm,
  },
  resetButton: {
    paddingHorizontal: tokens.padding.base,
    paddingVertical: tokens.padding.base,
  },
  resetButtonText: {
    fontSize: tokens.font.sm,
    color: colors.neutral[600],
    fontWeight: tokens.fontWeight.semibold,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInputWrap: {
    ...base.searchBox,
    flex: 1,
    gap: 8,
  },
  searchInput: base.searchInput,
  searchButton: base.searchButton,
  searchButtonText: base.searchButtonText,
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: tokens.spacing.md,
  },
  statusButton: {
    ...base.filterButton,
    paddingHorizontal: tokens.padding.baseLg,
    paddingVertical: tokens.padding.base,
  },
  statusButtonActive: base.filterButtonActive,
  statusButtonInactive: {
    backgroundColor: colors.neutral[100],
  },
  statusButtonText: {
    ...base.filterButtonText,
    fontWeight: tokens.fontWeight.bold,
  },
  statusButtonTextActive: base.filterButtonTextActive,
  statusDivider: {
    fontSize: tokens.font.sm,
    color: colors.neutral[400],
  },
  emptyState: {
    paddingVertical: tokens.padding.xxxl,
    alignItems: 'center',
  },
  emptyTitle: {
    ...base.emptyStateTitle,
    fontSize: tokens.font.lg,
    marginTop: tokens.spacing.md,
    paddingHorizontal: tokens.padding.lg,
  },
  emptySubtitle: {
    ...base.emptyStateSubtitle,
    marginTop: tokens.spacing.xs2,
    paddingHorizontal: tokens.padding.lg,
    lineHeight: 18,
  },
  emptyCreateButton: {
    paddingHorizontal: tokens.padding.baseLg,
    paddingVertical: tokens.padding.base,
    borderRadius: tokens.radius.base,
  },
  emptyCreateButtonText: base.headerCreateButtonText,
  cardList: {
    marginTop: tokens.spacing.xxs,
  },
  cardPressable: base.tabCardPressable,
  cardPressed: { opacity: 0.96 },
  card: base.tabCard,
  cardHeader: { ...base.tabCardHeader, gap: 10 },
  cardTitleArea: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: base.cardTitleSm,
  cardSubtitle: { ...base.sectionSubtitle, marginTop: tokens.spacing.hairline },
  cardBadgeRow: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusBadgeRow: {
    ...base.badgeRow,
    justifyContent: 'flex-end',
  },
  badge: { ...base.badgeBase, paddingHorizontal: tokens.padding.base },
  badgeText: { ...base.badgeBaseText, fontWeight: tokens.fontWeight.bold },
  cardDescription: base.tabCardDescription,
  metaList: base.tabCardMetaList,
  extraList: base.tabCardMetaList,
  metaItem: base.tabCardMetaItem,
  golfEmoji: {
    fontSize: tokens.font.sm,
  },
  metaText: base.tabCardMetaText,
  cardFooter: base.tabCardFooter,
  cardDate: base.tabCardDate,
  cardLink: { ...base.tabCardLink, fontWeight: tokens.fontWeight.bold },
  paginationRow: base.paginationRow,
  pageNavButton: {
    ...base.paginationNavButton,
    paddingVertical: tokens.padding.base,
    backgroundColor: colors.neutral[100],
  },
  pageNavButtonDisabled: base.paginationNavButtonDisabled,
  pageNavText: base.paginationNavText,
  pageNumbersRow: base.paginationNumbersRow,
  pageNumber: {
    ...base.paginationNumber,
    paddingVertical: tokens.padding.base,
  },
  pageNumberActive: base.paginationNumberActive,
  pageNumberInactive: {
    backgroundColor: colors.neutral[100],
  },
  pageNumberText: { ...base.paginationNumberText, color: colors.neutral[700] },
  pageNumberTextActive: base.paginationNumberTextActive,
});
