import { Platform } from 'react-native';

import { replaceWithPolicy } from '../navigation/cappedHistory';
import { formatDateYYYYMMDD, getChangePasswordScreenError, validateChangePasswordForm, validateProfileForm } from '../util/mypageUtils';

export function createPasswordFieldChangeHandler({
    setForm,
    setError,
    setSuccess,
    field,
}) {
    return (value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        setError('');
        setSuccess('');
    };
}

export function createSubmitChangePasswordHandler({
    form,
    isSubmitting,
    setError,
    setSuccess,
    setIsSubmitting,
    changePassword,
}) {
    return async function () {
        if (isSubmitting) return;

        setError('');
        setSuccess('');

        const errorMessage = getChangePasswordScreenError(form);
        if (errorMessage) {
            setError(errorMessage);
            return;
        }

        try {
            setIsSubmitting(true);
            const payload = {
                current_password: form.currentPassword,
                new_password: form.newPassword,
                confirm_password: form.confirmPassword,
            };
            await changePassword(payload);
            setSuccess('비밀번호가 변경되었습니다.');
        } catch (error) {
            setError(error?.message || '비밀번호 변경에 실패했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };
}

export function createResetPasswordModalHandler({
    setFormData,
    setValidationErrors,
    setError,
    setSuccess,
}) {
    return () => {
        setFormData({
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
        });
        setValidationErrors({});
        setError(null);
        setSuccess(false);
    };
}

export function createValidatePasswordModalHandler({
    formData,
    setValidationErrors,
}) {
    return () => {
        const errors = validateChangePasswordForm(formData);
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };
}

export function createSubmitPasswordModalHandler({
    formData,
    validateForm,
    changePassword,
    setLoading,
    setError,
    setSuccess,
    onClose,
    onLogout,
}) {
    return async function () {
        if (!validateForm()) return;

        try {
            setLoading(true);
            setError(null);

            await changePassword({
                current_password: formData.currentPassword,
                new_password: formData.newPassword,
                confirm_password: formData.confirmPassword,
            });

            setSuccess(true);

            setTimeout(() => {
                onClose();
                onLogout?.();
            }, 3000);
        } catch (error) {
            setError(error?.response?.data?.message || '비밀번호 변경에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };
}

export function createInputChangeHandler({
    setFormData,
    setErrors,
    setNicknameChecked,
    setNicknameMessage,
    calcHandicapFromAvg,
}) {
    return (field, value) => {
        setFormData((prev) => {
            const next = { ...prev, [field]: value };
            if (field === 'average_score') {
                next.calculatedHandicap = calcHandicapFromAvg(value);
            }
            return next;
        });
        setErrors((prev) => ({ ...prev, [field]: '' }));
        if (field === 'nickname') {
            setNicknameChecked(false);
            setNicknameMessage('');
        }
    };
}

export function createCheckNicknameDuplicateHandler({
    nickname,
    isNicknameSame,
    setErrors,
    setIsCheckingNickname,
    setNicknameChecked,
    setNicknameMessage,
    checkNicknameAvailability,
}) {
    return async function () {
        if (!nickname) {
            setErrors((prev) => ({ ...prev, nickname: '닉네임을 입력해주세요.' }));
            return;
        }

        if (nickname.length < 2 || nickname.length > 20) {
            setErrors((prev) => ({ ...prev, nickname: '닉네임은 2-20자여야 합니다.' }));
            setNicknameChecked(false);
            setNicknameMessage('');
            return;
        }

        if (!/^[a-zA-Z가-힣0-9]+$/.test(nickname)) {
            setErrors((prev) => ({ ...prev, nickname: '닉네임은 영문, 한글, 숫자만 사용 가능합니다.' }));
            setNicknameChecked(false);
            setNicknameMessage('');
            return;
        }

        if (isNicknameSame) {
            setNicknameChecked(true);
            setNicknameMessage('사용 가능한 닉네임입니다.');
            return;
        }

        try {
            setIsCheckingNickname(true);
            setErrors((prev) => ({ ...prev, nickname: '' }));
            const result = await checkNicknameAvailability(nickname.trim());
            if (result?.is_available && result?.is_valid) {
                setNicknameChecked(true);
                setNicknameMessage('사용 가능한 닉네임입니다.');
            } else {
                setNicknameChecked(false);
                setNicknameMessage('');
                setErrors((prev) => ({
                    ...prev,
                    nickname: result?.message || '이미 사용 중인 닉네임입니다.',
                }));
            }
        } catch (checkError) {
            setNicknameChecked(false);
            setNicknameMessage('');
            setErrors((prev) => ({
                ...prev,
                nickname: checkError?.message || '닉네임 확인에 실패했습니다.',
            }));
        } finally {
            setIsCheckingNickname(false);
        }
    };
}

export function createBirthPickerChangeHandler({ setShowBirthPicker, handleInputChange, setBirthDraft }) {
    return (event, selected) => {
        // iOS 스피너는 인라인으로 남아 있고 굴리는 동안 onChange 가 계속 온다.
        // 여기서 formData 를 바꾸면 value 가 다시 내려가 스피너가 제자리로 튕겨
        // 사실상 선택이 안 된다. 그래서 iOS 는 초안만 바꾸고, 값 확정과 닫기는
        // '확인' 버튼이 한다. (닫는 경로가 그 버튼뿐이므로 빼면 안 된다)
        if (Platform.OS === 'ios') {
            if (selected && typeof setBirthDraft === 'function') {
                setBirthDraft(selected);
            }
            return;
        }

        // Android 는 대화상자라서 한 번 뜨고 닫힌다. 취소('dismissed')든 선택이든 닫는다.
        setShowBirthPicker(false);
        if (event?.type === 'dismissed') return;
        if (selected) {
            handleInputChange('birthdate', formatDateYYYYMMDD(selected));
        }
    };
}

export function createValidateProfileFormHandler({
    formData,
    isNicknameSame,
    nicknameChecked,
    hasFinalAverageScore,
    shouldValidateAverageScoreInit,
    setErrors,
}) {
    return () => {
        const nextErrors = validateProfileForm({
            formData,
            isNicknameSameValue: isNicknameSame,
            nicknameChecked,
            hasFinalAverageScore,
            shouldValidateAverageScoreInit,
        });
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };
}

const toNumberOrNull = (v) => {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

export function createSaveProfileHandler({
    formData,
    profile,
    validateForm,
    updateMyProfile,
    showToast,
    setNicknameChecked,
    fetchProfile,
    setUpdateProfilePending,
}) {
    return async function () {
        if (!validateForm()) return;

        const hasFinalAverageScore = profile?.average_score != null;

        const payload = {
            nickname: formData.nickname,
            realname: formData.realname,
            phone_number: formData.phone_number,
            birthdate: formData.birthdate,
        };

        // 성별은 최초 설정 이후 수정 불가
        if (!profile?.gender && formData.gender) {
            payload.gender = formData.gender;
        }

        // average_score가 없으면 언제든 재전송 가능
        if (!hasFinalAverageScore) {
            payload.average_score_init = toNumberOrNull(
                formData.average_score_init,
            );
            payload.handicap_init = toNumberOrNull(
                formData.handicap_init,
            );
        }

        try {
            setUpdateProfilePending(true);
            await updateMyProfile(payload);

            showToast('success', '저장되었습니다.');
            setNicknameChecked(true);
            await fetchProfile();
        } catch (updateError) {
            console.error('회원정보 수정 실패:', updateError);
            showToast(
                'error',
                updateError?.message || '회원정보 수정에 실패했습니다.',
            );
        } finally {
            setUpdateProfilePending(false);
        }
    };
}


export function createCompositionStartHandler(setIsNameComposing) {
    return () => {
        setIsNameComposing(true);
    };
}

export function createCompositionEndHandler({ setIsNameComposing, handleInputChange, fallbackValue }) {
    return (event) => {
        setIsNameComposing(false);
        handleInputChange('realname', event?.nativeEvent?.text ?? fallbackValue);
    };
}

export function createConditionalFieldChangeHandler({
    handleInputChange,
    field,
    shouldBlock,
}) {
    return (value) => {
        if (shouldBlock()) return;
        handleInputChange(field, value);
    };
}
export function createTabPressHandler({ setActiveTab, router }) {
    return (tabId) =>
        () => {
            setActiveTab(tabId);
            router.setParams({ tab: tabId });
        };
}

export function getMyPageTabContent({ activeTab, tabs }) {
    switch (activeTab) {
        case 'overview':
            return tabs.overview;
        case 'meetings':
            return tabs.meetings;
        case 'records':
            return tabs.records;
        case 'notifications':
            return tabs.notifications;
        case 'edit':
            return tabs.edit;
        case 'withdraw':
            return tabs.withdraw;
        default:
            return tabs.overview;
    }
};
export function openWebDateInput({ value, onChange, anchorRect, min, max }) {
    const doc = globalThis?.document;
    if (!doc || typeof doc.createElement !== 'function') return false;

    // 기존 input이 있으면 제거
    const existingInput = doc.getElementById('web-date-input-temp');
    if (existingInput) {
        existingInput.remove();
    }

    const input = doc.createElement('input');
    input.id = 'web-date-input-temp';
    input.type = 'date';
    input.value = value || '';
    if (min) input.min = min;
    // 범위를 안 주면 미래 날짜나 만 14세 미만도 고를 수 있고, 저장할 때
    // 서버가 400 으로 거절해서 그때 처음 알게 된다.
    if (max) input.max = max;
    input.style.position = 'fixed';
    if (anchorRect && typeof anchorRect.left === 'number' && typeof anchorRect.top === 'number') {
        input.style.left = `${anchorRect.left}px`;
        input.style.top = `${anchorRect.top}px`;
        input.style.width = `${Math.max(1, anchorRect.width || 1)}px`;
        input.style.height = `${Math.max(1, anchorRect.height || 1)}px`;
    } else {
        input.style.top = '50%';
        input.style.left = '50%';
        input.style.transform = 'translate(-50%, -50%)';
        input.style.width = '1px';
        input.style.height = '1px';
    }
    input.style.opacity = '0';
    if (!anchorRect || typeof anchorRect.left !== 'number') {
        input.style.width = '1px';
        input.style.height = '1px';
    }
    input.style.zIndex = '99999';
    // 선택기는 showPicker() 로 띄우므로 이 input 이 클릭을 받을 필요가 없다.
    //
    // 예전에는 'auto' 였다. showPicker() 는 input 에 포커스를 주지 않아서
    // onblur 가 영원히 오지 않고, 그래서 cleanup 도 돌지 않는다. 결과적으로
    // 투명한 input 이 안전장치 타이머(60초)까지 **생년월일 필드를 덮고 앉아**
    // 그동안 필드를 아무리 눌러도 반응이 없었다. 사용자가 날짜를 고르지 않고
    // 선택기를 닫으면 바로 이 상태가 된다 — "생년월일 선택이 안 된다".
    input.style.pointerEvents = 'none';
    input.style.border = 'none';
    input.style.outline = 'none';
    input.style.margin = '0';
    input.style.padding = '0';
    input.tabIndex = -1; // 탭 포커스 방지

    let isCleanedUp = false;
    let cleanupTimeout = null;
    let changeHandled = false;
    let showPickerUsed = false;
    let cleanupListener = null;

    const cleanup = () => {
        if (isCleanedUp) return;
        isCleanedUp = true;

        if (cleanupTimeout) {
            clearTimeout(cleanupTimeout);
            cleanupTimeout = null;
        }
        if (cleanupListener) {
            cleanupListener();
            cleanupListener = null;
        }

        // 선택 직후 클릭이 버튼에 가도록 바로 클릭 차단 해제
        input.style.pointerEvents = 'none';
        input.style.visibility = 'hidden';
        const removeInput = () => {
            if (input.parentNode) {
                try {
                    input.parentNode.removeChild(input);
                } catch {
                    // 이미 제거된 경우 무시
                }
            }
        };
        // 짧은 지연 후 제거 (이벤트 전파 후 제거, 두 번째 클릭이 버튼에 닿도록)
        setTimeout(removeInput, 50);
    };

    input.onchange = (event) => {
        if (changeHandled) return;
        changeHandled = true;

        const selectedValue = event?.target?.value || '';
        if (selectedValue) {
            onChange(selectedValue);
        }
        cleanup();
    };

    // 바깥 클릭(달력만 닫고 선택 안 함) 시에도 정리해서 다시 버튼이 눌리도록
    input.onblur = () => {
        if (changeHandled || isCleanedUp) return;
        cleanupTimeout = setTimeout(cleanup, 200);
    };

    // DOM에 추가
    doc.body.appendChild(input);

    // DOM 에 붙인 뒤 **같은 호출 스택에서 바로** 선택기를 연다.
    //
    // showPicker() 는 사용자 제스처(transient activation)가 살아 있을 때만
    // 허용된다. 예전에는 setTimeout(100) 안에서 불렀는데, 그러면 제스처를
    // 잃은 브라우저에서 NotAllowedError 가 나고 아래 click 대체 경로도
    // 프로그램적 click 이라 날짜 선택기를 열지 못한다. 결과는 "눌렀는데
    // 아무 일도 안 일어난다" 였고, 함수가 항상 true 를 돌려줘서 호출자도
    // 실패를 알 수 없었다.
    let opened = false;
    if (typeof input.showPicker === 'function') {
        try {
            input.showPicker();
            opened = true;
            showPickerUsed = true;
        } catch (pickerError) {
            console.warn('showPicker 실패:', pickerError);
        }
    }

    if (!opened) {
        // showPicker 가 없거나 거부된 브라우저. 입력란을 실제로 보여 주고
        // 포커스를 줘서 최소한 직접 입력·기본 UI 로 고를 수 있게 한다.
        // (여기서 숨긴 채로 두면 사용자에게는 아무 일도 안 일어난 것과 같다)
        // 이 경로에서는 사용자가 직접 눌러야 하므로 클릭을 받아야 한다.
        input.style.pointerEvents = 'auto';
        input.style.opacity = '1';
        input.style.background = '#fff';
        if (anchorRect && typeof anchorRect.left === 'number') {
            input.style.width = `${Math.max(1, anchorRect.width || 1)}px`;
            input.style.height = `${Math.max(1, anchorRect.height || 1)}px`;
        } else {
            input.style.width = '220px';
            input.style.height = '40px';
        }
        input.tabIndex = 0;
        try {
            input.focus();
            opened = true;
        } catch (focusError) {
            console.warn('날짜 입력란 포커스 실패:', focusError);
        }
    }

    if (!opened) {
        cleanup();
        return false;
    }

    if (showPickerUsed) {
        // showPicker 로 열었으면 onblur 가 오지 않는다. 사용자의 다음 누름에
        // 맞춰 치워서 숨은 input 이 오래 남지 않게 한다. (capture 로 달아
        // 아래 요소의 핸들러보다 먼저 돌고, 이 input 은 pointerEvents:none
        // 이므로 이 누름은 원래 목적지로 그대로 간다)
        const onNextPointerDown = () => cleanup();
        doc.addEventListener('pointerdown', onNextPointerDown, { capture: true, once: true });
        cleanupListener = () => doc.removeEventListener('pointerdown', onNextPointerDown, { capture: true });
    }

    // 일정 시간 후에도 제거되지 않았으면 강제 제거 (안전장치)
    setTimeout(() => {
        if (!isCleanedUp && input.parentNode) {
            cleanup();
        }
    }, 60000); // 60초 후 강제 제거

    return true;
};

/**
 * 웹에서 datetime-local 선택기 열기 (날짜+시간)
 * openWebDateInput과 동일 패턴, type="datetime-local" 사용
 */
export function openWebDateTimeInput({ value, onChange, min, anchorRect }) {
    const doc = globalThis?.document;
    if (!doc || typeof doc.createElement !== 'function') return false;

    const existingInput = doc.getElementById('web-datetime-input-temp');
    if (existingInput) existingInput.remove();

    const input = doc.createElement('input');
    input.id = 'web-datetime-input-temp';
    input.type = 'datetime-local';
    input.value = value || '';
    if (min) input.min = min;
    input.style.position = 'fixed';
    if (anchorRect && typeof anchorRect.left === 'number' && typeof anchorRect.top === 'number') {
        input.style.left = `${anchorRect.left}px`;
        input.style.top = `${anchorRect.top}px`;
        input.style.width = `${Math.max(1, anchorRect.width || 1)}px`;
        input.style.height = `${Math.max(1, anchorRect.height || 1)}px`;
    } else {
        input.style.top = '50%';
        input.style.left = '50%';
        input.style.transform = 'translate(-50%, -50%)';
        input.style.width = '1px';
        input.style.height = '1px';
    }
    input.style.opacity = '0';
    input.style.zIndex = '99999';
    // openWebDateInput 과 같은 이유로 클릭을 받지 않는다. showPicker() 는
    // 포커스를 주지 않아 onblur 가 오지 않으므로, 'auto' 로 두면 투명한
    // input 이 안전장치 타이머까지 필드를 덮고 앉아 다음 누름이 먹지 않는다.
    input.style.pointerEvents = 'none';
    input.style.border = 'none';
    input.style.outline = 'none';
    input.style.margin = '0';
    input.style.padding = '0';
    input.tabIndex = -1;

    let isCleanedUp = false;
    let blurCleanupTimeout = null;
    let showPickerUsed = false;
    let cleanupListener = null;
    const cleanup = () => {
        if (isCleanedUp) return;
        isCleanedUp = true;
        if (blurCleanupTimeout) {
            clearTimeout(blurCleanupTimeout);
            blurCleanupTimeout = null;
        }
        if (cleanupListener) {
            cleanupListener();
            cleanupListener = null;
        }
        input.style.pointerEvents = 'none';
        input.style.visibility = 'hidden';
        const removeInput = () => {
            if (input.parentNode) {
                try { input.parentNode.removeChild(input); } catch { /* noop */ }
            }
        };
        setTimeout(removeInput, 50);
    };

    input.onchange = (event) => {
        const v = event?.target?.value || '';
        if (v) onChange(v);
        cleanup();
    };
    input.onblur = () => {
        if (isCleanedUp) return;
        blurCleanupTimeout = setTimeout(cleanup, 200);
    };

    doc.body.appendChild(input);

    // openWebDateInput 과 같은 이유로 **같은 호출 스택에서 바로** 연다.
    // showPicker 는 사용자 제스처가 살아 있어야 허용되고, 타이머로 미루면
    // 거부하는 브라우저가 있다. 거부되면 프로그램적 click 으로는 못 열어서
    // "눌렀는데 아무 일도 안 일어난다" 가 된다. (라운딩·모임 등록 날짜 입력)
    let opened = false;
    if (typeof input.showPicker === 'function') {
        try {
            input.showPicker();
            opened = true;
            showPickerUsed = true;
        } catch (pickerError) {
            console.warn('showPicker 실패:', pickerError);
        }
    }

    if (!opened) {
        // 못 열면 입력란을 실제로 보여 줘서 직접 입력이라도 되게 한다
        input.style.pointerEvents = 'auto';
        input.style.opacity = '1';
        input.style.background = '#fff';
        if (anchorRect && typeof anchorRect.left === 'number') {
            input.style.width = `${Math.max(1, anchorRect.width || 1)}px`;
            input.style.height = `${Math.max(1, anchorRect.height || 1)}px`;
        } else {
            input.style.width = '240px';
            input.style.height = '40px';
        }
        input.tabIndex = 0;
        try {
            input.focus();
            opened = true;
        } catch (focusError) {
            console.warn('날짜/시간 입력란 포커스 실패:', focusError);
        }
    }

    if (!opened) {
        cleanup();
        return false;
    }

    if (showPickerUsed) {
        const onNextPointerDown = () => cleanup();
        doc.addEventListener('pointerdown', onNextPointerDown, { capture: true, once: true });
        cleanupListener = () => doc.removeEventListener('pointerdown', onNextPointerDown, { capture: true });
    }

    setTimeout(() => {
        if (!isCleanedUp && input.parentNode) cleanup();
    }, 60000);
    return true;
}

export function createDatePickerChangeHandler({ setValue, setPage, toYmd }) {
    return (event, date) => {
        if (event?.type === 'dismissed') return;
        if (!date) return;
        setValue(toYmd(date));
        setPage(1);
    };
}

export function createOpenDatePickerHandler({
    platform,
    value,
    setValue,
    setPage,
    setShowPicker,
    DateTimePickerAndroid,
    fromYmd,
    toYmd,
}) {
    return (e) => {
        if (platform === 'web') {
            const target = e?.nativeEvent?.target;
            const anchorRect = target && typeof target.getBoundingClientRect === 'function' ? target.getBoundingClientRect() : null;
            const didOpen = openWebDateInput({
                value,
                anchorRect,
                onChange: (nextValue) => {
                    setValue(nextValue);
                    setPage(1);
                },
            });
            if (didOpen) return;
            return;
        }

        if (platform === 'android') {
            DateTimePickerAndroid.open({
                value: fromYmd(value),
                mode: 'date',
                onChange: createDatePickerChangeHandler({ setValue, setPage, toYmd }),
            });
            return;
        }

        setShowPicker(true);
    };
}

export function createTypeFilterHandler({ setTypeFilter, setPage }) {
    return (nextType) => {
        setTypeFilter(nextType);
        setPage(1);
    };
}

export function createResetFiltersHandler({ setTypeFilter, setStatusFilter, setStartDate, setEndDate, setPage }) {
    return () => {
        setTypeFilter('all');
        setStatusFilter('all');
        setStartDate('');
        setEndDate('');
        setPage(1);
    };
}

export function createMeetingDetailHandler({ router }) {
    return (meetingId, slug) =>
        () => {
            router.push(`/meetings/${slug}/${meetingId}`);
        };
}

export function createNextPageHandler({ setPage, totalPages }) {
    return () => {
        setPage((prev) => Math.min(totalPages, prev + 1));
    };
}

export function createLoadNotificationsHandler({
    notificationsApi,
    filter,
    typeFilter,
    pickData,
    setNotifications,
    setLoading,
    setError,
}) {
    return async function () {
        try {
            setLoading(true);
            setError(null);

            const params = { filter };
            if (typeFilter !== 'all') params.type_filter = typeFilter;

            const response = await notificationsApi.getNotifications(params);
            setNotifications(pickData(response) || []);
        } catch (error) {
            setError(error);
        } finally {
            setLoading(false);
        }
    };
}

export function createMarkAsReadHandler({ notificationsApi, setNotifications, alert }) {
    return async function (id) {
        try {
            await notificationsApi.markAsRead(id);
            const now = new Date().toISOString();
            setNotifications((prev) =>
                prev.map((item) =>
                    item.id === id
                        ? { ...item, status: 'READ', read_at: item.read_at || now }
                        : item
                )
            );
        } catch {
            alert('오류', '읽음 처리에 실패했습니다.');
        }
    };
}

export function createMarkAllAsReadHandler({ notificationsApi, setNotifications, setToast, alert }) {
    return async function () {
        try {
            await notificationsApi.markAllAsRead();
            const now = new Date().toISOString();
            setNotifications((prev) =>
                prev.map((item) => ({ ...item, status: 'READ', read_at: item.read_at || now }))
            );
            setToast({ tone: 'success', message: '모든 알림이 읽음 처리되었습니다.' });
        } catch {
            alert('오류', '처리에 실패했습니다.');
        }
    };
}

export function createDeleteNotificationHandler({ notificationsApi, setNotifications, setToast, alert }) {
    return async function (id) {
        try {
            await notificationsApi.deleteNotification(id);
            setNotifications((prev) => prev.filter((item) => item.id !== id));
            setToast({ tone: 'success', message: '알림이 삭제되었습니다.' });
        } catch {
            alert('오류', '삭제에 실패했습니다.');
        }
    };
}

export function createToggleSelectHandler({ setSelected }) {
    return (id) => {
        setSelected((prev) =>
            prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
        );
    };
}

export function createSelectAllHandler({ notifications, selected, setSelected }) {
    return () => {
        if (selected.length === notifications.length) setSelected([]);
        else setSelected(notifications.map((item) => item.id));
    };
}

export function createBulkReadHandler({ selected, markAsRead, setSelected }) {
    return async function () {
        for (const id of selected) await markAsRead(id);
        setSelected([]);
    };
}

export function createBulkDeleteHandler({ selected, deleteOne, setSelected }) {
    return async function () {
        for (const id of selected) await deleteOne(id);
        setSelected([]);
    };
}

export function createOpenNotificationHandler({ isUnreadNotification, markAsRead, router }) {
    return async function (notification) {
        if (isUnreadNotification(notification)) await markAsRead(notification.id);

        if (!notification.related_entity_type || !notification.related_entity_id) return;

        if (
            notification.related_entity_type === 'CLUB' ||
            notification.related_entity_type === 'CLUB_MEMBERSHIP'
        ) {
            router.push(`/clubs/${notification.related_entity_id}`);
        }
        if (notification.related_entity_type === 'CLUB_NOTICE' && notification.extra_data?.club_id) {
            router.push(`/clubs/${notification.extra_data.club_id}/notices`);
        }
    };
}

export function createConfirmDeleteHandler({ deleteTarget, deleteOne, setDeleteTarget }) {
    return () => {
        if (!deleteTarget) return;
        deleteOne(deleteTarget);
        setDeleteTarget(null);
    };
}
export function createFetchProfileHandler({
    fetchMyProfile,
    fetchUserHandicap,
    extractData,
    setProfile,
    setHandicapInfo,
    setLoading,
    setError,
}) {
    return async function () {
        try {
            setLoading(true);
            setError(null);
            const response = await fetchMyProfile();
            const user = extractData(response);
            setProfile(user);
            if (user?.id) {
                const handicapResponse = await fetchUserHandicap(user.id);
                setHandicapInfo(extractData(handicapResponse));
            }
        } catch (fetchError) {
            console.error('프로필 조회 실패:', fetchError);
            setError('사용자 정보를 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };
}

export function createFetchClubsHandler({
    fetchMyClubs,
    extractList,
    setClubs,
}) {
    return async function () {
        try {
            const response = await fetchMyClubs({ page: 1, limit: 3 });
            const items = extractList(response);
            setClubs(items);
        } catch (fetchError) {
            console.error('클럽 목록 조회 실패:', fetchError);
        setClubs([]);
    }
};
}
export function createScoreStatusHandler({ setScoreStatus, setPage }) {
    return (nextStatus) => {
        setScoreStatus(nextStatus);
        setPage(1);
    };
}

export function createPrevPageHandler({ setPage }) {
    return () => {
        setPage((prev) => Math.max(1, prev - 1));
    };
}

export function createGoToDetailHandler({ router }) {
    return (meetingId) =>
        () => {
            router.push(`/meetings/rounding/${meetingId}`);
        };
}

export function createCloseScoreModalHandler({ setShowScoreModal, setSelectedMeeting, setSelectedParticipantId }) {
    return () => {
        setShowScoreModal(false);
        setSelectedMeeting(null);
        setSelectedParticipantId(null);
    };
}

export function createFetchStatsHandler({ fetchRoundingStats, pickData, setStatsLoading, setStatsError, setStats }) {
    return async function () {
        try {
            setStatsLoading(true);
            setStatsError(null);

            const response = await fetchRoundingStats();
            setStats(pickData(response));
        } catch (error) {
            console.error(error);
            setStatsError(error);
        } finally {
            setStatsLoading(false);
        }
    };
}

export function createFetchMeetingsHandler({
    fetchMyRoundingMeetings,
    fetchMyMeetings,
    scoreStatus,
    page,
    limit,
    typeFilter,
    startDate,
    endDate,
    pickData,
    extractList,
    setMeetings,
    setTotalPages,
    setLoading,
    setError,
}) {
    return async function () {
        try {
            setLoading(true);
            setError(null);

            let response;

            // fetchMyRoundingMeetings를 사용하는 경우 (records.js)
            if (fetchMyRoundingMeetings) {
                response = await fetchMyRoundingMeetings({
                    score_status: scoreStatus,
                    page,
                    limit,
                });
            }
            // fetchMyMeetings를 사용하는 경우 (meetings.js)
            else if (fetchMyMeetings) {
                const params = {
                    page,
                    limit: limit || 20,
                };

                if (typeFilter && typeFilter !== 'all') {
                    params.type = typeFilter;
                }
                if (startDate) {
                    params.start_date = startDate;
                }
                if (endDate) {
                    params.end_date = endDate;
                }

                response = await fetchMyMeetings(params);
            } else {
                throw new Error('fetchMyRoundingMeetings or fetchMyMeetings must be provided');
            }

            // extractList가 있으면 사용 (meetings.js)
            if (extractList) {
                const list = extractList(response);
                setMeetings(Array.isArray(list) ? list : []);
            }
            // pickData가 있으면 사용 (records.js)
            else if (pickData) {
                const data = pickData(response);
                if (Array.isArray(data)) {
                    setMeetings(data);
                    setTotalPages(Number(response?.total_pages) || 1);
                } else {
                    const normalized = data || response || {};
                    const list = normalized?.data ?? normalized?.list ?? [];
                    setMeetings(Array.isArray(list) ? list : []);
                    setTotalPages(Number(normalized?.total_pages ?? response?.total_pages) || 1);
                }
            }
            // 둘 다 없으면 기본 처리
            else {
                const data = response?.data || response || {};
                const list = data?.data ?? data?.list ?? [];
                setMeetings(Array.isArray(list) ? list : []);
                if (data?.total_pages !== undefined) {
                    setTotalPages(Number(data.total_pages) || 1);
                }
            }
        } catch (error) {
            console.error(error);
            setError(error);
        } finally {
            setLoading(false);
        }
    };
}

export function createFetchHandicapHandler({ fetchMyProfile, fetchUserHandicap, pickData, setCurrentHandicap }) {
    return async function () {
        try {
            const profileResp = await fetchMyProfile?.();
            const profile = pickData(profileResp);
            const userId = profile?.id || profile?.data?.id;

            if (!userId || !fetchUserHandicap) return;

            const handicapResp = await fetchUserHandicap(userId);
            const handicapData = pickData(handicapResp) || {};
            const info = handicapData?.data || handicapData;

            const calculated = info?.calculated_handicap;
            const initial = info?.initial_handicap;
            const value = calculated ?? initial ?? null;

            setCurrentHandicap(value);
        } catch (error) {
            console.warn('handicap fetch failed:', error?.message || error);
        }
    };
}

export function createOpenScoreModalHandler({
    fetchRoundParticipants,
    fetchMyProfile,
    pickData,
    setSelectedParticipantId,
    setSelectedMeeting,
    setShowScoreModal,
    alert,
}) {
    return async function (meeting) {
        try {
            const participantsResp = await fetchRoundParticipants(meeting.meeting_id);
            const participants = pickData(participantsResp);
            const list = Array.isArray(participants)
                ? participants
                : participants?.data || [];

            const profileResp = await fetchMyProfile?.();
            const profile = pickData(profileResp);
            const myUserId = profile?.id || profile?.data?.id;

            const mine = list.find((participant) => participant.user_id === myUserId);

            if (!mine) {
                alert('오류', '참가자 정보를 찾을 수 없습니다.');
                return;
            }

            setSelectedParticipantId(mine.id);
            setSelectedMeeting(meeting);
            setShowScoreModal(true);
        } catch (error) {
            console.error('참가자 조회 실패:', error);
            alert('오류', '참가자 정보를 불러오는데 실패했습니다.');
        }
    };
}

export function createScoreSuccessHandler({
    setShowScoreModal,
    setSelectedMeeting,
    setSelectedParticipantId,
    fetchMeetings,
    fetchStats,
    fetchHandicap,
}) {
    return async function () {
        setShowScoreModal(false);
        setSelectedMeeting(null);
        setSelectedParticipantId(null);
        await fetchMeetings();
        await fetchStats();
        await fetchHandicap();
    };
}

export function createGrossScoreChangeHandler({ setGrossScore }) {
    return (value) => {
        if (value === '') {
            setGrossScore('');
            return;
        }
        if (!/^\d+$/.test(value)) return;

        if (value.length > 1 && value[0] === '0') {
            const stripped = value.replace(/^0+/, '') || '0';
            if (stripped === '0') {
                setGrossScore('');
                return;
            }
            setGrossScore(stripped);
            return;
        }

        setGrossScore(value);
    };
}

export function createScoreValidationHandler({ grossScore, setErrors }) {
    return () => {
        const nextErrors = {};
        if (!grossScore || grossScore.trim() === '') {
            nextErrors.grossScore = '라운딩 스코어를 입력해주세요.';
        } else {
            const score = parseInt(grossScore, 10);
            if (Number.isNaN(score)) nextErrors.grossScore = '숫자만 입력 가능합니다.';
            else if (score < 55 || score > 144) {
                nextErrors.grossScore = '스코어는 55~144 사이의 값이어야 합니다.';
            }
        }
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };
}

function isSimpleScoreAlreadyExistsError(error) {
    const status = error?.response?.status;
    const detail = error?.response?.data?.detail;
    const msg = typeof detail === 'string' ? detail : '';
    return (
        status === 409 ||
        (msg.includes('이미 점수가 입력') && msg.includes('수정'))
    );
}

export function createScoreSubmitHandler({
    validate,
    shouldCompleteRounding,
    meetingId,
    participantId,
    grossScore,
    submitSimpleScore,
    updateSimpleScore,
    completeRounding,
    onSuccess,
    onClose,
    resetLocal,
    setIsSubmitting,
    setErrors,
}) {
    return async function () {
        if (!validate()) return;

        const payload = { gross_score: parseInt(grossScore, 10) };

        try {
            setIsSubmitting(true);

            if (shouldCompleteRounding) {
                await completeRounding(meetingId);
            }

            try {
                await submitSimpleScore(meetingId, participantId, payload);
            } catch (firstError) {
                if (updateSimpleScore && isSimpleScoreAlreadyExistsError(firstError)) {
                    await updateSimpleScore(meetingId, participantId, payload);
                } else {
                    throw firstError;
                }
            }

            onSuccess?.(shouldCompleteRounding);
            onClose?.();
            resetLocal();
        } catch (error) {
            console.error('점수 입력 실패:', error);
            const detail =
                error?.response?.data?.detail || error?.message || '점수 입력에 실패했습니다.';
            setErrors({ submit: detail });
        } finally {
            setIsSubmitting(false);
        }
    };
}

export function createResetScoreEntryHandler({ setGrossScore, setIsSubmitting, setErrors }) {
    return () => {
        setGrossScore('');
        setIsSubmitting(false);
        setErrors({});
    };
}

export function createCloseScoreEntryHandler({ isSubmitting, onClose, resetLocal }) {
    return () => {
        if (isSubmitting) return;
        onClose?.();
        resetLocal();
    };
}
export function createToggleAgreedHandler({ setAgreed }) {
    return () => {
        setAgreed((prev) => !prev);
    };
}

export function createConfirmTextChangeHandler({ setConfirmText }) {
    return (value) => {
        setConfirmText(value);
    };
}

export function createSubmitWithdrawHandler({ agreed, confirmText, setError, setModalOpen, getWithdrawValidationError }) {
    return () => {
        const message = getWithdrawValidationError({ agreed, confirmText });
        if (message) {
            setError(message);
            return;
        }
        setError('');
        setModalOpen(true);
    };
}

export function createCloseWithdrawModalHandler({ setModalOpen }) {
    return () => {
        setModalOpen(false);
    };
}

export function createConfirmWithdrawHandler({
    deleteAccount,
    setIsSubmitting,
    setResultMessage,
    setModalOpen,
    setError,
    router,
}) {
    return async function () {
        try {
            setIsSubmitting(true);
            await deleteAccount();
            setResultMessage('회원 탈퇴가 완료되었습니다.');
            setModalOpen(false);
            replaceWithPolicy(router, '/login');
        } catch (error) {
            setError(error?.message || '회원 탈퇴에 실패했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };
}

// export const mypageRenderUtils = {
//     createInputChangeHandler,
//     createCheckNicknameDuplicateHandler,
//     createBirthPickerChangeHandler,
//     createValidateProfileFormHandler,
//     createSaveProfileHandler,
//     createPasswordModalOpenHandler,
//     createPasswordModalCloseHandler,
//     createBirthPickerOpenHandler,
//     createCompositionStartHandler,
//     createCompositionEndHandler,
//     createShowToastHandler,
//     createFieldChangeHandler,
//     createConditionalFieldChangeHandler,
//     createTabPressHandler,
//     getMyPageTabContent,
//     createOpenDatePickerHandler,
//     createTypeFilterHandler,
//     createResetFiltersHandler,
//     createMeetingDetailHandler,
//     createNextPageHandler,
//     createLoadNotificationsHandler,
//     createMarkAsReadHandler,
//     createMarkAllAsReadHandler,
//     createDeleteNotificationHandler,
//     createToggleSelectHandler,
//     createSelectAllHandler,
//     createBulkReadHandler,
//     createBulkDeleteHandler,
//     createOpenNotificationHandler,
//     createConfirmDeleteHandler,
//     createFetchProfileHandler,
//     createFetchClubsHandler,
//     createOpenClubsHandler,
//     createOpenClubDetailHandler,
//     createScoreStatusHandler,
//     createPrevPageHandler,
//     createGoToDetailHandler,
//     createCloseScoreModalHandler,
//     createFetchStatsHandler,
//     createFetchMeetingsHandler,
//     createFetchHandicapHandler,
//     createOpenScoreModalHandler,
//     createScoreSuccessHandler,
//     createGrossScoreChangeHandler,
//     createScoreValidationHandler,
//     createScoreSubmitHandler,
//     createResetScoreEntryHandler,
//     createCloseScoreEntryHandler,
//     createToggleAgreedHandler,
//     createConfirmTextChangeHandler,
//     createSubmitWithdrawHandler,
//     createCloseWithdrawModalHandler,
//     createConfirmWithdrawHandler,
// }
