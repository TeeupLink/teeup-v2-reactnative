# 강제 업데이트 (업데이트 안 하면 못 쓰게)

## 왜 만들었나

스토어에 새 버전을 올려도 옛 버전을 쓰는 기기를 막을 방법이 없었다.
2026-09-27 빌드를 쓰던 기기에 노션 주소 변경(`jungeui` → `justicelab`)이
반영되지 않았는데, 고칠 수단이 하나도 없었다.

- OTA(expo-updates)로도 못 고친다. 그 빌드에는 `updates` 설정 자체가 없어
  업데이트를 확인하지 않는다.
- 스토어에 새 버전이 있다고 알려 줄 통로도 없었다.

## 동작

앱이 **켜질 때**와 **포그라운드로 돌아올 때** `GET /api/v1/app/version` 을
부른다. 자기 네이티브 버전이 `minimum_version` 보다 낮으면 닫을 수 없는
안내를 띄우고 스토어로 보낸다.

```
GET /api/v1/app/version?platform=ios&version=1.0.1

{
  "platform": "ios",
  "current_version": "1.0.1",
  "minimum_version": "1.0.2",
  "latest_version": "1.0.2",
  "store_url": "itms-apps://apps.apple.com/kr/app/id6801782217",
  "store_web_url": "https://apps.apple.com/kr/app/id6801782217",
  "update_required": true,
  "message": ""
}
```

인증이 없다. 막힌 사용자는 로그인조차 못 하는 상태일 수 있다.

## 차단을 거는 방법

**코드 배포가 필요 없다.** Cloud Run 환경변수만 바꾼다.

| 환경변수 | 기본값 | 뜻 |
| --- | --- | --- |
| `APP_MIN_VERSION_IOS` | `0.0.0` | 이 버전보다 낮은 iOS 앱을 막는다 |
| `APP_MIN_VERSION_ANDROID` | `0.0.0` | 이 버전보다 낮은 안드로이드 앱을 막는다 |
| `APP_LATEST_VERSION_IOS` | (빈값) | 안내에 "최신 x.y.z" 로 표시 |
| `APP_LATEST_VERSION_ANDROID` | (빈값) | 같음 |
| `APP_STORE_URL_IOS` | `itms-apps://...id6801782217` | App Store 앱을 바로 띄우는 스킴 |
| `APP_STORE_URL_ANDROID` | `market://details?id=com.pixencrew.teeup` | Play 스토어 스킴 |
| `APP_STORE_WEB_URL_IOS` | `https://apps.apple.com/...` | 스킴이 실패할 때 대체 |
| `APP_STORE_WEB_URL_ANDROID` | `https://play.google.com/...` | 같음 |
| `APP_UPDATE_MESSAGE` | (빈값) | 안내 문구 교체. 비우면 앱 기본 문구 |

예: 1.0.3 을 올린 뒤 1.0.2 이하를 막으려면
`APP_MIN_VERSION_IOS=1.0.3`, `APP_MIN_VERSION_ANDROID=1.0.3`.

**기본값 `0.0.0` 은 아무도 막지 않는다.** 이 기능을 배포하는 것만으로
누가 잠기는 일이 없게 한 것이다. 막을 때가 되면 값을 올린다.

## 이 설계에서 일부러 지킨 것

**실패하면 통과시킨다.** 서버가 죽었거나, 네트워크가 없거나, 응답이
깨졌거나, 버전 문자열을 못 읽으면 **막지 않는다.** 차단을 잘못 걸면
사용자는 앱을 아예 못 쓰고, 그 기기를 원격으로 풀어 줄 방법이 없다.
느슨해서 몇 명이 옛 버전을 더 쓰는 쪽이 훨씬 싸다.

**네이티브 버전을 본다.** `expo-application` 의 `nativeApplicationVersion`
(Info.plist / AndroidManifest)이다. `app.json` 의 `version` 이나
`expoConfig.version` 을 보면 안 된다 — OTA 가 그 값을 바꿔치기해서 스토어가
아는 버전과 어긋난다. 우리는 사용자를 스토어로 보낼 판단을 하는 것이므로
스토어가 아는 버전을 봐야 한다.

**판정은 서버가 한다.** 앱마다 비교 로직을 다시 구현하면 어긋난다.
앱에도 같은 규칙이 있지만(서버가 `update_required` 를 안 줄 때 대비),
두 구현은 같은 20개 케이스로 검증한다.

**버전 비교는 자리별 숫자로 한다.** 문자열로 비교하면 `1.0.10 < 1.0.9` 로
뒤집혀서 **최신 버전 사용자가 잠긴다.**

**웹은 대상이 아니다.** 항상 최신이 서빙된다.

## 한계 (중요)

이 차단은 **이 코드가 들어간 앱 버전부터만** 동작한다. 그보다 낮은
버전에는 확인하는 코드가 없어 **영원히 막을 수 없다.** 지금 1.0.2 이하를
쓰는 기기는 이 기능으로 못 막는다. 1.0.3(이 코드가 처음 들어간 버전)
이후부터 유효하다.

## 곁딸린 변경

앱이 모든 API 요청에 `X-App-Version` 헤더를 보낸다. 백엔드
`utils/activity.py` 가 여태 이 헤더를 읽어 활동 로그에 적고 있었는데 앱이
보내지 않아 늘 비어 있었다. 어떤 버전이 실제로 돌아다니는지 모르면 최소
버전을 어디에 걸지 정할 수 없다.

## 파일

| 파일 | 역할 |
| --- | --- |
| `teeup-v2-backend/routers/app_version.py` | `GET /app/version` |
| `teeup-v2-backend/utils/app_version.py` | 버전 비교 (서버) |
| `teeup-v2-backend/config.py` | 환경변수 |
| `src/lib/appVersion.js` | 네이티브 버전 읽기, 비교, 스토어 열기 |
| `src/components/layout/ForceUpdateGate.js` | 차단 화면 |
| `src/lib/api/api.js` | `appApi.getVersionPolicy` |
| `app/_layout.js` | 게이트 마운트 |
| `__tests__/app-version.test.js` | 비교 규칙 |
| `__tests__/force-update-gate.test.js` | 차단·통과 동작 |

## 테스트

```bash
# 앱
npx jest __tests__/app-version.test.js __tests__/force-update-gate.test.js

# 실제로 막히는지 보려면 로컬 백엔드에 환경변수를 주고 앱을 띄운다
APP_MIN_VERSION_ANDROID=99.0.0 uvicorn main:app
```
