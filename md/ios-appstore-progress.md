# iOS App Store 등록 진행 상황

- **최종 업데이트**: 2026-09-09
- **현재 상태**: ✅ **심사 제출 완료** (버전 1.0, 빌드 1)
- **작업 환경**: macOS (Darwin 25.5.0), Xcode 26.6, CocoaPods 1.17.0
- **빌드 방식**: 로컬 Xcode 아카이브 (EAS Build 미사용)

> 같은 폴더의 `ios-app-store-guide.md`는 개발 머신이 Linux이던 시절의 EAS Build 기준
> 문서라 현재와 맞지 않는다. App Store Connect 입력값은 `appstore-metadata.md` 참조.

---

## 1. 프로젝트 기본 정보

| 항목 | 값 |
| --- | --- |
| 번들 ID | `com.pixencrew.teeup` |
| 앱 이름 | 티업링크 |
| Apple ID (앱) | `6801782217` |
| SKU | `teeup-ios` |
| 버전 / 빌드 번호 | `1.0` / `1` |
| 최소 iOS 버전 | 15.1 |
| Apple Team ID | `2ZJV4Y7FV5` (INDIVIDUAL) |
| 연령 등급 | 4+ |
| 카테고리 | 스포츠 / 소셜 네트워킹 |
| Firebase 프로젝트 번호 | `668486530275` |
| Google OAuth 프로젝트 번호 | `791884628850` (Firebase와 다름 — 의도된 구성) |

---

## 2. 최종 성공 경로 (기기 없이 업로드)

**핵심**: iPhone 실기기가 한 대도 없는 상태에서 App Store 업로드에 성공했다.

### 왜 처음에 막혔나

Expo prebuild가 `ios/app.xcodeproj/project.pbxproj`의 **Release 설정에도**
개발용 서명 ID를 하드코딩한다:

```
"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "iPhone Developer";
```

그래서 아카이브가 **iOS App Development** 프로파일을 요구했고, 개발용 프로파일은
Apple 계정에 기기가 최소 1대 등록되어야 발급된다. 기기가 0대라 여기서 실패했다.

```
error: Communication with Apple failed: Your team has no devices from which to
generate a provisioning profile.
```

**중요**: App Store 업로드 자체는 기기가 필요 없다. 배포용(App Store Connect)
프로파일은 기기 목록과 무관하기 때문이다. 개발용 경로로 새어버린 것이 문제였다.

### 실패한 우회

`CODE_SIGN_IDENTITY="Apple Distribution"` 을 명령행으로 덮어쓰기 →
자동 서명 모드에서는 수동 지정이 불가해 거부됨.

```
error: app has conflicting provisioning settings. app is automatically signed for
development, but a conflicting code signing identity Apple Distribution has been
manually specified.
```

### 성공한 방법

**서명 없이 아카이브를 만들고, export 단계에서 배포용으로 서명**한다.

```bash
cd /Users/jungeuilab/golf/teeup-v2-reactnative/ios

# 1) 서명 없이 아카이브
EAS_BUILD_PLATFORM=ios xcodebuild \
  -workspace app.xcworkspace -scheme app -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath ~/Desktop/teeup.xcarchive \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" \
  archive

# 2) 배포용 서명으로 export (인증서·프로파일 자동 발급)
xcodebuild -exportArchive \
  -archivePath ~/Desktop/teeup.xcarchive \
  -exportPath ~/Desktop/teeup-export \
  -exportOptionsPlist /private/tmp/claude-501/-Users-jungeuilab-golf/6594d849-a0bd-4867-9276-2ef331d97de7/scratchpad/ExportOptions.plist \
  -allowProvisioningUpdates

# 3) 검증 → 업로드
xcrun altool --validate-app -f ~/Desktop/teeup-export/티업링크.ipa -t ios \
  -u "ejto100@gmail.com" -p "@keychain:AC_PASSWORD"
xcrun altool --upload-app -f ~/Desktop/teeup-export/티업링크.ipa -t ios \
  -u "ejto100@gmail.com" -p "@keychain:AC_PASSWORD"
```

`ExportOptions.plist`:

```xml
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>2ZJV4Y7FV5</string>
  <key>signingStyle</key><string>automatic</string>
  <key>destination</key><string>export</string>
  <key>uploadSymbols</key><true/>
</dict>
```

