/**
 * 조회 기간 날짜 선택기 (마이페이지 모임 내역 / 클럽 통계).
 *
 * 예전 문제: createDatePickerChangeHandler 가 setShowPicker(false) 를 아예 부르지
 * 않았다. iOS 선택기는 인라인으로 렌더되고 스스로 사라지지 않으므로, 한 번 열면
 * 화면에 영구히 남았다. clubs/[clubId]/stats.js 는 Android 에서만 닫고 있었다.
 *
 * Android 는 DateTimePickerAndroid.open 이 네이티브 대화상자를 띄우므로 닫을
 * 대상이 없다 → setShowPicker 를 넘기지 않아도 동작해야 한다.
 */
import {
  createDatePickerChangeHandler,
  createOpenDatePickerHandler,
} from '@/lib/handler/mypage';
import { toYmd } from '@/lib/util/mypageUtils';

const makeHandler = (over = {}) => {
  const setValue = jest.fn();
  const setPage = jest.fn();
  const setShowPicker = jest.fn();
  const handler = createDatePickerChangeHandler({
    setValue, setPage, toYmd, setShowPicker, ...over,
  });
  return { handler, setValue, setPage, setShowPicker };
};

describe('createDatePickerChangeHandler', () => {
  it('날짜를 고르면 선택기를 닫는다 (iOS 인라인 선택기가 남지 않도록)', () => {
    const { handler, setShowPicker, setValue, setPage } = makeHandler();

    handler({ type: 'set' }, new Date(2026, 10, 21));

    expect(setShowPicker).toHaveBeenCalledWith(false);
    expect(setValue).toHaveBeenCalledWith('2026-11-21');
    expect(setPage).toHaveBeenCalledWith(1);
  });

  it('취소해도 선택기를 닫는다 (값은 그대로)', () => {
    const { handler, setShowPicker, setValue, setPage } = makeHandler();

    handler({ type: 'dismissed' }, undefined);

    expect(setShowPicker).toHaveBeenCalledWith(false);
    expect(setValue).not.toHaveBeenCalled();
    expect(setPage).not.toHaveBeenCalled();
  });

  it('날짜가 없으면 값을 바꾸지 않지만 선택기는 닫는다', () => {
    const { handler, setShowPicker, setValue } = makeHandler();

    handler({ type: 'set' }, null);

    expect(setShowPicker).toHaveBeenCalledWith(false);
    expect(setValue).not.toHaveBeenCalled();
  });

  it('setShowPicker 가 없어도 던지지 않는다 (Android 네이티브 대화상자 경로)', () => {
    const setValue = jest.fn();
    const setPage = jest.fn();
    const handler = createDatePickerChangeHandler({ setValue, setPage, toYmd });

    expect(() => handler({ type: 'set' }, new Date(2026, 0, 2))).not.toThrow();
    expect(setValue).toHaveBeenCalledWith('2026-01-02');
  });

  it('setPage 가 없어도 던지지 않는다 (클럽 통계는 페이지 상태가 없다)', () => {
    const setValue = jest.fn();
    const setShowPicker = jest.fn();
    const handler = createDatePickerChangeHandler({ setValue, toYmd, setShowPicker });

    expect(() => handler({ type: 'set' }, new Date(2026, 0, 2))).not.toThrow();
    expect(setValue).toHaveBeenCalledWith('2026-01-02');
    expect(setShowPicker).toHaveBeenCalledWith(false);
  });

  it('이벤트 객체가 없어도 던지지 않는다', () => {
    const { handler, setValue, setShowPicker } = makeHandler();

    expect(() => handler(undefined, new Date(2026, 0, 2))).not.toThrow();
    expect(setShowPicker).toHaveBeenCalledWith(false);
    expect(setValue).toHaveBeenCalledWith('2026-01-02');
  });
});

describe('createOpenDatePickerHandler', () => {
  it('iOS 는 인라인 선택기를 띄운다', () => {
    const setShowPicker = jest.fn();
    const open = createOpenDatePickerHandler({
      platform: 'ios',
      value: '2026-01-01',
      setValue: jest.fn(),
      setPage: jest.fn(),
      setShowPicker,
      fromYmd: (v) => new Date(`${v}T00:00:00`),
      toYmd,
    });

    open();

    expect(setShowPicker).toHaveBeenCalledWith(true);
  });

  it('Android 는 네이티브 대화상자를 열고 인라인 선택기는 쓰지 않는다', () => {
    const setShowPicker = jest.fn();
    const DateTimePickerAndroid = { open: jest.fn() };
    const open = createOpenDatePickerHandler({
      platform: 'android',
      value: '2026-01-01',
      setValue: jest.fn(),
      setPage: jest.fn(),
      setShowPicker,
      DateTimePickerAndroid,
      fromYmd: (v) => new Date(`${v}T00:00:00`),
      toYmd,
    });

    open();

    expect(DateTimePickerAndroid.open).toHaveBeenCalledTimes(1);
    expect(setShowPicker).not.toHaveBeenCalled();
  });
});
