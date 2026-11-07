# iOS App Store 업로드 가이드

대상: `teeup-v2-reactnative` (Expo SDK 54 / RN 0.81.5)
최종 갱신: 2026-08-30

---

## 0. 현재 상태 (2026-08-30 기준)

### 이미 끝난 것

| 항목 | 상태 |
| --- | --- |
| Apple Developer Program | ✅ 가입·승인 완료 (`ejto100@gmail.com`) |
| `GoogleService-Info.plist` | ✅ 루트에 존재, **git 커밋 완료** |
| `app.json` → `ios` 블록 | ✅ bundleId / buildNumber / googleServicesFile / `ITSAppUsesNonExemptEncryption` / `usesAppleSignIn` |
| google-signin 플러그인 `iosUrlScheme` | ✅ 설정됨 |
| Sign in with Apple (Guideline 4.8) | ✅ 구현 완료 — `src/lib/util/authUtils.js:141`, `app/login.js:118` |
| 계정 삭제 (Guideline 5.1.1(v)) | ✅ `app/(tabs)/mypage/withdraw.js` |
| 심사용 리뷰어 계정 (Guideline 2.1) | ✅ `app/reviewer-login.js` — 로그인 화면 로고 **7번 탭**으로 진입 |
| `eas.json` | ✅ 생성됨 (Apple 식별자 3개는 placeholder — 3단계 참고) |

### 아직 남은 것

| 항목 | 상태 |
| --- | --- |
| `eas-cli` 설치 / `eas login` / `eas init` | ❌ |
| `extra.eas.projectId` (app.json) | ❌ `eas init`이 주입 |
| EAS 환경변수 등록 | ❌ **필수** — 4단계 참고 |
| Apple Identifier capability (Push, Sign in with Apple) | ❓ 확인 필요 |
| App Store Connect 앱 레코드 / `ascAppId` | ❓ 확인 필요 |
| 백엔드 `APPLE_BUNDLE_ID` + `provider` enum 마이그레이션 | ❓ 확인 필요 — 7단계 |

### 전제 조건

**개발 머신이 Linux라 Xcode를 쓸 수 없다. iOS는 EAS 클라우드 빌드가 유일한 경로다.**
(대안은 macOS 장비 확보 후 `npx expo prebuild -p ios` → Xcode Archive.)

`ios/` 네이티브 폴더는 없다. CNG(Continuous Native Generation) 방식이라 정상이며,
EAS가 빌드 시점에 `expo prebuild`를 자동 수행한다.

---

## 1. Apple Developer 포털 점검

Certificates, Identifiers & Profiles → Identifiers → `com.pixencrew.teeup`

두 capability가 **반드시** 켜져 있어야 한다.

- **Push Notifications** — `expo-notifications` + `@react-native-firebase/messaging` 사용
- **Sign in with Apple** — 빠지면 Apple 로그인이 런타임에 실패한다

Team ID는 Membership 페이지 우측 상단의 10자리 문자열이다. (`eas.json`에 필요)

---

## 2. App Store Connect 앱 레코드

이미 만들어 두었다면 건너뛴다.

- 플랫폼: iOS
- 번들 ID: `com.pixencrew.teeup`
- 앱 이름: `티업링크` (App Store 전역에서 중복 불가 — 선점되어 있으면 변경 필요)
- SKU: 임의 문자열 (예: `teeup-ios`)

생성 후 App Information 페이지에서 **Apple ID(숫자 10자리)** 를 확인한다.
이 값이 `eas.json`의 `ascAppId`다.

---

## 3. EAS CLI 설치 및 프로젝트 연결

```bash
cd teeup-v2-reactnative
npm i -g eas-cli
eas login                 # ejto100@gmail.com 이 아니라 expo.dev 계정
eas init                  # app.json에 extra.eas.projectId 주입
```

그리고 `eas.json`의 placeholder 2개를 채운다.

```jsonc
"submit": {
  "production": {
    "ios": {
      "appleId": "ejto100@gmail.com",
      "ascAppId": "<2단계에서 확인한 숫자 ID>",
      "appleTeamId": "<1단계에서 확인한 10자리 Team ID>"
    }
  }
}
```

