
import { mypageApi } from '@/lib/api/api';
import { extractData } from '@/lib/util/responseUtils';

import { colors } from '../../styles/colors';

export function formatProfileDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('ko-KR');
};

export function getGenderLabel(gender) {
  if (!gender) return '-';
  const normalized = String(gender).toUpperCase();
  if (['M', 'MALE', '남성'].includes(normalized)) return '남성';
  if (['F', 'FEMALE', '여성'].includes(normalized)) return '여성';
  return gender;
};

export function calcHandicapFromAvg(avgStr) {
  const num = Number(avgStr);
  if (!avgStr || Number.isNaN(num)) return null;
  if (num < 55 || num > 144) return null;
  return Math.max(0, Math.min(72, Math.round(num - 72)));
};

const AVERAGE_SCORE_INIT_MIN = 55;
const AVERAGE_SCORE_INIT_MAX = 144;

export function getAverageScoreInitError(value) {
  const raw = String(value ?? '').trim();

  if (!raw) {
    return '초기 평균 타수를 입력해주세요.';
  }

  if (!/^\d+$/.test(raw)) {
    return '초기 평균 타수는 숫자만 입력 가능합니다.';
  }

  const score = Number(raw);
  if (
    !Number.isInteger(score) ||
    score < AVERAGE_SCORE_INIT_MIN ||
    score > AVERAGE_SCORE_INIT_MAX
  ) {
    return '초기 평균 타수는 55~144 사이의 정수만 입력 가능합니다.';
  }

  return '';
}

// export function formatDateYYYYMMDD(date) {
//   if (!date) return '';
//   const year = date.getFullYear();
//   const month = String(date.getMonth() + 1).padStart(2, '0');
//   const day = String(date.getDate()).padStart(2, '0');
//   return `${year}-${month}-${day}`;
// };
/**
 * Date / ISO string / datetime string → "YYYY-MM-DD"
 * - RN / Web 공통
 * - 잘못된 값은 빈 문자열 반환
 */
