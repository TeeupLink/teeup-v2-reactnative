/**
 * @jest-environment jsdom
 */

/**
 * 웹 날짜 선택기(openWebDateInput).
 *
 * 예전 구현의 문제:
 *   1. showPicker() 를 setTimeout(100) 안에서 불렀다. showPicker 는 사용자
 *      제스처(transient activation)가 살아 있을 때만 허용되므로, 타이머로
 *      미루면 거부하는 브라우저가 있다. 그 경우 대체 경로는 프로그램적
 *      input.click() 인데 그건 날짜 선택기를 열지 못한다.
 *   2. 무슨 일이 있어도 true 를 돌려줬다. 그래서 호출자의 didOpen 검사가
 *      무의미했고, 실패하면 console.warn 만 남아 사용자에게는 "눌렀는데
 *      아무 일도 안 일어난다" 였다.
 *   3. min/max 를 걸 수단이 max 쪽에 없어 미래 날짜도 고를 수 있었다.
 */
import { openWebDateInput } from '@/lib/handler/mypage';

const INPUT_ID = 'web-date-input-temp';
const el = () => document.getElementById(INPUT_ID);

describe('openWebDateInput', () => {
  let showPicker;

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '';
    showPicker = jest.fn();
    window.HTMLInputElement.prototype.showPicker = showPicker;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    delete window.HTMLInputElement.prototype.showPicker;
  });

  it('사용자 제스처를 잃지 않도록 showPicker 를 동기로 부른다', () => {
    // 타이머를 한 번도 돌리지 않은 시점에 이미 불려 있어야 한다
    const opened = openWebDateInput({ value: '1975-03-09', onChange: jest.fn() });

    expect(showPicker).toHaveBeenCalledTimes(1);
    expect(opened).toBe(true);
  });

  it('넘긴 min/max 를 input 에 건다', () => {
    openWebDateInput({
      value: '1975-03-09',
      min: '1900-01-01',
      max: '2012-11-18',
      onChange: jest.fn(),
    });

    expect(el().min).toBe('1900-01-01');
    expect(el().max).toBe('2012-11-18');
    expect(el().type).toBe('date');
    expect(el().value).toBe('1975-03-09');
  });

  it('고른 값을 onChange 로 넘긴다', () => {
    const onChange = jest.fn();
    openWebDateInput({ value: '', onChange });

    el().value = '1975-03-09';
    el().onchange({ target: el() });

    expect(onChange).toHaveBeenCalledWith('1975-03-09');
  });

  it('같은 선택을 두 번 흘려보내지 않는다', () => {
    const onChange = jest.fn();
    openWebDateInput({ value: '', onChange });

    const input = el();
    input.value = '1975-03-09';
    input.onchange({ target: input });
    input.onchange({ target: input });

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  // 실제 브라우저(Playwright/Chromium)로 확인한 내용의 회귀 방지.
  // 예전에는 pointerEvents 가 'auto' 라서, showPicker 로 열고 사용자가
  // 고르지 않고 닫으면(onblur 가 오지 않으므로 cleanup 도 안 돌았다)
  // 투명한 input 이 60초 동안 생년월일 필드를 덮었다. 그동안 필드를
  // 눌러도 아무 일도 일어나지 않았다 — 제보된 "선택이 안 된다".
  describe('숨은 input 이 필드를 가리지 않는다', () => {
    it('showPicker 로 열었으면 클릭을 받지 않는다', () => {
      openWebDateInput({ value: '', onChange: jest.fn() });
      expect(el().style.pointerEvents).toBe('none');
    });

    it('아래에 있는 필드가 계속 클릭을 받는다', () => {
      const field = document.createElement('button');
      field.id = 'field';
      const onFieldClick = jest.fn();
      field.addEventListener('click', onFieldClick);
      document.body.appendChild(field);

      openWebDateInput({
        value: '',
        anchorRect: { left: 0, top: 0, width: 200, height: 44 },
        onChange: jest.fn(),
      });

      field.click();
      expect(onFieldClick).toHaveBeenCalledTimes(1);
    });

    it('다음 누름에 스스로 치운다 (60초까지 남지 않는다)', () => {
      openWebDateInput({ value: '', onChange: jest.fn() });
      expect(el()).not.toBeNull();

      // jsdom 에는 PointerEvent 생성자가 없다. 이름만 같으면 리스너는 돈다.
      document.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
      jest.advanceTimersByTime(100);

      expect(el()).toBeNull();
    });
  });

  describe('showPicker 를 쓸 수 없는 브라우저', () => {
    it('showPicker 가 던지면 입력란을 눈에 보이게 남긴다', () => {
      showPicker.mockImplementation(() => {
        throw new Error('NotAllowedError');
      });

      const opened = openWebDateInput({ value: '', onChange: jest.fn() });

      // 숨긴 채로 두면 사용자에게는 아무 일도 안 일어난 것과 같다
      expect(opened).toBe(true);
      expect(el()).not.toBeNull();
      expect(el().style.opacity).toBe('1');
      expect(el().tabIndex).toBe(0);
      // 이 경로에서는 사용자가 이 입력란을 직접 눌러야 하므로 클릭을 받아야 한다
      expect(el().style.pointerEvents).toBe('auto');
    });

    it('showPicker 가 아예 없어도 입력란을 보여 준다', () => {
      delete window.HTMLInputElement.prototype.showPicker;

      const opened = openWebDateInput({ value: '', onChange: jest.fn() });

      expect(opened).toBe(true);
      expect(el().style.opacity).toBe('1');
    });

    it('열 방법이 전혀 없으면 false 를 돌려주고 input 을 치운다', () => {
      delete window.HTMLInputElement.prototype.showPicker;
      const focusSpy = jest
        .spyOn(window.HTMLInputElement.prototype, 'focus')
        .mockImplementation(() => {
          throw new Error('focus 불가');
        });

      const opened = openWebDateInput({ value: '', onChange: jest.fn() });

      expect(opened).toBe(false);   // 호출자가 사용자에게 알릴 수 있어야 한다
      jest.advanceTimersByTime(100);
      expect(el()).toBeNull();

      focusSpy.mockRestore();
    });
  });

  it('createElement 가 없는 환경에서는 아무것도 하지 않고 false 를 돌려준다', () => {
    const original = document.createElement;
    Object.defineProperty(document, 'createElement', { value: undefined, configurable: true });
    try {
      expect(openWebDateInput({ value: '', onChange: jest.fn() })).toBe(false);
    } finally {
      Object.defineProperty(document, 'createElement', { value: original, configurable: true });
    }
    // 복원됐는지 확인 (뒤 테스트가 이것 때문에 깨지면 원인 찾기 어렵다)
    expect(typeof document.createElement).toBe('function');
  });
});
