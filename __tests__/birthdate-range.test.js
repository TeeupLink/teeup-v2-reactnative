/**
 * 생년월일 허용 범위.
 *
 * 서버(backend routers/auth.py validate_birthdate)가 PUT /users/me 에서
 * "만 14세 이상 · 1900년 이후 · 미래 아님" 을 강제한다. 프런트가 그 범위를
 * 몰라서 예전에는:
 *   - 선택기 maximumDate 가 '오늘' 이라 만 14세 미만도 고를 수 있었고
 *   - 웹은 min/max 를 아예 안 넘겨 미래 날짜도 고를 수 있었고
 *   - 프런트 검증이 없어 저장할 때 400 으로 처음 알게 됐다
 * 이 테스트는 그 범위가 서버와 어긋나면 깨진다.
 */
import {
  BIRTHDATE_MIN_AGE,
  BIRTHDATE_MIN_YEAR,
  getBirthdateError,
  getMaxBirthDate,
  getMinBirthDate,
  validateProfileForm,
} from '@/lib/util/mypageUtils';

const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// 윤년 경계에 걸리지 않는 고정 기준일로 본다
const TODAY = new Date(2026, 10, 18); // 2026-11-18

describe('getMaxBirthDate', () => {
  it('오늘로부터 만 14년 전이다', () => {
    expect(ymd(getMaxBirthDate(TODAY))).toBe('2012-11-18');
  });

  it('시각 성분을 남기지 않는다 (날짜 비교가 시/분 때문에 어긋나지 않도록)', () => {
    const d = getMaxBirthDate(new Date(2026, 10, 18, 23, 59, 59));
    expect([d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()]).toEqual([0, 0, 0, 0]);
  });
});

describe('getMinBirthDate', () => {
  it('1900-01-01 이다', () => {
    expect(ymd(getMinBirthDate())).toBe('1900-01-01');
    expect(getMinBirthDate().getFullYear()).toBe(BIRTHDATE_MIN_YEAR);
  });
});

describe('getBirthdateError', () => {
  it('비어 있으면 통과한다 (선택 항목이다)', () => {
    expect(getBirthdateError('', TODAY)).toBe('');
    expect(getBirthdateError(null, TODAY)).toBe('');
    expect(getBirthdateError(undefined, TODAY)).toBe('');
  });

  it('정상 날짜는 통과한다', () => {
    expect(getBirthdateError('1975-03-09', TODAY)).toBe('');
  });

  it('만 14세가 되는 날 당일은 통과한다 (경계)', () => {
    expect(getBirthdateError('2012-11-18', TODAY)).toBe('');
  });

  it('만 14세가 하루 모자라면 막는다 (경계)', () => {
    expect(getBirthdateError('2012-11-19', TODAY)).toBe(
      `만 ${BIRTHDATE_MIN_AGE}세 이상만 가입할 수 있습니다.`,
    );
  });

  it('미래 날짜를 막는다', () => {
    expect(getBirthdateError('2027-01-01', TODAY)).toBe('생년월일은 미래 날짜일 수 없습니다.');
  });

  it('1900년 이전을 막는다', () => {
    expect(getBirthdateError('1899-12-31', TODAY)).toBe('올바른 생년월일을 입력해주세요.');
  });

  it('형식이 어긋나면 막는다', () => {
    expect(getBirthdateError('1975/03/09', TODAY)).toContain('YYYY-MM-DD');
    expect(getBirthdateError('19750309', TODAY)).toContain('YYYY-MM-DD');
    expect(getBirthdateError('아무거나', TODAY)).toContain('YYYY-MM-DD');
  });
});

describe('validateProfileForm 의 생년월일', () => {
  const base = {
    nickname: '테스터',
    realname: '홍길동',
    phone_number: '01012345678',
    average_score_init: '90',
  };
  const opts = {
    isNicknameSameValue: true,
    nicknameChecked: true,
    hasFinalAverageScore: true,
    shouldValidateAverageScoreInit: false,
  };

  it('생년월일이 비어도 저장을 막지 않는다', () => {
    const errors = validateProfileForm({ formData: { ...base, birthdate: '' }, ...opts });
    expect(errors.birthdate).toBeUndefined();
  });

  it('만 14세 미만이면 저장 전에 막는다 (서버 400 을 보기 전에)', () => {
    const tooYoung = ymd(new Date(new Date().getFullYear() - 5, 0, 1));
    const errors = validateProfileForm({ formData: { ...base, birthdate: tooYoung }, ...opts });
    expect(errors.birthdate).toContain(`만 ${BIRTHDATE_MIN_AGE}세`);
  });

  it('정상 생년월일은 통과한다', () => {
    const errors = validateProfileForm({ formData: { ...base, birthdate: '1975-03-09' }, ...opts });
    expect(errors.birthdate).toBeUndefined();
  });
});