`-allowProvisioningUpdates` 가 `Apple Distribution: EUIJOON JUNG` 인증서와
App Store 프로파일을 자동 발급한다. **기기 등록 불필요.**

### 업로드 인증

앱 암호(app-specific password)를 키체인에 저장해두면 altool이 사용한다.

```bash
security add-generic-password -a "ejto100@gmail.com" -w "<앱암호>" -s "AC_PASSWORD" -U
xcrun altool --list-providers -u "ejto100@gmail.com" -p "@keychain:AC_PASSWORD"
```

앱 암호는 account.apple.com → 로그인 및 보안 → 앱 암호 에서 발급한다.

---

## 3. 도중에 해결한 환경 문제

| 문제 | 증상 | 해결 |
| --- | --- | --- |
| Firebase SPM 충돌 | `pod install` 실패 (duplicate symbol) | `app.json`에 `disableSPM: true` |
| Xcode 첫 실행 컴포넌트 없음 | `xcodebuild` 실행 자체가 안 됨 | `sudo xcodebuild -runFirstLaunch` |
| iOS 플랫폼 SDK 없음 | `iOS 26.5 is not installed` | `xcodebuild -downloadPlatform iOS` (8.5GB) |
| 시뮬레이터 키체인 오류 | Google 로그인 `keychain error` | `CODE_SIGNING_ALLOWED=NO` 를 빼고 빌드 (entitlements 필요) |

---

## 4. 시뮬레이터 검증으로 찾아 고친 앱 버그

실기기 없이 iPhone 17 Pro Max 시뮬레이터로 Release 빌드를 돌려 발견했다.

| 커밋 | 문제 | 내용 |
| --- | --- | --- |
| `1707ff1` | Expo Head 경고 팝업 | `expo-router` 플러그인에 `origin` 미설정이라 실행 시마다 영문 Alert 노출. 심사 리젝 위험(Guideline 2.1) |
| `1698f44` | 앱 이름이 `'app'` 으로 표시 | `CFBundleName`이 `$(PRODUCT_NAME)`이라 Google 로그인 다이얼로그에 개발용 타깃명 노출 |
| `3f49aef` | 결제 문의 유형 노출 | 인앱 결제가 없는데 `결제/청구 문의`·`결제 문의` 항목이 있어 IAP 심사 빌미가 됨 |
| `deada24` | 버전 불일치 | ASC는 1.0인데 빌드는 1.0.2 → 빌드가 버전에 연결되지 않음 |

---

## 5. 미해결 과제

| 항목 | 내용 |
| --- | --- |
| 알림 메시지 이모지 깨짐 | 알림 본문의 이모지가 `?` 로 표시됨. 백엔드 수정 + 배포 필요 |
| 계정삭제 안내 문구 | `app/delete-account.js`에 "Google Play 콘솔" 언급 — iOS에서 어색 |
| 리뷰어 로그인 미배포 | 아래 6장 참조 |
| 신고·차단 기능 없음 | 사용자 생성 콘텐츠가 있는데 신고 기능이 없다. Guideline 1.2로 지적받을 여지 |
| 개인정보처리방침 URL | `https://www.teeup.kr/terms` 가 이용약관 탭으로 먼저 열림 |
| 무료 앱 계약 | `altool` 조회 시 `Agreements: []`, `Is Signup Complete: NO`. **계약 미완료면 승인돼도 출시 불가** |

---

## 6. 리뷰어 로그인 (구글플레이용)

App Store는 Sign in with Apple로 대응했으므로 iOS에는 불필요하지만,
구글플레이 심사에는 필요하다.