> **버전 관리 메모**
> `eas.json`은 `appVersionSource: "remote"` + `production.autoIncrement: true`로 되어 있다.
> `buildNumber`를 EAS 서버가 관리하며 빌드마다 자동 증가시키므로 수동으로 올릴 필요가 없다.
> `"local"`을 쓰지 않는 이유: 이 프로젝트는 `app.config.js`(동적 config)를 사용하는데,
> EAS는 동적 config에 버전을 되써 넣지 못해 autoIncrement가 동작하지 않는다.
> 사용자에게 보이는 버전 문자열(`version: "1.0.2"`)은 계속 `app.json`에서 온다.

---

## 4. ⚠️ 환경변수 반입 — 가장 흔한 실패 지점

`app.config.js`는 빌드 시점에 `dotenv`로 `.env`를 읽는다.
그런데 `.gitignore` 35행의 `.env*` 규칙 때문에 **`.env`는 EAS 클라우드에 올라가지 않는다.**

조치 없이 빌드하면 다음 경고가 뜨면서 **Google 로그인이 죽은 채로 IPA가 만들어진다.**

```
⚠️ Warning: Missing env var: EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS
```

### 방법 A — EAS 환경변수 (권장)

`.env`의 실제 값으로 6개를 등록한다.

```bash
eas env:create --name EXPO_PUBLIC_API_BASE_URL            --value "..."  --environment production
eas env:create --name EXPO_PUBLIC_API_VERSION             --value "v1"   --environment production
eas env:create --name EXPO_PUBLIC_WEB_ORIGIN              --value "..."  --environment production
eas env:create --name EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS    --value "..."  --environment production
eas env:create --name EXPO_PUBLIC_GOOGLE_REDIRECT_URI_IOS --value "..."  --environment production
eas env:create --name EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB    --value "..."  --environment production
```

등록 확인:

```bash
eas env:list --environment production
```

### 방법 B — `.easignore`

`.easignore` 파일을 만들면 EAS는 `.gitignore` 대신 이 파일을 기준으로 업로드 대상을 정한다.
즉 `.env`, `google-services.json` 등 gitignore된 파일을 **커밋하지 않고** 클라우드에 보낼 수 있다.

`.gitignore` 내용을 복사한 뒤 아래 줄들을 **제거**하고, 무거운 디렉터리는 반드시 남긴다.

```
# .easignore — 제거할 줄
.env*
google-services.json
metro.config.js
adi-registration.properties

# 반드시 유지해야 할 줄 (없으면 업로드 아카이브가 폭증)
node_modules/
dist/
.expo/
android/app/build/
```

방법 A가 실수 여지가 적어 권장된다. 방법 B는 CI 없이 혼자 빠르게 돌릴 때만 쓴다.

### 참고: 커밋 상태

EAS Build는 git 추적 파일만 업로드한다. 빌드 전에 `git status`로
`app.json`, `src/lib/util/authUtils.js`, `app/login.js` 등 iOS 관련 변경분이
**커밋되어 있는지 반드시 확인**한다. `eas build`가 미커밋 변경을 감지하면
커밋 여부를 물어보는데, 여기서 Abort하면 이전 상태로 빌드된다.

> `metro.config.js`는 `.gitignore`에 있어 클라우드에 올라가지 않는다.
> 이 파일은 minify/난독화를 끄는 설정이므로, EAS 빌드에서는 Expo 기본
> (minify 켜짐) 설정이 적용된다. 프로덕션에는 오히려 바람직하다.
>
> `adi-registration.properties`와 `withAdiRegistration` 플러그인은
> android 플랫폼에서만 동작하므로 iOS 빌드에 영향이 없다.

---

## 5. 자격증명 (인증서 / 프로비저닝 / APNs)

EAS가 자동 처리한다. 첫 빌드에서 Apple 로그인을 요구하며
Distribution Certificate, Provisioning Profile, APNs Key를 생성해 보관한다.

```bash
eas credentials -p ios     # 수동 확인/관리가 필요할 때
```

2단계 인증이 걸리므로 **아이폰을 옆에 두고** 진행한다.
App-specific password를 미리 만들어두면 더 매끄럽다.

---

## 6. 빌드 → 제출

```bash
# (선택) 내부 테스트용
eas build -p ios --profile preview

# App Store 제출용
eas build -p ios --profile production

# 업로드
eas submit -p ios --latest
```

