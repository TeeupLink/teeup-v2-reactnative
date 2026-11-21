/**
 * 생년월일 선택기 동작 (RUN: 회원가입 시 생년월일 선택 불가 수정).
 *
 * 왜 이 테스트가 있나:
 *   iOS 스피너는 인라인으로 뜨고 굴리는 동안 onChange 가 계속 온다.
 *   예전 구현은 (1) iOS 에서 setShowBirthPicker(false) 를 아예 부르지 않아
 *   한 번 열면 닫을 길이 없었고, (2) 매 onChange 마다 formData 를 갱신해
 *   제어값이 다시 내려가면서 스피너가 제자리로 튕겼다. 둘이 합쳐져
 *   "생년월일 선택이 안 된다" 로 보고됐다.
 *
 *   그래서 iOS 는 초안(draft)만 바꾸고, 값 확정과 닫기는 '확인' 버튼이 한다.
 *   Android 는 대화상자라서 예전처럼 onChange 에서 닫고 바로 확정한다.
 */
import { Platform } from 'react-native';

import { createBirthPickerChangeHandler } from '@/lib/handler/mypage';

describe('createBirthPickerChangeHandler', () => {
  const originalOS = Platform.OS;
  const picked = new Date(1990, 4, 17); // 1990-05-17

  let setShowBirthPicker;
  let handleInputChange;
  let setBirthDraft;

  const makeHandler = () =>
    createBirthPickerChangeHandler({ setShowBirthPicker, handleInputChange, setBirthDraft });

  beforeEach(() => {
    setShowBirthPicker = jest.fn();
    handleInputChange = jest.fn();
    setBirthDraft = jest.fn();
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  describe('iOS', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
    });

    it('스피너를 굴려도 선택기를 닫지 않는다 (확인 버튼이 닫는다)', () => {
      makeHandler()({ type: 'set' }, picked);
      expect(setShowBirthPicker).not.toHaveBeenCalled();
    });

    it('formData 를 건드리지 않아 스피너가 튕기지 않는다', () => {
      makeHandler()({ type: 'set' }, picked);
      expect(handleInputChange).not.toHaveBeenCalled();
    });

    it('고른 값을 초안에 담는다', () => {
      makeHandler()({ type: 'set' }, picked);
      expect(setBirthDraft).toHaveBeenCalledWith(picked);
    });

    it('여러 번 굴리면 마지막 값이 초안에 남는다', () => {
      const handler = makeHandler();
      const later = new Date(1991, 0, 2);
      handler({ type: 'set' }, picked);
      handler({ type: 'set' }, later);
      expect(setBirthDraft).toHaveBeenLastCalledWith(later);
      expect(setShowBirthPicker).not.toHaveBeenCalled();
    });

    it('날짜가 없는 이벤트는 초안을 덮어쓰지 않는다', () => {
      makeHandler()({ type: 'set' }, undefined);
      expect(setBirthDraft).not.toHaveBeenCalled();
    });
  });

  describe('Android', () => {
    beforeEach(() => {
      Platform.OS = 'android';
    });

    it('고르면 닫고 바로 값을 확정한다', () => {
      makeHandler()({ type: 'set' }, picked);
      expect(setShowBirthPicker).toHaveBeenCalledWith(false);
      expect(handleInputChange).toHaveBeenCalledWith('birthdate', '1990-05-17');
    });

    it('취소하면 닫기만 하고 값은 그대로 둔다', () => {
      makeHandler()({ type: 'dismissed' }, undefined);
      expect(setShowBirthPicker).toHaveBeenCalledWith(false);
      expect(handleInputChange).not.toHaveBeenCalled();
    });

    it('이벤트가 없어도 터지지 않는다', () => {
      expect(() => makeHandler()(undefined, picked)).not.toThrow();
      expect(setShowBirthPicker).toHaveBeenCalledWith(false);
    });
  });
});