export function formatDateYYYYMMDD(value) {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseBirthdate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export function getBirthDateValue(birthdate, fallback) {
  const parsed = parseBirthdate(birthdate);
  return parsed || fallback;
};

export function isNicknameSame(profileNickname, formNickname) {
  if (!profileNickname) return false;
  return profileNickname === (formNickname || '').trim();
};

export function validateProfileForm({
  formData,
  isNicknameSameValue,
  nicknameChecked,
  hasFinalAverageScore,
  shouldValidateAverageScoreInit = true,
}) {
  const nextErrors = {};
  const nickname = formData.nickname?.trim();

  if (!nickname) {
    nextErrors.nickname = '닉네임을 입력해주세요.';
  } else if (nickname.length < 2 || nickname.length > 20) {
    nextErrors.nickname = '닉네임은 2-20자여야 합니다.';
  } else if (!/^[a-zA-Z가-힣0-9]+$/.test(nickname)) {
    nextErrors.nickname = '닉네임은 영문, 한글, 숫자만 사용 가능합니다.';
  } else if (!isNicknameSameValue && !nicknameChecked) {
    nextErrors.nickname = '닉네임 중복확인을 해주세요.';
  }

  if (!formData.realname?.trim()) {
    nextErrors.realname = '실명을 입력해주세요.';
  }

  if (!formData.phone_number?.trim()) {
    nextErrors.phone_number = '전화번호를 입력해주세요.';
  }

  if (!hasFinalAverageScore && shouldValidateAverageScoreInit) {
    const averageScoreInitError = getAverageScoreInitError(formData.average_score_init);
    if (averageScoreInitError) {
      nextErrors.average_score_init = averageScoreInitError;
    }
  }

  return nextErrors;
};

export function validateChangePasswordForm(formData) {
  const errors = {};

  if (!formData.currentPassword) {
    errors.currentPassword = '현재 비밀번호를 입력해주세요.';
  }

  if (!formData.newPassword) {
    errors.newPassword = '새 비밀번호를 입력해주세요.';
  } else if (formData.newPassword.length < 6 || formData.newPassword.length > 32) {
    errors.newPassword = '비밀번호는 6~32자여야 합니다.';
  } else {
    const rules = [
      /[A-Z]/.test(formData.newPassword),
      /[a-z]/.test(formData.newPassword),
      /[0-9]/.test(formData.newPassword),
      /[!@#$%^&*(),.?":{}|<>]/.test(formData.newPassword),
    ];
    if (rules.filter(Boolean).length < 2) {
      errors.newPassword = '영문 대/소문자, 숫자, 특수문자 중 2개 이상 포함해야 합니다.';
    }
    if (formData.newPassword === formData.currentPassword) {
      errors.newPassword = '현재 비밀번호와 달라야 합니다.';
    }
  }

  if (!formData.confirmPassword) {
    errors.confirmPassword = '비밀번호 확인을 입력해주세요.';
  } else if (formData.newPassword !== formData.confirmPassword) {
    errors.confirmPassword = '비밀번호가 일치하지 않습니다.';
  }

  return errors;
};

export function getChangePasswordScreenError(formData) {
  if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
    return '모든 항목을 입력해주세요.';
  }
  if (formData.newPassword !== formData.confirmPassword) {
    return '새 비밀번호가 일치하지 않습니다.';
  }
  return '';
};

export function buildProfileInfoItems(profile, { formatProfileDate, getGenderLabel }) {
  return [
    { label: '실명', value: profile?.realname || '-' },
    { label: '닉네임', value: profile?.nickname || '-' },
    { label: '이메일', value: profile?.email || '-' },
    { label: '연락처', value: profile?.phone_number || '-' },
    { label: '성별', value: getGenderLabel(profile?.gender) },
    { label: '생년월일', value: formatProfileDate(profile?.birthdate) },
    { label: '가입일', value: formatProfileDate(profile?.created_at) },
  ];
}

export function getProfileInfoIconName(label) {
  if (label === '이메일') return 'envelope';
  if (label === '성별') return 'venus-mars';
  if (label === '생년월일') return 'calendar-alt';
  if (label === '가입일') return 'calendar-check';
  if (label === '연락처') return 'phone';
  if (label === '닉네임') return 'id-card';
  return 'user-alt';
};
export function toYmd(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function fromYmd(value) { return (value ? new Date(`${value}T00:00:00`) : new Date()); }

export function hasMeetingFilters({ typeFilter, startDate, endDate }) { return typeFilter !== 'all' || startDate !== '' || endDate !== ''; }

export function formatNotificationDate(dateString) {
  try {
    if (!dateString) return '날짜 정보 없음';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '날짜 정보 없음';

    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;

    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '날짜 정보 없음';
  }
};

export function isUnreadNotification(notification) { return notification.status === 'UNREAD' || !notification.read_at; }

export function getNotificationIcon(type) {
  switch (type) {
    case 'CLUB_MEMBERSHIP_APPROVED':
    case 'CLUB_MEMBERSHIP_REJECTED':
    case 'CLUB_MEMBERSHIP_REQUEST':
    case 'CLUB_INVITATION':
      return { name: 'users', color: colors.blue[600] };
    case 'MEETING_REMINDER':
    case 'MEETING_CANCELLATION':
    case 'MEETING_COMPLETED':
    case 'TEAM_FORMATION_COMPLETED':
      return { name: 'calendar-alt', color: colors.emerald[600] };
    case 'NEW_NOTICE':
      return { name: 'file-alt', color: colors.yellow[600] };
    case 'MEETING_SETTLEMENT_COMPLETED':
    case 'SOCIAL_SETTLEMENT_COMPLETED':
      return { name: 'money-bill-wave', color: colors.violet[600] };
    default:
      return { name: 'bell', color: colors.neutral[600] };
  }
};

export const notificationTypeLabels = {
  all: '전체 타입',
  CLUB_MEMBERSHIP_APPROVED: '클럽 가입 승인',
  CLUB_MEMBERSHIP_REJECTED: '클럽 가입 거절',
  CLUB_MEMBERSHIP_REQUEST: '가입 신청',
  MEETING_REMINDER: '모임 알림',
  TEAM_FORMATION_COMPLETED: '팀 편성 완료',
  NEW_NOTICE: '공지사항',
  MEETING_SETTLEMENT_COMPLETED: '정산 완료',
  SOCIAL_SETTLEMENT_COMPLETED: '소셜 정산 완료',
};
export function asNumber(value, fallback = 0) {
  const number = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(number) ? number : fallback;
};

export function pickData(response) {
  if (!response) return null;
  if (response.data !== undefined) return response.data;
  return response;
};

export function formatKoreanDate(dateLike) {
  if (!dateLike) return '-';
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '-';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}년 ${month}월 ${day}일`;
};

export function getGrossScoreHandicap(grossScore) {
  if (!grossScore) return null;
  const gross = parseInt(grossScore, 10);
  if (Number.isNaN(gross)) return null;
  const handicap = gross - 72;
  const clamped = Math.max(0, Math.min(72, handicap));
  return clamped.toFixed(1);
};

export function getRecordErrorMessage(error) { return error?.response?.data?.detail || error?.message || '알 수 없는 오류가 발생했습니다.'; }
export function getWithdrawValidationError({ agreed, confirmText }) {
  if (!agreed) return '안내사항에 동의해주세요.';
  if (confirmText !== '회원탈퇴') return '정확히 \"회원탈퇴\"를 입력해주세요.';
  return '';
};

export async function ensureProfileCompleted({
  router,
  alertMessage = '클럽 이용 전 프로필을 완성해 주세요!',
  redirectPath = '/mypage/edit?profile_required=1',
} = {}) {
  try {
    const response = await mypageApi.fetchMyProfile();
    const user = extractData(response);

    if (!user) {
      alert('사용자 정보를 불러올 수 없습니다.');
      return false;
    }

    const {
      realname,
      phone_number,
      average_score,
      average_score_init
    } = user;

    // 생년월일·성별은 선택 항목 (App Store 5.1.1: 핵심 기능에 불필요한 개인정보 강제 금지).
    // 자동 조편성·티박스 구분에만 쓰이며, 없어도 클럽·모임 이용에 지장 없다.
    const requiredFields = [
      realname,
      phone_number,
      average_score ?? average_score_init // 평균 타수 둘 중 하나라도 있으면 통과
    ];

    const isCompleted = !requiredFields.some(
      v => v == null || v === ''
    );

    if (!isCompleted) {
      alert(alertMessage);
      router.replace(redirectPath);
      return false;
    }

    return true;
  } catch (error) {
    console.error('프로필 완성 여부 확인 실패:', error);
    alert('프로필 정보를 확인할 수 없습니다.');
    return false;
  }
}
// export const mypageUtils = {
//   formatProfileDate,
//   getGenderLabel,
//   isSocialLoginUser,
//   calcHandicapFromAvg,
//   formatDateYYYYMMDD,
//   parseBirthdate,
//   getBirthDateValue,
//   isNicknameSame,
//   validateProfileForm,
//   validateChangePasswordForm,
//   getChangePasswordScreenError,
//   buildProfileInfoItems,
//   getProfileInfoIconName,
//   toYmd,
//   fromYmd,
//   hasMeetingFilters,
//   formatNotificationDate,
//   isUnreadNotification,
//   getNotificationIcon,
//   notificationTypeLabels,
//   asNumber,
//   pickData,
//   formatKoreanDate,
//   getGrossScoreHandicap,
//   getRecordErrorMessage,
//   getWithdrawValidationError,
//   getRoundingMeetingTitle,
//   buildRoundingFormFromData,
//   validateRoundingForm,
//   resolveSettlementMethod,
//   buildRoundingPayload,
// };

export function getAverageScoreDisplay(profile) {
  if (!profile) {
    return { label: '평균 타수', value: '-' };
  }

  if (profile.average_score != null) {
    return {
      label: '평균 타수',
      value: `${profile.average_score}타`,
    };
  }

  if (profile.average_score_init != null) {
    return {
      label: '초기 평균 타수',
      value: `${profile.average_score_init}타`,
    };
  }

  return {
    label: '평균 타수',
    value: '-',
  };
}

export function getHandicapDisplayInfo(profile) {
  if (!profile) {
    return { label: '핸디캡', value: '-' };
  }

  if (profile.handicap != null) {
    return {
      label: '핸디캡',
      value: profile.handicap,
    };
  }

  if (profile.handicap_init != null) {
    return {
      label: '초기 핸디캡',
      value: profile.handicap_init,
    };
  }

  return {
    label: '핸디캡',
    value: '-',
  };
}
