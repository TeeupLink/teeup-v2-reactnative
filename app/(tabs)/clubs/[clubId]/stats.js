import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Card from '@/components/ui/Card';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { clubsApi } from '@/lib/api/api';
import { createFetchStatsHandler } from '@/lib/handler/clubs';
import { createDatePickerChangeHandler, openWebDateInput } from '@/lib/handler/mypage';
import { fromYmd, toYmd } from '@/lib/util/mypageUtils';
import { extractData } from '@/lib/util/responseUtils';
import { colors } from '@/styles/colors';
import { base, tokens } from '@/styles/style';

const PERIOD_OPTIONS = [
  { id: 'daily', label: '일별' },
  { id: 'weekly', label: '주별' },
  { id: 'monthly', label: '월별' },
];

function getWeekRange(dateStr) {
  const d = fromYmd(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toYmd(monday), end: toYmd(sunday) };
}

function getMonthRange(dateStr) {
  const d = fromYmd(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m + 1, 0);
  const end = toYmd(lastDay);
  return { start, end };
}

export default function ClubStatsScreen() {
  const { clubId } = useLocalSearchParams();
  const resolvedId = Array.isArray(clubId) ? clubId[0] : clubId;
  const [statsData, setStatsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('monthly');
  const [pickDate, setPickDate] = useState(''); // 일별/주별/월별 날짜 선택
  const [showPickPicker, setShowPickPicker] = useState(false);

  const clubCreatedAt = statsData?.club_created_at || '';
  const minDate = clubCreatedAt || '2020-01-01';

  const params = useMemo(() => {
    if (period === 'daily') {
      if (pickDate) {
        return { period, start_date: pickDate, end_date: pickDate };
      }
    } else if (period === 'weekly') {
      if (pickDate) {
        const { start, end } = getWeekRange(pickDate);
        return { period, start_date: start, end_date: end };
      }
    } else if (period === 'monthly') {
      if (pickDate) {
        const { start, end } = getMonthRange(pickDate);
        return { period, start_date: start, end_date: end };
      }
    }
    const days = period === 'daily' ? 30 : period === 'weekly' ? 90 : 365;
    return { period, days };
  }, [period, pickDate]);

  const loadStats = useMemo(
    () =>
      createFetchStatsHandler({
        clubId: resolvedId,
        fetchClubStats: clubsApi.getClubStats,
        extractData,
        setStatsData,
        setIsLoading,
        setError,
        params,
      }),
    [resolvedId, setStatsData, setIsLoading, setError, params]
  );

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    setPickDate((prev) => prev || toYmd(new Date()));
  }, [period]);

  // iOS 선택기는 인라인이라 스스로 사라지지 않는다. 예전에는 Android 에서만 닫아서
  // iOS 는 한 번 열면 화면에 계속 남았다. 공유 핸들러가 양쪽을 다 처리한다.
  const handlePickChange = useMemo(
    () => createDatePickerChangeHandler({
      setValue: setPickDate,
      toYmd,
      setShowPicker: setShowPickPicker,
    }),
    [],
  );

  const handleOpenDatePicker = (e) => {
    if (Platform.OS === 'web') {
      if (e) {
        e.preventDefault?.();
        e.stopPropagation?.();
      }
      const target = e?.nativeEvent?.target;
      const anchorRect =
        target && typeof target.getBoundingClientRect === 'function'
          ? target.getBoundingClientRect()
          : null;
      const didOpen = openWebDateInput({
        value: pickDate || toYmd(new Date()),
        min: minDate || undefined,
        anchorRect,
        onChange: (nextValue) => nextValue && setPickDate(nextValue),
      });
      if (!didOpen) console.warn('웹 날짜 선택기를 열 수 없습니다.');
      return;
    }
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: fromYmd(pickDate || toYmd(new Date())),
        mode: 'date',
        minDate: minDate ? fromYmd(minDate) : undefined,
        onChange: (ev, d) => {
          if (ev?.type !== 'dismissed' && d) setPickDate(toYmd(d));
        },
      });
      return;
    }
    setShowPickPicker(true);
  };

  const periodLabel = useMemo(() => {
    const p = PERIOD_OPTIONS.find((o) => o.id === period);
    return p?.label || '월별';
  }, [period]);

  const dateRangeLabel = useMemo(() => {
    if (period === 'daily' && pickDate) return pickDate;
    if (period === 'weekly' && pickDate) {
      const { start, end } = getWeekRange(pickDate);
      return `${start} ~ ${end}`;
    }
    if (period === 'monthly' && pickDate) {
      const { start } = getMonthRange(pickDate);
      return start.slice(0, 7);
    }
    return null;
  }, [period, pickDate]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="클럽 통계" />
      <ScrollView contentContainerStyle={styles.container}>
        {isLoading && !statsData ? (
          <Card style={styles.stateCard}>
            <View style={styles.stateRow}>
              <ActivityIndicator size="small" color={colors.primary[600]} />
              <Text style={styles.stateText}>통계를 불러오는 중...</Text>
            </View>
          </Card>
        ) : error ? (
          <Card style={styles.stateCard}>
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : (
          <>
            <View style={styles.periodRow}>
              <Text style={styles.periodLabel}>집계 단위</Text>
              <View style={styles.periodBtns}>
                {PERIOD_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.id}
                    style={[
                      styles.periodBtn,
                      period === opt.id && styles.periodBtnActive,
                    ]}
                    onPress={() => setPeriod(opt.id)}
                  >
                    <Text
                      style={[
                        styles.periodBtnText,
                        period === opt.id && styles.periodBtnTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {period === 'daily' && (
              <Card style={styles.dateCard}>
                <Text style={styles.dateLabel}>날짜 선택 (클럽 생성일: {clubCreatedAt || '-'})</Text>
                <Pressable style={styles.dateInput} onPress={handleOpenDatePicker}>
                  <Text style={[styles.dateText, !pickDate && styles.datePlaceholder]}>
                    {pickDate || '날짜 선택'}
                  </Text>
                </Pressable>
                {Platform.OS === 'ios' && showPickPicker && (
                  <DateTimePicker
                    value={fromYmd(pickDate || toYmd(new Date()))}
                    mode="date"
                    minimumDate={minDate ? fromYmd(minDate) : undefined}
                    onChange={handlePickChange}
                  />
                )}
              </Card>
            )}

            {period === 'weekly' && (
              <Card style={styles.dateCard}>
                <Text style={styles.dateLabel}>주 선택 (해당 주 월요일~일요일)</Text>
                <Pressable style={styles.dateInput} onPress={handleOpenDatePicker}>
                  <Text style={[styles.dateText, !pickDate && styles.datePlaceholder]}>
                    {pickDate || '날짜 선택'}
                  </Text>
                  {pickDate && (
                    <Text style={styles.dateHint}>
                      ({getWeekRange(pickDate).start} ~ {getWeekRange(pickDate).end})
                    </Text>
                  )}
                </Pressable>
                {Platform.OS === 'ios' && showPickPicker && (
                  <DateTimePicker
                    value={fromYmd(pickDate || toYmd(new Date()))}
                    mode="date"
                    minimumDate={minDate ? fromYmd(minDate) : undefined}
                    onChange={handlePickChange}
                  />
                )}
              </Card>
            )}

            {period === 'monthly' && (
              <Card style={styles.dateCard}>
                <Text style={styles.dateLabel}>월 선택</Text>
                <Pressable style={styles.dateInput} onPress={handleOpenDatePicker}>
                  <Text style={[styles.dateText, !pickDate && styles.datePlaceholder]}>
                    {pickDate ? pickDate.slice(0, 7) : '년월 선택'}
                  </Text>
                </Pressable>
                {Platform.OS === 'ios' && showPickPicker && (
                  <DateTimePicker
                    value={fromYmd(pickDate || toYmd(new Date()))}
                    mode="date"
                    minimumDate={minDate ? fromYmd(minDate) : undefined}
                    onChange={handlePickChange}
                  />
                )}
              </Card>
            )}

            {dateRangeLabel && (
              <Text style={styles.rangeLabel}>조회 기간: {dateRangeLabel}</Text>
            )}

            <View style={styles.grid}>
              <Card style={styles.statCard}>
                <Text style={styles.statLabel}>활성 멤버</Text>
                <Text style={styles.statValue}>{statsData?.active_members ?? 0}</Text>
              </Card>
              <Card style={styles.statCard}>
                <Text style={styles.statLabel}>총 모임</Text>
                <Text style={styles.statValue}>{statsData?.total_meetings ?? 0}</Text>
              </Card>
            </View>

            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>가입 수 ({periodLabel})</Text>
              <Text style={styles.sectionTotal}>
                기간 내 총 {statsData?.total_memberships ?? 0}명 가입
              </Text>
              <StatList items={statsData?.memberships ?? []} />
            </Card>

            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>라운딩 수 ({periodLabel})</Text>
              <Text style={styles.sectionTotal}>
                기간 내 총 {statsData?.total_roundings ?? 0}건
              </Text>
              <StatList items={statsData?.roundings ?? []} />
            </Card>

            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>소셜 수 ({periodLabel})</Text>
              <Text style={styles.sectionTotal}>
                기간 내 총 {statsData?.total_socials ?? 0}건
              </Text>
              <StatList items={statsData?.socials ?? []} />
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatList({ items }) {
  if (!items || items.length === 0) {
    return (
      <View style={styles.emptyList}>
        <Text style={styles.emptyText}>데이터 없음</Text>
      </View>
    );
  }
  return (
    <View style={styles.statList}>
      {items.slice(0, 15).map((item, idx) => (
        <View key={item.label || idx} style={styles.statRow}>
          <Text style={styles.statRowLabel}>{item.label}</Text>
          <Text style={styles.statRowValue}>{item.count}</Text>
        </View>
      ))}
      {items.length > 15 && (
        <Text style={styles.moreText}>... 외 {items.length - 15}건</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: base.safeAreaNeutral,
  container: base.containerLg,
  periodRow: { marginBottom: tokens.spacing.md },
  periodLabel: {
    fontSize: tokens.font.sm,
    color: colors.neutral[600],
    marginBottom: tokens.spacing.xs,
  },
  periodBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs2 },
  periodBtn: {
    paddingVertical: tokens.padding.xs,
    paddingHorizontal: tokens.padding.sm,
    borderRadius: tokens.radius.base,
    borderWidth: 1,
    borderColor: colors.neutral[300],
  },
  periodBtnActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  periodBtnText: { fontSize: tokens.font.sm, color: colors.neutral[700] },
  periodBtnTextActive: { color: colors.white, fontWeight: tokens.fontWeight.semibold },
  dateCard: { marginBottom: tokens.spacing.md },
  dateLabel: {
    fontSize: tokens.font.sm,
    color: colors.neutral[600],
    marginBottom: tokens.spacing.xs,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: tokens.radius.base,
    paddingVertical: tokens.padding.base,
    paddingHorizontal: tokens.padding.sm,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  dateText: { fontSize: tokens.font.sm, color: colors.neutral[800] },
  datePlaceholder: { color: colors.neutral[400] },
  dateHint: { fontSize: tokens.font.xs, color: colors.neutral[500], marginTop: 2 },
  dateSep: { fontSize: tokens.font.sm, color: colors.neutral[500] },
  rangeLabel: {
    fontSize: tokens.font.sm,
    color: colors.neutral[600],
    marginBottom: tokens.spacing.sm2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.md,
  },
  statCard: { width: '48%', marginBottom: tokens.spacing.sm2 },
  statLabel: {
    fontSize: tokens.font.sm,
    color: colors.neutral[600],
    marginBottom: tokens.spacing.xs,
  },
  statValue: {
    fontSize: tokens.font.xl,
    fontWeight: tokens.fontWeight.bold,
    color: colors.neutral[900],
  },
  sectionCard: { marginBottom: tokens.spacing.md },
  sectionTitle: {
    fontSize: tokens.font.base,
    fontWeight: tokens.fontWeight.semibold,
    color: colors.neutral[900],
    marginBottom: tokens.spacing.xs,
  },
  sectionTotal: {
    fontSize: tokens.font.sm,
    color: colors.neutral[500],
    marginBottom: tokens.spacing.sm2,
  },
  statList: { borderTopWidth: 1, borderTopColor: colors.neutral[100] },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tokens.padding.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[50],
  },
  statRowLabel: { fontSize: tokens.font.sm, color: colors.neutral[700] },
  statRowValue: {
    fontSize: tokens.font.base,
    fontWeight: tokens.fontWeight.semibold,
    color: colors.neutral[900],
  },
  emptyList: { paddingVertical: tokens.padding.md },
  emptyText: { fontSize: tokens.font.sm, color: colors.neutral[500] },
  moreText: {
    fontSize: tokens.font.xs,
    color: colors.neutral[500],
    paddingVertical: tokens.padding.xs,
    textAlign: 'center',
  },
  stateCard: { marginBottom: tokens.spacing.sm2 },
  stateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stateText: { marginLeft: tokens.spacing.xs2, fontSize: tokens.font.sm, color: colors.neutral[500] },
  errorText: base.textSmError,
});
