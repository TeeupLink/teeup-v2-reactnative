import { FontAwesome5 } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView, StyleSheet, Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppToast from '@/components/ui/AppToast';
import Card from '@/components/ui/Card';
import { mypageApi } from '@/lib/api/api';
import {
  createBirthPickerChangeHandler,
  createCheckNicknameDuplicateHandler,
  createCompositionEndHandler,
  createCompositionStartHandler,
  createConditionalFieldChangeHandler,
  createInputChangeHandler,
  createSaveProfileHandler,
  createValidateProfileFormHandler,
  openWebDateInput,
} from '@/lib/handler/mypage';
import { navigateWithCap } from '@/lib/navigation/cappedHistory';
import {
  calcHandicapFromAvg,
  formatDateYYYYMMDD,
  getAverageScoreInitError,
  getBirthDateValue,
  isNicknameSame as isNicknameSameValue
} from '@/lib/util/mypageUtils';
import { extractData } from '@/lib/util/responseUtils';
import { colors } from '@/styles/colors';
import { base, tokens } from '@/styles/style';





/* ===========================
   Component
=========================== */
export default function UserProfileEditForm({ onMoveToWithdraw }) {
  const { profile_required: profileRequiredParam } = useLocalSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const safeAreaEdges = pathname === '/mypage/edit' && Platform.OS !== 'web' ? ['top'] : [];
  const [isNameComposing, setIsNameComposing] = useState(false);
  const [showBirthPicker, setShowBirthPicker] = useState(false);
  const maxBirthDate = useMemo(() => new Date(), []);
  const [profile, setProfile] = useState({
    id: null,
    email: '',
    nickname: '',
    realname: '',
    phone_number: '',
    birthdate: '',
    gender: '',
    average_score: null,
    average_score_init: null,
    handicap: null,
    handicap_init: null,
  });
  const [formData, setFormData] = useState({
    nickname: '',
    realname: '',
    phone_number: '',
    birthdate: '',
    gender: '',
    average_score_init: '',
    handicap_init: '',
    calculatedHandicap: null, // 프론트 계산용
  });

  const [errors, setErrors] = useState({});
  const [, setLoading] = useState(true);
  const [, setHandicapInfo] = useState(null);
  const [, setHandicapLoading] = useState(false);
  const [isCheckingNickname, setIsCheckingNickname] = useState(false);
  const [nicknameChecked, setNicknameChecked] = useState(false);
  const [nicknameMessage, setNicknameMessage] = useState('');
  const [updateProfilePending, setUpdateProfilePending] = useState(false);
  const [toast, setToast] = useState({ open: false, tone: 'success', message: '' });
  const initialFormRef = useRef(null);

  const hasFinalAverageScore = useMemo(() => { return profile?.average_score != null; }, [profile]);
  const initialAverageScoreInit = useMemo(() => {
    if (hasFinalAverageScore) return '';
    if (profile?.average_score_init == null) return '';
    return String(profile.average_score_init);
  }, [hasFinalAverageScore, profile?.average_score_init]);
  const isAverageScoreInitChanged = useMemo(() => {
    return String(formData.average_score_init ?? '') !== initialAverageScoreInit;
  }, [formData.average_score_init, initialAverageScoreInit]);
  const averageScoreInitValidationError = useMemo(() => {
    if (hasFinalAverageScore || !isAverageScoreInitChanged) return '';
    return getAverageScoreInitError(formData.average_score_init);
  }, [formData.average_score_init, hasFinalAverageScore, isAverageScoreInitChanged]);
  const averageScoreInitErrorMessage = errors.average_score_init || averageScoreInitValidationError;

  const hasFormChanges = useMemo(() => {
    const initial = initialFormRef.current;
    if (!initial) return false;
    return (
      String(formData.nickname ?? '') !== String(initial.nickname ?? '') ||
      String(formData.realname ?? '') !== String(initial.realname ?? '') ||
      String(formData.phone_number ?? '') !== String(initial.phone_number ?? '') ||
      String(formData.birthdate ?? '') !== String(initial.birthdate ?? '') ||
      String(formData.gender ?? '') !== String(initial.gender ?? '') ||
      String(formData.average_score_init ?? '') !== String(initial.average_score_init ?? '') ||
      String(formData.handicap_init ?? '') !== String(initial.handicap_init ?? '')
    );
  }, [formData.nickname, formData.realname, formData.phone_number, formData.birthdate, formData.gender, formData.average_score_init, formData.handicap_init]);

  const isSaveDisabled = !hasFormChanges || updateProfilePending || (!hasFinalAverageScore && Boolean(averageScoreInitErrorMessage));


  const birthDateValue = useMemo(() => {
    return getBirthDateValue(formData.birthdate, maxBirthDate);
  }, [formData.birthdate, maxBirthDate]);

  const isNicknameSame = useMemo(() => {
    return isNicknameSameValue(profile?.nickname, formData.nickname);
  }, [formData.nickname, profile?.nickname]);
  const isProfileRequiredFlow = profileRequiredParam === '1';

  const selectedGender = profile.gender ?? formData.gender;

  const handleMoveToWithdraw = useCallback(() => {
    if (typeof onMoveToWithdraw === 'function') {
      onMoveToWithdraw();
      return;
    }
    navigateWithCap(router, '/mypage/withdraw');
  }, [onMoveToWithdraw, router]);

  useEffect(() => {
    if (isNicknameSame) {
      setNicknameChecked(true);
      setErrors((prev) => ({ ...prev, nickname: '' }));
    }
  }, [isNicknameSame]);

  const showToast = useCallback((tone, message) => {
    setToast({ open: true, tone, message });
  }, []);

  const handleCompositionStart = useMemo(
    () => createCompositionStartHandler(setIsNameComposing),
    [setIsNameComposing],
  );

  const handleInputChange = useMemo(
    () => createInputChangeHandler({
      setFormData,
      setErrors,
      setNicknameChecked,
      setNicknameMessage,
      calcHandicapFromAvg,
    }),
    [setFormData, setErrors, setNicknameChecked, setNicknameMessage],
  );

  const openBirthPicker = useMemo(() => {
    if (Platform.OS === 'web') {
      return (e) => {
        // 이벤트 전파 방지
        if (e) {
          e.preventDefault?.();
          e.stopPropagation?.();
        }

        const currentValue = formData.birthdate || '';
        const target = e?.nativeEvent?.target;
        const anchorRect = target && typeof target.getBoundingClientRect === 'function' ? target.getBoundingClientRect() : null;
        const didOpen = openWebDateInput({
          value: currentValue,
          anchorRect,
          onChange: (nextValue) => {
            if (nextValue) {
              handleInputChange('birthdate', nextValue);
            }
          },
        });
        if (!didOpen) {
          console.warn('웹 날짜 선택기를 열 수 없습니다.');
        }
      };
    }
    return () => {
      setShowBirthPicker(true);
    };
  }, [setShowBirthPicker, formData.birthdate, handleInputChange]);

  const handleBirthPickerChange = useMemo(
    () => createBirthPickerChangeHandler({ setShowBirthPicker, handleInputChange }),
    [handleInputChange, setShowBirthPicker],
  );

  const handleCompositionEnd = useMemo(
    () => createCompositionEndHandler({
      setIsNameComposing,
      handleInputChange,
      fallbackValue: formData.realname,
    }),
    [formData.realname, handleInputChange, setIsNameComposing],
  );

  const handleNicknameChange = useCallback((value) => {
    handleInputChange('nickname', value);
  }, [handleInputChange]);

  const handleRealnameChange = useMemo(
    () => createConditionalFieldChangeHandler({
      handleInputChange,
      field: 'realname',
      shouldBlock: () => isNameComposing,
    }),
    [handleInputChange, isNameComposing],
  );

  const handlePhoneChange = useCallback((value) => {
    handleInputChange('phone_number', value);
  }, [handleInputChange]);

  const handleAverageScoreInitChange = useCallback((value) => {
    if (!/^\d*$/.test(value)) {
      setErrors((prev) => ({
        ...prev,
        average_score_init: '초기 평균 타수는 숫자만 입력 가능합니다.',
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      average_score_init: value,
      calculatedHandicap: calcHandicapFromAvg(value),
    }));
    const shouldValidate = value !== initialAverageScoreInit;
    setErrors((prev) => ({
      ...prev,
      average_score_init: shouldValidate ? getAverageScoreInitError(value) : '',
    }));
  }, [initialAverageScoreInit, setErrors, setFormData]);

  const checkNicknameDuplicate = useMemo(
    () => createCheckNicknameDuplicateHandler({
      nickname: formData.nickname,
      isNicknameSame,
      setErrors,
      setIsCheckingNickname,
      setNicknameChecked,
      setNicknameMessage,
      checkNicknameAvailability: mypageApi.checkNicknameAvailability,
    }),
    [
      formData.nickname,
      isNicknameSame,
      setErrors,
      setIsCheckingNickname,
      setNicknameChecked,
      setNicknameMessage,
    ],
  );

  const validateForm = useMemo(
    () => createValidateProfileFormHandler({
      formData,
      isNicknameSame,
      nicknameChecked,
      hasFinalAverageScore,
      shouldValidateAverageScoreInit: isAverageScoreInitChanged,
      setErrors,
    }),
    [formData, isNicknameSame, nicknameChecked, hasFinalAverageScore, isAverageScoreInitChanged, setErrors],
  );

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const response = await mypageApi.fetchMyProfile();
      const user = extractData(response);
      setProfile(user || {});
      const nextForm = {
        nickname: user?.nickname ?? '',
        realname: user?.realname ?? '',
        phone_number: user?.phone_number ?? '',
        birthdate: user?.birthdate ? formatDateYYYYMMDD(user.birthdate) : '',
        gender: user?.gender ?? '',
        average_score_init: user?.average_score == null ? String(user?.average_score_init ?? '') : '',
        handicap_init: user?.handicap == null ? String(user?.handicap_init ?? '') : '',
      };
      initialFormRef.current = { ...nextForm };
      setFormData(prev => ({
        ...prev,
        ...nextForm,
        calculatedHandicap: null,
      }));
      setNicknameChecked(Boolean(user?.nickname));
      setNicknameMessage('');
      if (user?.id) {
        setHandicapLoading(true);
        try {
          const handicapResponse = await mypageApi.fetchUserHandicap(user.id);
          setHandicapInfo(extractData(handicapResponse));
        } catch (handicapError) {
          console.error('핸디캡 조회 실패:', handicapError);
          setHandicapInfo(null);
        } finally {
          setHandicapLoading(false);
        }
      } else {
        setHandicapInfo(null);
        setHandicapLoading(false);
      }
    } catch (fetchError) {
      console.error('프로필 조회 실패:', fetchError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = useMemo(
    () => createSaveProfileHandler({
      formData,
      profile,
      validateForm,
      updateMyProfile: mypageApi.updateMyProfile,
      showToast,
      setNicknameChecked,
      fetchProfile,
      setUpdateProfilePending,
    }),
    [
      fetchProfile,
      formData,
      profile,
      setNicknameChecked,
      setUpdateProfilePending,
      showToast,
      validateForm,
    ],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={safeAreaEdges}>
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* 카드 */}
          <Card>
            <Text style={styles.cardTitle}>회원정보 수정</Text>

          <View style={styles.stackLg}>
            {/* 이메일 */}
            <View>
              <Text style={styles.label}>
                아이디(이메일)
              </Text>

              <View style={styles.readonlyBox}>
                <Text style={styles.readonlyText}>
                  {profile.email || '-'}
                </Text>
              </View>

              <Text style={styles.helperText}>
                이메일은 수정할 수 없습니다.
              </Text>
            </View>

            {/* 닉네임 */}
            <View>
              <Text style={styles.label}>
                닉네임 <Text style={styles.required}>*</Text>
              </Text>

              <View style={styles.rowGap}>
                <TextInput
                  value={formData.nickname}
                  onChangeText={handleNicknameChange}
                  placeholder="닉네임을 입력하세요"
                  placeholderTextColor={colors.gray[400]}
                  style={[
                    styles.input,
                    errors.nickname
                      ? styles.inputError
                      : styles.inputNormal,
                  ]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Pressable
                  onPress={checkNicknameDuplicate}
                  disabled={
                    isCheckingNickname ||
                    !formData.nickname ||
                    isNicknameSame
                  }
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    (isCheckingNickname ||
                      !formData.nickname ||
                      isNicknameSame) &&
                    styles.btnDisabled,
                    pressed &&
                    !(isCheckingNickname ||
                      !formData.nickname ||
                      isNicknameSame) &&
                    styles.btnPressed,
                  ]}
                >
                  <Text style={styles.primaryBtnText}>
                    {isCheckingNickname ? '확인 중...' : '중복확인'}
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.helperText}>
                닉네임은 영문, 한글, 숫자만 입력 가능합니다.(공백 불가)
              </Text>

              {!!errors.nickname && (
                <Text style={styles.errorText}>
                  {errors.nickname}
                </Text>
              )}
              {!!nicknameMessage && !errors.nickname && (
                <Text style={styles.successText}>
                  {nicknameMessage}
                </Text>
              )}
            </View>

            {/* 실명 */}
            <View>
              <Text style={styles.label}>
                실명 <Text style={styles.required}>*</Text>
              </Text>

              <TextInput
                value={formData.realname}
                onChangeText={handleRealnameChange}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                placeholder="실명을 입력하세요"
                placeholderTextColor={colors.gray[400]}
                style={[
                  styles.input,
                  errors.realname
                    ? styles.inputError
                    : styles.inputNormal,
                ]}
              />

              {!!errors.realname && (
                <Text style={styles.errorText}>
                  {errors.realname}
                </Text>
              )}
            </View>

            {/* 전화번호 */}
            <View>
              <Text style={styles.label}>
                전화번호 <Text style={styles.required}>*</Text>
              </Text>

              <TextInput
                value={formData.phone_number}
                onChangeText={handlePhoneChange}
                placeholder="전화번호를 입력하세요"
                placeholderTextColor={colors.gray[400]}
                style={[
                  styles.input,
                  errors.phone_number
                    ? styles.inputError
                    : styles.inputNormal,
                ]}
                keyboardType={
                  Platform.OS === 'ios' ? 'number-pad' : 'numeric'
                }
                inputMode="numeric"
              />

              {!!errors.phone_number && (
                <Text style={styles.errorText}>
                  {errors.phone_number}
                </Text>
              )}
            </View>

            {/* 생년월일 */}
            <View>
              <Text style={styles.label}>
                생년월일 <Text style={styles.optional}>(선택)</Text>
              </Text>

              {Platform.OS === 'web' ? (
                <Pressable
                  onPress={openBirthPicker}
                  style={({ pressed }) => [
                    styles.input,
                    styles.dateInputRow,
                    errors.birthdate
                      ? styles.inputError
                      : styles.inputNormal,
                    pressed && styles.inputPressed,
                  ]}
                >
                  <Text style={styles.inputLikeText} numberOfLines={1}>
                    {formData.birthdate || '날짜를 선택하세요'}
                  </Text>
                  <FontAwesome5 name="calendar-alt" size={16} color={colors.neutral[500]} style={styles.dateInputIcon} />
                </Pressable>
              ) : (
                <>
                  <Pressable
                    onPress={openBirthPicker}
                    style={({ pressed }) => [
                      styles.inputLike,
                      styles.dateInputRow,
                      errors.birthdate
                        ? styles.inputError
                        : styles.inputNormal,
                      pressed && styles.inputPressed,
                    ]}
                  >
                    <Text style={styles.inputLikeText} numberOfLines={1}>
                      {formData.birthdate || '날짜를 선택하세요'}
                    </Text>
                    <FontAwesome5 name="calendar-alt" size={16} color={colors.neutral[500]} style={styles.dateInputIcon} />
                  </Pressable>

                  {showBirthPicker && (
                    <DateTimePicker
                      value={birthDateValue}
                      mode="date"
                      maximumDate={maxBirthDate}
                      display={
                        Platform.OS === 'ios'
                          ? 'spinner'
                          : 'default'
                      }
                      onChange={handleBirthPickerChange}
                    />
                  )}
                </>
              )}

              {!!errors.birthdate && (
                <Text style={styles.errorText}>
                  {errors.birthdate}
                </Text>
              )}
            </View>
            <View>
              <View style={styles.genderSelectRow}>
                {/* 남성 */}
                <Pressable
                  disabled={!!profile.gender}
                  onPress={() => setFormData({ ...formData, gender: 'MALE' })}
                  style={({ pressed }) => [
                    styles.genderBtnBase,
                    selectedGender === 'MALE'
                      ? styles.genderBtnSelected
                      : styles.genderBtnOutline,
                    pressed && !profile.gender && styles.btnPressed,
                    profile.gender && styles.btnDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.genderBtnTextBase,
                      selectedGender === 'MALE'
                        ? styles.genderBtnTextSelected
                        : styles.genderBtnTextOutline,
                    ]}
                  >
                    남성
                  </Text>
                </Pressable>

                {/* 여성 */}
                <Pressable
                  disabled={!!profile.gender}
                  onPress={() => setFormData({ ...formData, gender: 'FEMALE' })}
                  style={({ pressed }) => [
                    styles.genderBtnBase,
                    selectedGender === 'FEMALE'
                      ? styles.genderBtnSelected
                      : styles.genderBtnOutline,
                    pressed && !profile.gender && styles.btnPressed,
                    profile.gender && styles.btnDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.genderBtnTextBase,
                      selectedGender === 'FEMALE'
                        ? styles.genderBtnTextSelected
                        : styles.genderBtnTextOutline,
                    ]}
                  >
                    여성
                  </Text>
                </Pressable>
              </View>

              {profile.gender && (
                <Text style={styles.helperText}>
                  성별은 수정할 수 없습니다.
                </Text>
              )}

            </View>
            {hasFinalAverageScore ? (
              <View>
                <Text style={styles.label}>
                  평균 타수
                </Text>

                <View style={styles.readonlyBox}>
                  <Text style={styles.readonlyText}>
                    {profile.average_score}타
                  </Text>
                </View>

                <Text style={styles.helperText}>
                  경기 기록을 기반으로 계산된 평균 타수입니다.
                </Text>
              </View>
            ) : (
              <View>
                <Text style={styles.label}>
                  초기 평균 타수 <Text style={styles.required}>*</Text>
                </Text>

                <TextInput
                  value={formData.average_score_init}
                  onChangeText={handleAverageScoreInitChange}
                  placeholder="초기 평균 타수를 입력하세요 (55-144)"
                  placeholderTextColor={colors.gray[400]}
                  style={[
                    styles.input,
                    averageScoreInitErrorMessage
                      ? styles.inputError
                      : styles.inputNormal,
                  ]}
                  keyboardType="numeric"
                  inputMode="numeric"
                />

                {!!formData.calculatedHandicap && (
                  <View style={styles.infoBox}>
                    <Text style={styles.infoTitle}>
                      예상 핸디캡: {formData.calculatedHandicap}
                    </Text>
                    <Text style={styles.infoSub}>
                      평균 타수 {formData.average_score_init}타 → 핸디캡{' '}
                      {formData.calculatedHandicap}
                    </Text>
                  </View>
                )}

                {!!averageScoreInitErrorMessage && (
                  <Text style={styles.errorText}>
                    {averageScoreInitErrorMessage}
                  </Text>
                )}
              </View>
            )}

          </View>

          {/* 저장 */}
          <View style={styles.footer}>
            {!isProfileRequiredFlow && (
              <View style={styles.footerLeftGroup}>
                <Pressable
                  onPress={() => navigateWithCap(router, '/mypage/blocked')}
                  style={({ pressed }) => [
                    styles.blockedMoveBtn,
                    pressed && styles.btnPressed,
                  ]}
                >
                  <Text style={styles.blockedMoveBtnText}>차단 관리</Text>
                </Pressable>
                <Pressable
                  onPress={handleMoveToWithdraw}
                  style={({ pressed }) => [
                    styles.withdrawMoveBtn,
                    pressed && styles.btnPressed,
                  ]}
                >
                  <Text style={styles.withdrawMoveBtnText}>회원탈퇴</Text>
                </Pressable>
              </View>
            )}
            <Pressable
              onPress={handleSave}
              disabled={isSaveDisabled}
              style={({ pressed }) => [
                styles.saveBtn,
                isSaveDisabled && styles.saveBtnDisabled,
                pressed &&
                !isSaveDisabled &&
                styles.btnPressed,
              ]}
            >
              <FontAwesome5 name="save" size={14} color={colors.white} />
              <Text style={styles.saveBtnText}>
                {updateProfilePending ? '저장 중...' : '저장'}
              </Text>
            </Pressable>
          </View>
          </Card>

        </ScrollView>

        <AppToast
          toast={toast?.open ? { tone: toast.tone, message: toast.message } : null}
          autoHideMs={2200}
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        />
      </View>
    </SafeAreaView>
  );
}

