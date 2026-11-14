import { isOutdated } from '@/lib/appVersion';

/**
 * 강제 업데이트 버전 비교.
 *
 * 이 비교가 틀리면 결과가 한쪽으로 심하게 치우친다. 느슨하면 아무도
 * 안 막히고, 빡세면 최신 버전 사용자까지 잠겨서 앱을 못 쓴다. 후자는
 * 원격으로 풀 방법이 없으므로 "모르면 막지 않는다"를 반드시 지킨다.
 *
 * 서버의 utils/app_version.py 와 같은 규칙이어야 한다.
 */
describe('isOutdated', () => {
  it('현재 버전이 최소 버전보다 낮으면 막는다', () => {
    expect(isOutdated('1.0.1', '1.0.2')).toBe(true);
    expect(isOutdated('0.9.9', '1.0.0')).toBe(true);
    expect(isOutdated('1.0.0', '1.1.0')).toBe(true);
  });

  it('같거나 높으면 막지 않는다', () => {
    expect(isOutdated('1.0.2', '1.0.2')).toBe(false);
    expect(isOutdated('1.0.3', '1.0.2')).toBe(false);
    expect(isOutdated('2.0.0', '1.9.9')).toBe(false);
  });

  it('문자열 비교가 아니라 자리별 숫자로 본다', () => {
    // 문자열로 비교하면 "1.0.10" < "1.0.9" 로 뒤집혀서 최신 사용자가 잠긴다.
    expect(isOutdated('1.0.10', '1.0.9')).toBe(false);
    expect(isOutdated('1.0.9', '1.0.10')).toBe(true);
    expect(isOutdated('1.10.0', '1.9.0')).toBe(false);
  });

  it('자리 수가 달라도 짧은 쪽을 0 으로 채워 본다', () => {
    expect(isOutdated('1.0', '1.0.0')).toBe(false);
    expect(isOutdated('1.0', '1.0.1')).toBe(true);
    expect(isOutdated('1.0.0.0', '1.0')).toBe(false);
  });

  it('버전을 못 읽으면 막지 않는다', () => {
    // 여기서 true 가 나오면 사용자가 앱을 아예 못 쓰게 된다.
    expect(isOutdated(null, '1.0.2')).toBe(false);
    expect(isOutdated(undefined, '1.0.2')).toBe(false);
    expect(isOutdated('', '1.0.2')).toBe(false);
    expect(isOutdated('abc', '1.0.2')).toBe(false);
    expect(isOutdated('1.0.1', null)).toBe(false);
    expect(isOutdated('1.0.1', '')).toBe(false);
    expect(isOutdated(123, '1.0.2')).toBe(false);
  });

  it('숫자 뒤 꼬리표는 무시한다', () => {
    expect(isOutdated('1.0.1-beta.3', '1.0.2')).toBe(true);
    expect(isOutdated('1.0.2-rc1', '1.0.2')).toBe(false);
  });
});
