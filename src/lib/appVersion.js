import * as Application from 'expo-application';
import { Linking, Platform } from 'react-native';

/**
 * 앱 강제 업데이트에 쓰는 버전 유틸.
 *
 * 비교 대상은 "네이티브" 버전(Info.plist / AndroidManifest)이다.
 * app.json 의 version 이나 expoConfig.version 을 보면 안 된다 - OTA
 * 업데이트가 그 값을 바꿔치기할 수 있어서, 스토어에서 받은 실제 바이너리
 * 버전과 어긋난다. 우리는 사용자를 스토어로 보낼 판단을 하는 것이므로
 * 스토어가 아는 버전을 봐야 한다.
 */

/** 이 기기에 설치된 네이티브 앱 버전. 웹이나 못 읽으면 null. */
export function getNativeAppVersion() {
  if (Platform.OS === 'web') return null;
  return Application.nativeApplicationVersion || null;
}

/** 서버에 보낼 플랫폼 문자열. 백엔드가 ios / android / web 을 안다. */
export function getPlatformKey() {
  return Platform.OS === 'web' ? 'web' : Platform.OS;
}

function parseVersion(value) {
  if (typeof value !== 'string') return null;

  const parts = [];
  for (const chunk of value.trim().split('.')) {
    const match = /^\d+/.exec(chunk);
    if (!match) break;
    parts.push(Number(match[0]));
  }

  return parts.length ? parts : null;
}

/**
 * current 가 minimum 보다 낮을 때만 true.
 *
 * 둘 중 하나라도 못 읽으면 false - 판단이 안 서면 막지 않는다. 차단을
 * 잘못 걸면 사용자는 앱을 아예 못 쓰고, 그 상태를 원격으로 풀어 줄
 * 방법이 없다. 서버도 같은 규칙으로 판정한다(utils/app_version.py).
 */
export function isOutdated(current, minimum) {
  const a = parseVersion(current);
  const b = parseVersion(minimum);
  if (!a || !b) return false;

  const width = Math.max(a.length, b.length);
  for (let i = 0; i < width; i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left < right) return true;
    if (left > right) return false;
  }
  return false;
}

/**
 * 스토어를 연다. 스킴(itms-apps / market)이 실패하면 https 주소로 넘긴다.
 *
 * canOpenURL 로 미리 확인하지 않는다 - iOS 는 Info.plist 의
 * LSApplicationQueriesSchemes 에 등록된 스킴만 확인해 주므로, 등록이
 * 없으면 열 수 있는 주소에도 false 가 돌아온다. 그냥 열어 보고 실패하면
 * 넘기는 쪽이 확실하다.
 */
export async function openStore(storeUrl, storeWebUrl) {
  const candidates = [storeUrl, storeWebUrl].filter(Boolean);

  for (const url of candidates) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // 다음 후보로 넘어간다.
    }
  }

  return false;
}