const PRIMARY_600 = colors.green[600];

const styles = StyleSheet.create({
  safeArea: base.tabScreenSafeArea,
  root: base.tabScreenSafeArea,
  container: base.container,
  cardTitle: { ...base.cardTitle, color: colors.text, marginBottom: tokens.spacing.md },

  stackLg: { gap: 18 },
  stackSm: { gap: 8 },
  rowGap: { flexDirection: 'row', gap: 8 },

  label: {
    fontSize: tokens.font.md,
    fontWeight: tokens.fontWeight.semibold,
    color: colors.textMuted,
    marginBottom: tokens.spacing.xs2,
  },
  labelIcon: { marginRight: tokens.spacing.xs2, color: colors.textMuted },
  required: { color: colors.red[500] },
  optional: { color: colors.gray[400], fontSize: 12 },

  input: {
    ...base.formInput,
    flex: 1,
  },
  inputLike: {
    paddingHorizontal: tokens.padding.sm,
    paddingVertical: tokens.padding.base,
    borderWidth: 1,
    borderRadius: tokens.radius.base,
    borderColor: colors.neutral[300],
    backgroundColor: colors.white,
  },
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateInputIcon: {
    marginLeft: tokens.spacing.xs,
  },
  inputLikeText: { fontSize: tokens.font.base, color: colors.neutral[900], flex: 1, marginRight: tokens.spacing.xs },
  inputPressed: { opacity: 0.9 },

  inputNormal: { borderColor: colors.neutral[300] },
  inputError: {
    borderColor: colors.red[300],
    backgroundColor: colors.red[50],
  },

  readonlyBox: {
    paddingHorizontal: tokens.padding.baseLg,
    paddingVertical: tokens.padding.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: tokens.radius.md,
  },
  readonlyText: { color: colors.textMuted, fontSize: tokens.font.lg },

  helperText: { marginTop: tokens.spacing.xs, fontSize: tokens.font.sm, color: colors.textSubtle },
  loadingText: base.textSmSubtle,

  errorText: {
    ...base.textSmError,
    marginTop: tokens.spacing.xs,
    color: colors.red[600],
    fontSize: tokens.font.md,
  },
  successText: {
    ...base.textSmSuccess,
    marginTop: tokens.spacing.xs,
    color: colors.green[600],
    fontSize: tokens.font.md,
  },

  primaryBtn: {
    paddingHorizontal: tokens.padding.sm,
    paddingVertical: tokens.padding.sm,
    borderRadius: tokens.radius.md,
    backgroundColor: PRIMARY_600,
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: tokens.font.sm,
    fontWeight: tokens.fontWeight.bold,
  },

  grayBtn: {
    paddingHorizontal: tokens.padding.sm,
    paddingVertical: tokens.padding.sm,
    borderRadius: tokens.radius.md,
    backgroundColor: colors.gray[100],
    alignSelf: 'flex-start',
  },
  grayBtnText: {
    color: colors.textMuted,
    fontWeight: tokens.fontWeight.bold,
    fontSize: tokens.font.sm,
  },

  btnDisabled: { opacity: 0.5 },
  btnPressed: { transform: [{ scale: 0.98 }] },

  infoBox: {
    marginTop: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: colors.green[200],
    backgroundColor: colors.green[50],
    padding: tokens.padding.sm,
  },
  infoTitle: { fontWeight: tokens.fontWeight.extrabold, color: colors.green[800] },
  infoSub: { fontSize: tokens.font.xs, color: colors.green[600], marginTop: tokens.spacing.xxs },

  autoBox: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: colors.green[200],
    backgroundColor: colors.green[50],
    padding: tokens.padding.sm,
  },
  autoTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  autoTitle: { fontWeight: tokens.fontWeight.extrabold, color: colors.green[900] },
  autoSub: { fontSize: tokens.font.xs, color: colors.green[700] },
  autoHint: { fontSize: tokens.font.xs, color: colors.green[600], marginTop: tokens.spacing.xxs },

  badge: {
    paddingHorizontal: tokens.padding.xs,
    paddingVertical: tokens.padding.micro,
    borderRadius: tokens.radius.pill,
    backgroundColor: PRIMARY_600,
  },
  badgeText: { color: colors.white, fontSize: tokens.font.xs, fontWeight: tokens.fontWeight.extrabold },

  footer: {
    marginTop: tokens.spacing.md3,
    paddingTop: tokens.padding.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: tokens.spacing.xs2,
  },
  footerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs2,
  },
  blockedMoveBtn: {
    paddingHorizontal: tokens.padding.md,
    paddingVertical: tokens.padding.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    backgroundColor: colors.white,
  },
  blockedMoveBtnText: {
    color: colors.neutral[700],
    fontWeight: tokens.fontWeight.bold,
    fontSize: tokens.font.sm,
  },
  withdrawMoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs2,
    paddingHorizontal: tokens.padding.md,
    paddingVertical: tokens.padding.sm,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: colors.error[300],
    backgroundColor: colors.error[50],
  },
  withdrawMoveBtnText: {
    color: colors.error[700],
    fontWeight: tokens.fontWeight.bold,
    fontSize: tokens.font.sm,
  },
  saveBtn: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: tokens.padding.md,
    paddingVertical: tokens.padding.sm,
    borderRadius: tokens.radius.md,
    backgroundColor: PRIMARY_600,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: colors.neutral[400],
    opacity: 0.75,
  },
  saveBtnText: { color: colors.white, fontWeight: tokens.fontWeight.extrabold, fontSize: tokens.font.sm },
  genderSelectRow: {
    flexDirection: 'row',
    gap: 12,
  },
  genderBtnMinWidth: {
    minWidth: 120,   // 원하는 최소 폭
    flex: 1,         // 좌우 균등 확장
  },
  genderBtnBase: {
    flex: 1,
    paddingVertical: tokens.padding.sm,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  genderBtnOutline: {
    backgroundColor: colors.white,
    borderColor: colors.inputBorder,
  },

  genderBtnSelected: {
    backgroundColor: PRIMARY_600,
    borderColor: PRIMARY_600,
  },

  genderBtnTextBase: {
    fontSize: tokens.font.md,
    fontWeight: tokens.fontWeight.bold,
  },

  genderBtnTextOutline: {
    color: colors.textMuted,
  },

  genderBtnTextSelected: {
    color: colors.white,
  },

});