- 앱 화면: `app/reviewer-login.js` (로그인 화면에서 **로고 7번 탭**으로 진입)
- 계정: `reviewer@teeup.run` / `reviewer1234!` (DB에 존재 확인됨)
- 백엔드: `POST /api/v1/auth/login` — **`origin/dev`에 구현되어 있으나 운영 미배포**
  (커밋 `f2b1769`, PR #43)

운영 서버는 `origin/dev` 보다 정확히 1커밋 뒤에 있다. 확인 방법:

```bash
# 있으면 배포된 것
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://www.teeup.kr/api/v1/auth/login \
  -H "Content-Type: application/json" -d '{"email":"a@b.c","password":"x"}'
# 404 → 미배포 / 401·422 → 배포됨
```

배포 절차:

```bash
ssh ejsv                                        # ejsv.justicelab.ai.kr:9997
cd /home/ejsv/projects/golf/teeup-v2-backend
git pull origin dev
sudo systemctl restart teeup-v2
```

⚠️ `git pull` 이 "already up to date" 인데도 반영이 안 되면,
**systemd가 보는 경로가 pull 한 경로와 다른 것**이다. 확인:

```bash
systemctl show teeup-v2 -p WorkingDirectory -p ExecStart -p ActiveEnterTimestamp
```

`docs/teeup-v2.service.example` 의 경로(`/home/cubic/Projects/...`)는 실제와 다르므로
신뢰하지 말 것.

---

## 7. 승인 후 할 일

「수동으로 버전 출시」를 선택했으므로 승인되어도 자동 공개되지 않는다.
출시 전 **TestFlight 실기기 검증**을 권한다. 아직 실기기에서 확인하지 못한 항목:

- [ ] 푸시 알림 수신 (APNs production 환경)
- [ ] Sign in with Apple 실제 동작
- [ ] Google 로그인 (Firebase와 OAuth 프로젝트가 분리되어 있어 특히 확인 필요)

---

## 8. 재개 시 체크리스트

```bash
cd /Users/jungeuilab/golf/teeup-v2-reactnative

# ios/ 는 .gitignore 대상 — 없으면 재생성
ls ios || npm run ios:prebuild

# 서명 인증서 확인 (Apple Distribution 이 있어야 함)
security find-identity -v -p codesigning

# 업로드 인증 확인
xcrun altool --list-providers -u "ejto100@gmail.com" -p "@keychain:AC_PASSWORD"
```

- `ios/` 는 git에 포함되지 않으므로 `npm run ios:prebuild` 로 재생성 가능
- **prebuild 하면 Xcode Team 설정과 직접 패치한 Info.plist 값이 초기화된다**
  (`CFBundleName`, `CFBundleShortVersionString` 은 `app.json` 에 있으므로 자동 반영됨)
- prebuild 시 `EAS_BUILD_PLATFORM=ios` 필수 — `app.config.js` 가 이 값으로
  iOS용 Google Client ID를 선택한다 (`npm run ios:prebuild` 에 포함되어 있음)
- Xcode로 열 때는 반드시 `ios/app.xcworkspace` (`.xcodeproj` 아님)
- **재업로드 시 `app.json` 의 `ios.buildNumber` 를 반드시 증가**시킬 것 (현재 `1`)

---

## 2026-09-17 — 엔타이틀먼트 누락 사고와 빌드 3

### 무슨 일이 있었나

App Store 에 올린 **빌드 1·2 는 Sign in with Apple 과 푸시가 동작할 수 없는 상태**였다.
원인은 이 문서 앞부분에 "성공한 방법"으로 적어둔 **무서명 아카이브 방식**이다.

```bash
# 이렇게 하면 안 된다 (엔타이틀먼트가 통째로 빠진다)
xcodebuild ... CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" archive
```

`CODE_SIGNING_ALLOWED=NO` 로 아카이브하면 `.app` 에 엔타이틀먼트가 아예 박히지 않고,
`-exportArchive` 의 재서명은 **아카이브에 없는 엔타이틀먼트를 만들어내지 않는다**.
그 결과 업로드된 IPA 의 서명 엔타이틀먼트는 아래가 전부였다.

```
application-identifier / com.apple.developer.team-identifier / beta-reports-active / get-task-allow
```

App ID 와 프로비저닝 프로파일에는 `com.apple.developer.applesignin` 이 정상으로 들어 있었다.
즉 **Apple Developer 포털 설정 문제가 아니라 빌드 명령 문제**였다.
Apple 의 `2.1.0 Performance: App Completeness` 리젝과 정합한다.

### 확인 방법

```bash
unzip -o -q ~/Desktop/teeup-export/티업링크.ipa -d /tmp/ipa
codesign -d --entitlements :- /tmp/ipa/Payload/*.app
```

App Store 제출본에 아래 셋이 **반드시** 있어야 한다.

| 키 | 값 |
| --- | --- |
| `com.apple.developer.applesignin` | `Default` |
| `aps-environment` | `production` |
| `get-task-allow` | `false` |

### 올바른 빌드 명령 (빌드 3 부터 이 방식)

`ios/app/app.entitlements` 는 prebuild 가 `aps-environment: development` 로 생성하므로,
배포용 엔타이틀먼트 파일을 따로 두고 아카이브 때 덮어쓴다.
**`ios/` 는 gitignore 대상이라 prebuild 를 다시 돌리면 이 파일도 사라진다. 그때는 다시 만들어야 한다.**

```bash
# ios/app/app-release.entitlements
# aps-environment = production, com.apple.developer.applesignin = [Default]

cd ios
EAS_BUILD_PLATFORM=ios xcodebuild \
  -workspace app.xcworkspace -scheme app -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath ~/Desktop/teeup.xcarchive \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=2ZJV4Y7FV5 CODE_SIGN_STYLE=Automatic \
  CODE_SIGN_ENTITLEMENTS=app/app-release.entitlements \
  CURRENT_PROJECT_VERSION=3 \
  archive
```

아카이브 단계에서는 자동 서명이 **개발용 프로파일**을 고르기 때문에
`.xcarchive` 안의 엔타이틀먼트는 `aps-environment: development` / `get-task-allow: true` 로 보인다.
정상이다. `-exportArchive` 가 배포 프로파일로 재서명하면서 `production` / `false` 로 바뀐다.
**반드시 export 후의 IPA 를 검사할 것.**

### 실기기 설치 (TestFlight 가 안 될 때)

TestFlight 내부 테스팅 그룹에 빌드를 붙여도 아이폰에서 "사용 가능한 빌드 없음"만 뜨는 경우가 있었다.
케이블로 직접 설치하는 편이 빠르다.

```bash
# 아이폰: 설정 → 개인정보 보호 및 보안 → 개발자 모드 → 켜기 (재시동)
xcrun devicectl list devices                     # UDID 확인
cd ios && EAS_BUILD_PLATFORM=ios xcodebuild \
  -workspace app.xcworkspace -scheme app -configuration Release \
  -destination 'id=<UDID>' -derivedDataPath /tmp/dd-dev \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  DEVELOPMENT_TEAM=2ZJV4Y7FV5 CODE_SIGN_STYLE=Automatic build
xcrun devicectl device install app --device <UDID> /tmp/dd-dev/Build/Products/Release-iphoneos/app.app
```

### 화면 녹화

QuickTime Player → 파일 → 새로운 동영상 녹화 → ● 옆 ▾ → 카메라: iPhone.
결과물은 `~/Desktop/teeup-review-video/`.

### 업로드 이력

| 빌드 | 업로드 | 엔타이틀먼트 | 비고 |
| --- | --- | --- | --- |
| 1.0 (1) | 2026-09-09 | ❌ applesignin 없음 | Guideline 2.1 리젝 |
| 1.0 (2) | 2026-09-14 | ❌ applesignin 없음 | 제출 안 함 (사용 금지) |
| 1.0 (3) | 2026-09-17 | ✅ applesignin / aps production | Delivery `e664391c-dc44-4c80-b7b3-aab2949b15a9` |
| 1.0 (4) | 2026-09-18 | ✅ applesignin / aps production | 사용설명서 배너 포함. Delivery `78659e69-9070-4843-ab87-bc49a6eae318` — **심사 통과, 2026-09-20 출시** |
| 1.0.1 (1) | 2026-09-24 | ✅ applesignin / aps production | EAS Update(OTA) 도입. Delivery `4e085fb0-657c-47f8-af38-7caf6e68d5e8` |

> 1.0 은 2026-09-20 App Store 출시 완료.
> https://apps.apple.com/kr/app/id6801782217

### ExportOptions.plist

전에는 `/tmp` 에 두었다가 지워져서 export 가 실패한 적이 있다.
지금은 저장소의 **`scripts/ios-export-options.plist`** 를 쓴다.

```bash
xcodebuild -exportArchive -archivePath ~/Desktop/teeup.xcarchive \
  -exportPath ~/Desktop/teeup-export \
  -exportOptionsPlist scripts/ios-export-options.plist \
  -allowProvisioningUpdates
```

### prebuild 후 반드시 다시 만들 것

`npm run ios:prebuild` 는 `ios/` 를 통째로 재생성하므로 **`ios/app/app-release.entitlements` 가 사라진다.**
(prebuild 가 만드는 `app.entitlements` 는 `aps-environment` 가 `development` 다.)
아카이브 전에 아래 내용으로 다시 만들고 `CODE_SIGN_ENTITLEMENTS=app/app-release.entitlements` 로 빌드한다.

| 키 | 값 |
| --- | --- |
| `aps-environment` | `production` |
| `com.apple.developer.applesignin` | `Default` |
