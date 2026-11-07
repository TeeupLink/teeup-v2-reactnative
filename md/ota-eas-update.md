# OTA(EAS Update) 도입 가이드

작성일: 2026-09-24

스토어 심사 없이 JS·UI 변경을 즉시 배포하기 위한 설정. **한 번은 양 스토어에 새 빌드를 올려 심사를 받아야 하고**,
그 이후부터 JS 변경은 `eas update` 한 줄로 배포된다.

---

## 0. 지금까지 된 것 / 남은 것

| 항목 | 상태 |
| --- | --- |
| `expo-updates` 의존성 추가 | ☑ (`~29.0.20`) |
| `app.json` 에 `runtimeVersion` (`appVersion` 정책) | ☑ |
| `app.json` 에 `updates.url` | ☑ `https://u.expo.dev/e3e81f6c-8e50-40e3-a2dd-f5364afa2205` |
| Expo 프로젝트 | ☑ `jungeuilab/teeup` — projectId `e3e81f6c-8e50-40e3-a2dd-f5364afa2205` |
| `eas.json` 채널 (development / preview / production) | ☑ |
| iOS 새 빌드 심사 | ☐ |
| Android 새 빌드 심사 | ☐ |

`runtimeVersion` 정책이 `appVersion` 이므로 **`expo.version` 이 같은 빌드끼리만** OTA 가 붙는다.
네이티브 변경(모듈 추가·권한 변경·SDK 업)을 하면 `version` 을 올리고 스토어 빌드를 새로 올려야 한다.

---

## 1. Expo 계정 연결 — 완료 (2026-09-24)

`app.json` 에 아래가 들어가 있다. 다시 실행할 필요 없다.

```json
"owner": "jungeuilab",
"extra": { "eas": { "projectId": "e3e81f6c-8e50-40e3-a2dd-f5364afa2205" } },
"runtimeVersion": { "policy": "appVersion" },
"updates": { "url": "https://u.expo.dev/e3e81f6c-8e50-40e3-a2dd-f5364afa2205", ... }
```

CLI 를 쓸 때는 대화형 로그인 대신 토큰을 쓴다.

```bash
EXPO_TOKEN=<expo.dev 에서 발급한 토큰> npx eas-cli <명령>
```

> `eas init` 은 **평가된** 설정을 `app.json` 에 그대로 써넣는다.
> 이 저장소는 `app.config.js` 가 플랫폼별로 `extra` 를 다시 계산하므로
> (안드로이드/ iOS Google OAuth 클라이언트 ID 가 다르다),
> `app.json` 의 `extra` 에는 **`eas.projectId` 만** 남겨야 한다.
> 실제로 `eas init` 이 안드로이드 값으로 덮어써서 되돌린 이력이 있다.

---

## 2. 네이티브 반영

### iOS

`ios/` 는 gitignore 대상이라 prebuild 로 재생성한다.

```bash
npm run ios:prebuild
cd ios && pod install && cd ..
```

`ios/app/Supporting/Expo.plist` 에 아래가 들어갔는지 확인한다. (prebuild 가 자동 생성)

| 키 | 값 |
| --- | --- |
| `EXUpdatesEnabled` | `true` |
| `EXUpdatesURL` | `https://u.expo.dev/<projectId>` |
| `EXUpdatesRuntimeVersion` | `1.0` (= expo.version) |

> prebuild 를 돌리면 Xcode Team 설정과 `app-release.entitlements` 가 사라진다.
> `md/ios-appstore-progress.md` 의 "올바른 빌드 명령" 절차를 다시 따를 것.

### Android

`android/` 는 대부분 gitignore 대상이고 (`build.gradle` 2개와 `gradle.properties` 만 추적),
`AndroidManifest.xml` 은 **빌드 머신에서 prebuild 로 생성된다.**
따라서 빌드 전에 최신 `app.json` 을 pull 한 뒤 prebuild 를 **다시** 돌려야 업데이트 설정이 반영된다.

```bash
git pull
npx expo prebuild -p android
grep expo.modules.updates android/app/src/main/AndroidManifest.xml
```

아래 meta-data 가 `<application>` 안에 있어야 한다.

```xml
<meta-data android:name="expo.modules.updates.ENABLED" android:value="true"/>
<meta-data android:name="expo.modules.updates.EXPO_UPDATE_URL" android:value="https://u.expo.dev/e3e81f6c-8e50-40e3-a2dd-f5364afa2205"/>
<meta-data android:name="expo.modules.updates.EXPO_RUNTIME_VERSION" android:value="@string/expo_runtime_version"/>
<meta-data android:name="expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH" android:value="ALWAYS"/>
```

> `android/app/debug.keystore` 도 prebuild 가 머신마다 새로 만드는 파일이라 저장소에 없다.
> Play 업로드 키가 아니다.

---

## 3. 스토어 빌드 (각 1회 심사)

### iOS

`md/ios-appstore-progress.md` 의 아카이브 → export → altool 절차 그대로.
`expo.version` 1.0 유지, `ios.buildNumber` 만 올린다.

### Android

이 맥에는 **JDK·Android SDK·업로드 키스토어가 없다.** 본서버(또는 원래 빌드하던 머신)에서 진행한다.

```bash
# credentials/teeup-upload.jks 와 아래 환경변수가 필요하다
export ANDROID_UPLOAD_STORE_PASSWORD=...
export ANDROID_UPLOAD_KEY_ALIAS=...
export ANDROID_UPLOAD_KEY_PASSWORD=...

cd android && ./gradlew bundleRelease
# 산출물: android/app/build/outputs/bundle/release/app-release.aab
```

`android.versionCode` 를 올린 뒤 Play Console 에 업로드한다. (현재 3)

EAS 로 굽는 쪽이 편하면:

```bash
npx eas-cli build -p android --profile production
```

---

## 4. 이후 OTA 배포

```bash
npx eas-cli update --branch production --message "무엇을 고쳤는지"
```

- 사용자가 앱을 켤 때 새 JS 번들을 내려받아 다음 실행부터 반영된다.
- **OTA 로 되는 것**: JS/TS 로직, UI, 스타일, 번들에 포함된 이미지·폰트
- **OTA 로 안 되는 것**: 네이티브 모듈 추가·제거, 권한 변경, `app.json` 의 네이티브 설정, Expo SDK 업그레이드
- Apple 3.3.1 / Google 정책 모두 **앱의 주요 목적을 바꾸지 않는** 범위에서만 허용한다.

### 주의

- EAS Update 무료 플랜은 월간 활성 사용자 수 제한이 있다. 초과하면 유료 플랜 또는 자체 호스팅(`expo-updates` 는 임의의 URL 을 지원)으로 전환한다.
- 롤백은 `eas update:rollback` 또는 이전 업데이트를 다시 퍼블리시하는 방식으로 한다.
