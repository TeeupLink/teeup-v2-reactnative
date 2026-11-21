
import { FontAwesome5 } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView, StyleSheet, Text,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PaginationNav from '@/components/ui/PaginationNav';
import SelectableChip from '@/components/ui/SelectableChip';
import {
    myMeetingsStatusConfig,
    myMeetingsTypeConfig,
    myMeetingsTypeTabs
} from '@/constants/mypageConstants';
import { mypageApi } from '@/lib/api/api';
import {
    createDatePickerChangeHandler,
    createFetchMeetingsHandler,
    createMeetingDetailHandler,
    createNextPageHandler,
    createOpenDatePickerHandler,
    createPrevPageHandler,
    createResetFiltersHandler,
    createTypeFilterHandler,
} from '@/lib/handler/mypage';
import {
    extractList,
    formatMeetingTimeShort,
    getMeetingStatusKey,
} from '@/lib/util/meetingUtils';
import { fromYmd, hasMeetingFilters, toYmd } from '@/lib/util/mypageUtils';
import { colors } from '@/styles/colors';
import { base, tokens } from '@/styles/style';





export default function MyMeetingsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const safeAreaEdges = pathname === '/mypage/meetings' ? ['top'] : [];

  /* =========================
     State
  ========================= */
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState(''); // YYYY-MM-DD
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  const [meetings, setMeetings] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const handleTypeFilterSelect = useMemo(
    () => createTypeFilterHandler({ setTypeFilter, setPage }),
    [setTypeFilter, setPage]
  );
  const handleTypeTabPress = useMemo(
    () => (tabId) => () => {
      handleTypeFilterSelect(tabId);
    },
    [handleTypeFilterSelect]
  );
  const handleStartPickerChange = useMemo(
    () => createDatePickerChangeHandler({ setValue: setStartDate, setPage, toYmd, setShowPicker: setShowStartPicker }),
    [setStartDate, setPage, setShowStartPicker]
  );
  const handleEndPickerChange = useMemo(
    () => createDatePickerChangeHandler({ setValue: setEndDate, setPage, toYmd, setShowPicker: setShowEndPicker }),
    [setEndDate, setPage, setShowEndPicker]
  );
  const openStartPicker = useMemo(
    () =>
      createOpenDatePickerHandler({
        platform: Platform.OS,
        value: startDate,
        setValue: setStartDate,
        setPage,
        setShowPicker: setShowStartPicker,
        DateTimePickerAndroid,
        fromYmd,
        toYmd,
      }),
    [startDate, setStartDate, setPage, setShowStartPicker]
  );
  const openEndPicker = useMemo(
    () =>
      createOpenDatePickerHandler({
        platform: Platform.OS,
        value: endDate,
        setValue: setEndDate,
        setPage,
        setShowPicker: setShowEndPicker,
        DateTimePickerAndroid,
        fromYmd,
        toYmd,
      }),
    [endDate, setEndDate, setPage, setShowEndPicker]
  );

  /* =========================
     Fetch
  ========================= */
  const fetchMeetings = useMemo(
    () =>
      createFetchMeetingsHandler({
        fetchMyMeetings: mypageApi.fetchMyMeetings,
        extractList,
        page,
        typeFilter,
        startDate,
        endDate,
        setMeetings,
        setTotalPages,
        setLoading,
        setError,
      }),
    [page, typeFilter, startDate, endDate, setMeetings, setTotalPages, setLoading, setError]
  );

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  /* =========================
     Status Filter (Client)
  ========================= */
  const filteredMeetings = useMemo(() => {
    return meetings.filter((meeting) => {
      const statusKey = getMeetingStatusKey(meeting);
      return statusFilter === 'all' || statusKey === statusFilter;
    });
  }, [meetings, statusFilter]);

  const hasActiveFilters = hasMeetingFilters({ typeFilter, startDate, endDate });

  const resetFilters = useMemo(
    () =>
      createResetFiltersHandler({
        setTypeFilter,
        setStatusFilter,
        setStartDate,
        setEndDate,
        setPage,
      }),
    [setTypeFilter, setStatusFilter, setStartDate, setEndDate, setPage]
  );
  const handleMeetingDetail = useMemo(
    () => createMeetingDetailHandler({ router }),
    [router]
  );
  const handlePrevPage = useMemo(
    () => createPrevPageHandler({ setPage }),
    [setPage]
  );
  const handleNextPage = useMemo(
    () => createNextPageHandler({ setPage, totalPages }),
    [setPage, totalPages]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={safeAreaEdges}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* =========================
            Filters
        ========================= */}
        <Card style={styles.filterCard}>
          {/* 타입 */}
          <View style={styles.chipRow}>
            {myMeetingsTypeTabs.map(tab => (
              <SelectableChip
                key={tab.id}
                label={tab.label}
                selected={typeFilter === tab.id}
                onPress={handleTypeTabPress(tab.id)}
                styles={styles}
              />
            ))}
          </View>

          {/* 날짜 */}
          {/* 시작일 */}
          <Text style={styles.dateText}>시작일</Text>
          <Pressable style={styles.dateInput} onPress={(ev) => openStartPicker(ev)}>

            <Text style={{ fontSize: tokens.font.sm, color: startDate ? colors.neutral[800] : colors.neutral[400] }}>
              {startDate || 'YYYY-MM-DD'}
            </Text>
          </Pressable>

          {/* 종료일 */}
          <Text style={styles.dateText}>종료일</Text>
          <Pressable style={styles.dateInput} onPress={(ev) => openEndPicker(ev)}>
            <Text style={{ fontSize: tokens.font.sm, color: endDate ? colors.neutral[800] : colors.neutral[400] }}>
              {endDate || 'YYYY-MM-DD'}
            </Text>
          </Pressable>

          {Platform.OS === 'ios' && showStartPicker && (
            <DateTimePicker
              value={fromYmd(startDate)}
              mode="date"
              onChange={handleStartPickerChange}
            />
          )}

          {Platform.OS === 'ios' && showEndPicker && (
            <DateTimePicker
              value={fromYmd(endDate)}
              mode="date"
              onChange={handleEndPickerChange}
            />
          )}

          {hasActiveFilters && (
            <Pressable style={styles.resetButton} onPress={resetFilters}>
              <Text style={styles.resetButtonText}>필터 초기화</Text>
            </Pressable>
          )}
        </Card>

        {/* =========================
            States
        ========================= */}
        {loading && (
          <View style={styles.stateRow}>
            <ActivityIndicator size="small" color={colors.primary[600]} />
            <Text style={styles.stateText}>모임을 불러오는 중...</Text>
          </View>
        )}

        {!loading && error && (
          <Card>
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        )}

        {!loading && !error && filteredMeetings.length === 0 && (
          <Card style={styles.emptyCard}>
            <FontAwesome5
              name="golf-ball"
              size={28}
              color={colors.neutral[400]}
            />
            <Text style={styles.emptyTitle}>참가한 모임이 없습니다.</Text>
            <Text style={styles.emptySubtitle}>
              모임에 참가하면 여기에 표시됩니다.
            </Text>
          </Card>
        )}

        {/* =========================
            Meeting Cards
        ========================= */}
        {!loading && !error && filteredMeetings.map((meeting, index) => {
          const meetingType = meeting?.meeting_type || 'ROUND';
          const type = myMeetingsTypeConfig[meetingType];
          const statusKey = getMeetingStatusKey(meeting);
          const status = myMeetingsStatusConfig[statusKey];
          const meetingId = meeting?.id;
          const slug = meetingType === 'ROUND' ? 'rounding' : 'social';

          return (
            <View key={meetingId || index} style={styles.meetingCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {meeting?.name || meeting?.meeting_name || meeting?.title || '모임명 없음'}
                </Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { backgroundColor: type.bg }]}>
                    <Text style={[styles.badgeText, { color: type.color }]}>
                      {type.label}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.badgeText, { color: status.color }]}>
                      {status.label}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.cardSubtitle}>
                {meeting?.club_name || '-'}
              </Text>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <FontAwesome5 name="calendar-alt" size={12} color={colors.neutral[500]} />
                  <Text style={styles.metaText}>
                    {formatMeetingTimeShort(meeting?.meeting_time)}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <FontAwesome5 name="map-marker-alt" size={12} color={colors.neutral[500]} />
                  <Text style={styles.metaText}>
                    {meeting?.location || '-'}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <FontAwesome5 name="users" size={12} color={colors.neutral[500]} />
                  <Text style={styles.metaText}>
                    {meeting?.participant_count ?? 0}명 참여
                  </Text>
                </View>
              </View>

              <View style={styles.detailButtonRow}>
                <Button
                  style={styles.detailButton}
                  onPress={handleMeetingDetail(meetingId, slug)}
                >
                  <Text style={styles.detailButtonText}>상세 보기</Text>
                </Button>
              </View>
            </View>
          );
        })}

        {/* =========================
            Pagination
        ========================= */}
        {totalPages > 1 && (
          <PaginationNav
            mode="simple"
            currentPage={page}
            totalPages={totalPages}
            onPrev={handlePrevPage}
            onNext={handleNextPage}
            styles={styles}
            styleKeys={{
              container: 'paginationRow',
              navButton: 'pageButton',
              navButtonDisabled: 'pageButtonDisabled',
              navText: 'pageButtonText',
              summaryText: 'paginationText',
            }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: base.tabScreenSafeArea,
  container: base.container,
  filterCard: {
    marginBottom: tokens.spacing.md,
  },
  chipRow: { ...base.chipRow, marginBottom: tokens.spacing.sm2 },
  chip: {
    ...base.chipBase,
    backgroundColor: colors.neutral[100],
    paddingVertical: tokens.padding.xs,
  },
  chipActive: base.chipBaseActive,
  chipText: base.chipBaseText,
  chipTextActive: base.chipBaseTextActive,
  dateInput: {
    ...base.formInput,
    flex: 1,
    justifyContent: 'center',
  },
  dateText: {
    fontSize: tokens.font.sm,
    color: colors.neutral[700],
  },

  resetButton: {
    marginTop: tokens.spacing.xxs,
    alignSelf: 'flex-start',
    paddingHorizontal: tokens.padding.sm,
    paddingVertical: tokens.padding.xs,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    backgroundColor: colors.white,
  },
  resetButtonText: {
    fontSize: tokens.font.sm,
    color: colors.neutral[700],
    fontWeight: tokens.fontWeight.semibold,
  },

  stateRow: base.stateInlineRow,
  stateText: base.textSmMuted,
  errorText: base.textSmError,

  emptyCard: {
    alignItems: 'center',
    paddingVertical: tokens.padding.xxl,
    gap: 8,
  },
  emptyTitle: {
    fontSize: tokens.font.base,
    fontWeight: tokens.fontWeight.bold,
    color: colors.neutral[800],
    marginTop: tokens.spacing.xs,
  },
  emptySubtitle: {
    fontSize: tokens.font.sm,
    color: colors.neutral[500],
  },

  meetingCard: {
    ...base.tabCard,
    marginBottom: tokens.spacing.sm2,
  },
  cardHeader: base.rowBetween,
  cardTitle: {
    ...base.cardTitle,
    flex: 1,
    marginRight: tokens.spacing.xs2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: { ...base.badgeBase, borderRadius: tokens.radius.md },
  badgeText: base.badgeBaseText,

  cardSubtitle: {
    fontSize: tokens.font.sm,
    color: colors.neutral[500],
    marginTop: tokens.spacing.xs,
  },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: tokens.spacing.xs2,
  },
  metaItem: base.tabCardMetaItem,
  metaText: {
    fontSize: tokens.font.xs,
    color: colors.neutral[600],
  },

  detailButtonRow: {
    ...base.tabCardFooterLine,
  },
  detailButton: {
    ...base.tabCardActionButton,
    backgroundColor: colors.primary[600],
  },
  detailButtonText: {
    fontSize: tokens.font.sm,
    fontWeight: tokens.fontWeight.semibold,
    color: colors.white,
  },

  paginationRow: { ...base.paginationRow, gap: 12 },
  pageButton: base.paginationNavButtonBordered,
  pageButtonDisabled: base.paginationNavButtonDisabled,
  pageButtonText: base.paginationNavText,
  paginationText: base.paginationSummaryText,
});