무료 플랜은 대기열 때문에 30분~수 시간이 걸릴 수 있다.
업로드 후 App Store Connect의 처리(Processing)에 추가로 10~30분.

---

## 7. 백엔드 선반영 (빌드 전에 해둘 것)

Apple 로그인이 서버에서 받아지려면 두 가지가 필요하다.

1. 환경변수 — 없으면 Apple 로그인이 400으로 실패한다.
   ```
   APPLE_BUNDLE_ID=com.pixencrew.teeup
   ```
2. DB enum 마이그레이션 (alembic 미사용이므로 수동 실행)
   ```sql
   ALTER TABLE users
     MODIFY COLUMN provider ENUM('LOCAL','GOOGLE','APPLE') DEFAULT 'LOCAL';
   ```
3. `pip install -r requirements.txt` — RS256 검증용 `cryptography` 신규 의존성

---

## 8. TestFlight 검증

실기기에서 아래 3개는 **반드시** 확인한다. 심사 리젝의 대부분이 여기서 나온다.

- [ ] Google 로그인
- [ ] **Apple 로그인** (1단계 capability + 7단계 백엔드가 모두 되어 있어야 성공)
- [ ] 푸시 알림 수신
- [ ] 리뷰어 로그인 진입 (로고 7번 탭 → `/reviewer-login`)
- [ ] 계정 삭제 플로우

> Firebase 프로젝트(`668486530275`)와 Google OAuth 클라이언트 프로젝트(`791884628850`)가
> 서로 달라서 `GoogleService-Info.plist`에 `CLIENT_ID` / `REVERSED_CLIENT_ID`가 없다.
> `authUtils.js`에서 `iosClientId`를 env로 직접 주입해 우회하고 있다.
> 따라서 `EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS`가 EAS에 등록되지 않으면 Google 로그인이 조용히 실패한다.

---

## 9. 심사 제출 준비물

- 스크린샷: 6.9"(iPhone 16 Pro Max) 필수, 6.5" 권장 — 각 최소 3장
- 앱 설명 / 키워드 / 프로모션 텍스트
- **개인정보처리방침 URL** (필수)
- 지원(Support) URL
- 연령 등급 설문
- **심사용 데모 계정** — `docs/reviewer-access.md` 참고
  - `reviewer@teeup.run` / `reviewer1234!`
  - App Review Information의 Notes에 **"로그인 화면 로고를 7번 탭하면 리뷰어 로그인 화면으로 이동"** 을 반드시 기재할 것. 안 적으면 심사자가 진입 방법을 몰라 2.1로 리젝된다.
- App Privacy 신고 — 앱이 실제로 수집하는 항목과 일치해야 함

---

## 10. 예상 리젝 사유 대응 현황

| Guideline | 내용 | 대응 |
| --- | --- | --- |
| 4.8 | 제3자 소셜 로그인 제공 시 Sign in with Apple도 필수 | ✅ 구현 완료 |
| 5.1.1(v) | 계정 생성 가능 앱은 앱 내 계정 삭제 제공 | ✅ 구현 완료 |
| 2.1 | 데모 계정 미제공 / 로그인 실패 | ✅ 리뷰어 계정 — 단, 진입 방법 기재 필수 |
| 5.1.1 | 개인정보처리방침 URL 누락, App Privacy 불일치 | ❓ 제출 시 확인 |
| 2.3.x | 스크린샷이 실제 앱과 불일치 | ❓ 제출 시 확인 |

---

## 11. 실행 체크리스트

```
[ ] 1. Apple Identifier에 Push + Sign in with Apple capability 확인
[ ] 2. App Store Connect 앱 레코드 생성 → ascAppId 확보
[ ] 3. npm i -g eas-cli && eas login && eas init
[ ] 4. eas.json의 ascAppId / appleTeamId placeholder 교체
[ ] 5. eas env:create ×6 (production)
[ ] 6. 백엔드 APPLE_BUNDLE_ID + provider enum 마이그레이션 + 배포
[ ] 7. git status 확인 후 iOS 관련 변경분 전부 커밋
[ ] 8. eas build -p ios --profile production
[ ] 9. eas submit -p ios --latest
[ ] 10. TestFlight에서 Google/Apple 로그인·푸시 검증
[ ] 11. 스크린샷·개인정보처리방침·데모 계정 안내 작성 후 심사 제출
```
