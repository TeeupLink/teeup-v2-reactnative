# App Review 답변 — Guideline 2.1 Information Needed

- 작성일: 2026-09-14 (신고·차단·필터 구현 반영으로 전면 개정)
- 2026-09-17 개정: 9/17 리젝의 생년월일·성별 질의 답변(본문 8번) 추가
- 대상: 버전 1.0 — Apple의 추가 정보 요청에 대한 회신. **빌드 4로 재제출**한다.
- 회신 위치: App Store Connect → 앱 → 심사 메시지 회신 **+ 앱 심사 정보의 「메모」 필드에도 동일 내용 기재**

> Apple이 "Reply in App Store Connect ... and also add this information to the Notes field"
> 라고 명시했으므로 **두 곳 모두**에 넣어야 한다.

---

## 0. 회신 전 준비 체크리스트

| 순서 | 항목 | 담당 | 상태 |
| --- | --- | --- | --- |
| 1 | 백엔드 `dev` 푸시 → 서버 `git pull` + `systemctl restart teeup-v2` | 사용자 | ☐ |
| 2 | 서버에서 `scripts/update_terms_ugc_clause.py` (약관 조항) + `seed_demo.py` (데모 데이터) 실행 | 사용자 | ☐ |
| 3 | `/api/v1/moderation/*`, `/api/v1/auth/login` 응답 확인 (404 아님) | Claude | ☐ |
| 4 | 시뮬레이터에서 신고·차단·금칙어 E2E 확인, 스크린샷 재촬영 | Claude (로그인은 사용자) | ☐ |
| 5 | `ios.buildNumber` → `2`, 아카이브 → 업로드 (2026-09-14 완료, Delivery `f7d5801e`) | Claude | ☑ |
| 6 | iPhone 12 mini (iOS 18.1.1) 에 USB로 빌드 2 직접 설치 → QuickTime 으로 화면 녹화 (2026-09-15 완료) | 사용자+Claude | ☑ |
| 7 | ASC 1.0 버전의 빌드를 **1.0 (4)** 로 교체 (빌드 1·2 는 엔타이틀먼트 누락본이라 제출 금지) | 사용자 | ☐ |
| 8 | 아래 답변 + 녹화 영상 회신, 메모 필드에도 기재, 심사 제출 | 사용자 | ☐ |

### 녹화 결과물 (`~/Desktop/teeup-review-video/`)

| 파일 | 길이 | 내용 |
| --- | --- | --- |
| `teeup-review-1.mov` (153MB, 888×1920) | 4:32 | 홈 화면 앱 실행 → 리뷰어 로그인 → 홈/클럽/공지/멤버/규정/회비 → 모임 상세 → **신고** → 멤버 **차단** → 차단 관리 **해제** → 라운드 기록 → 1:1 문의 → 로그아웃 |
| `teeup-review-1-720p.mov` (104MB) | 4:32 | 위와 동일, 첨부 용량 제한 걸릴 때 사용 |
| `teeup-review-2-delete-account.mov` (42MB) | 1:49 | 리뷰어 로그인 (demo12) → 마이 → 회원정보 수정 → **회원 탈퇴** → 로그아웃 화면 |

> TestFlight 는 내부 그룹에 빌드를 붙여도 아이폰에 "사용 가능한 빌드 없음"만 떠서 포기.
> 대신 개발자 모드 켜고 `xcodebuild -destination id=<UDID> -allowProvisioningDeviceRegistration` 로 빌드 →
> `xcrun devicectl device install app` 으로 설치. 녹화는 QuickTime → 동영상 녹화 → 카메라: iPhone.

### Guideline 1.2 (UGC) 충족 현황

| Apple 요구 | 구현 |
| --- | --- |
| 부적절 콘텐츠 사전 필터링 | 백엔드 금칙어 필터 (`utils/content_filter.py`) — 클럽·모임·공지·규정·닉네임 생성/수정 시 400 거부 |
| 신고 메커니즘 | 클럽·모임·공지·규정 상세의 ⋯ 메뉴 → 「신고하기」, 멤버·참가자 행 ⋯ → 사용자 신고. `content_reports` 저장 + 1:1 문의함 자동 생성 |
| 사용자 차단 | ⋯ 메뉴 → 「사용자 차단」. 차단한 사용자의 클럽·모임·공지·참가자 표시 숨김. 마이 → 회원정보 수정 → 「차단 관리」에서 해제 |
| 24시간 내 대응 | 신고 완료 안내 및 약관 제7조의2에 명시. 백오피스 문의 목록에서 처리 |
| 연락처 공개 | 1:1 문의, pixencrew@gmail.com |
| 약관에 무관용 명시 | 서비스 이용약관 제7조 제2항 · 제7조의2 (`scripts/update_terms_ugc_clause.py`로 운영 DB 적용) |

---

## 1. 화면 녹화 촬영 가이드

### 준비

- iPhone (최신 iOS — 현재 iOS 26.x)
- TestFlight 앱 설치 → 티업링크 **빌드 2** 설치
- 설정 → 제어 센터 → 「화면 기록」 추가
- 데모 계정으로 진행하면 시드 데이터(클럽·모임·공지)가 이미 있어 흐름이 짧아진다

### 녹화 흐름 (한 번에 이어서, 5~8분)

1. **홈 화면에서 앱 아이콘 탭** → 앱 실행 (반드시 여기서 시작)
2. 로그인 화면 → 로고 7번 탭 → 리뷰어 로그인 `reviewer@teeup.run / reviewer1234!`
   (또는 Apple로 로그인 → 가입 → 약관 동의 → 프로필 완성)
3. 홈 둘러보기
4. 클럽 탭 → 「티업 골프 동호회」 상세 → 공지 · 멤버 · 규정 둘러보기
5. 모임 탭 → 「10월 정기 라운딩」 상세 → 참가 신청
6. **신고**: 모임 상세 우상단 ⋯ → 신고하기 → 사유 선택 → 신고하기 → "접수되었습니다" 확인
7. **차단**: 클럽 멤버 목록에서 임의 멤버 행 ⋯ → 사용자 차단 → 확인 → 목록에서 사라짐
8. **차단 해제**: 마이 → 회원정보 수정 → 차단 관리 → 차단 해제
9. **필터**: 클럽 만들기에서 이름에 욕설 입력 → 등록 시 "부적절한 표현" 오류 확인 (선택)
10. 홈 → 라운드 기록하기 → 스코어 입력 → 마이페이지 기록 확인
11. 전체메뉴 → 1:1 문의 화면
12. **마이페이지 → 회원정보 수정 → 회원 탈퇴** → 탈퇴 완료까지
    (데모 계정을 탈퇴시키면 리뷰어가 못 쓰므로, **Apple 로그인으로 만든 계정**으로 탈퇴 장면만 따로 찍거나, 탈퇴 후 `seed_demo.py`를 다시 돌려 복구할 것)
13. 로그아웃된 로그인 화면에서 종료

### 주의

- 실명·전화번호 등 실제 개인정보가 화면에 나오지 않도록 **테스트용 값**으로 진행할 것
- 녹화 파일은 ASC 회신에 첨부 (용량 크면 iCloud/Drive 링크로)

---

## 2. 회신 본문 (영문 — App Review 표준)

```
Thank you for reviewing TeeUp Link. Please find the requested information below.
We have also uploaded a new build (1.0, build 4) that adds content reporting,
user blocking and objectionable-content filtering, as described in section 7.

────────────────────────────────────────
1. SCREEN RECORDING
────────────────────────────────────────
Attached are two screen recordings captured on a physical iPhone 12 mini
(iOS 18.1.1) running build 1.0 (4).

Recording 1 (4:32) begins with launching the app from the Home Screen and
demonstrates:
  • Signing in with the demo account (see section 3)
  • Browsing a club, its notices, members, regulations and fees
  • Viewing a golf outing
  • Reporting content (outing detail → ⋯ → Report)
  • Blocking a user from the member list, then unblocking from
    My → Edit Profile → Blocked Users
  • Recording a golf score
  • Contacting support via 1:1 Inquiry
  • Signing out

Recording 2 (1:49) demonstrates account deletion end-to-end
(My → Edit Profile → Delete Account) with a separate test account.

────────────────────────────────────────
2. APP PURPOSE AND TARGET AUDIENCE
────────────────────────────────────────
TeeUp Link is a management tool for amateur golf clubs (동호회) in Korea.

Problem it solves:
Club organizers typically coordinate golf outings through group chats and
spreadsheets — collecting attendees, splitting green fees and meal costs,
and tracking scores by hand. This is error-prone and time-consuming.

Value it provides:
  • Club creation and member management with leader/manager roles
  • Scheduling golf outings and social gatherings with sign-up deadlines
  • Per-outing expense tracking with automatic per-person cost split
  • Personal score history with average score and handicap
  • Push notifications for event updates

Target audience:
Amateur golfers in Korea who belong to or organize a golf club, and club
treasurers/organizers who manage outings and shared expenses.

The app is free. It contains no in-app purchases, subscriptions, or ads.

────────────────────────────────────────
3. SETUP AND ACCESS INSTRUCTIONS
────────────────────────────────────────
Demo account (recommended — it is already a member of a sample club with
outings, notices and score history):

  On the login screen, tap the app logo 7 times to open the
  "Reviewer Login" screen, then enter:
    Email:    reviewer@teeup.run
    Password: reviewer1234!

  (This hidden entry exists only to give reviewers a password-based
  account, since regular users sign in with Apple or Google.)

Alternatively, Sign in with Apple or Google Sign-In work with any account;
the account is created on first sign-in.

Main features and where to find them:
  • Sample club          : Clubs tab → "티업 골프 동호회"
  • Create a club        : Clubs tab → Create Club
  • Create an outing     : Meetings tab → Create Rounding
  • Create a social event: Meetings tab → Create Social
  • Record a score       : Home → Record Round
  • Expense settlement   : Meeting detail → Settlement
  • Report content       : ⋯ button on club / outing / notice / regulation
                           detail, or on a member row → Report
  • Block a user         : ⋯ button on a member / participant row, or on
                           content written by that user → Block User
  • Manage blocked users : My tab → Edit Profile → Blocked Users
  • Delete account       : My tab → Edit Profile → Delete Account
  • Contact support      : Full Menu → 1:1 Inquiry

No sample files are required.

────────────────────────────────────────
4. EXTERNAL SERVICES
────────────────────────────────────────
  • Sign in with Apple           — authentication
  • Google Sign-In               — authentication
  • Firebase Cloud Messaging     — push notifications only
                                    (no Analytics, no Crashlytics, no Ads)
  • Our own backend API          — https://www.teeup.kr (FastAPI, hosted by us)

No payment processors, no AI services, no third-party data providers,
no advertising SDKs.

────────────────────────────────────────
5. REGIONAL DIFFERENCES
────────────────────────────────────────
The app functions identically in all regions. The UI and content are in
Korean and the service is intended for users in South Korea, but no
feature is enabled or disabled based on region.

────────────────────────────────────────
6. REGULATED INDUSTRY / THIRD-PARTY MATERIAL
────────────────────────────────────────
Not applicable. The app does not operate in a regulated industry and does
not include protected third-party material. All content is either created
by our team or by users within their own clubs.

────────────────────────────────────────
7. USER-GENERATED CONTENT (Guideline 1.2)
────────────────────────────────────────
User-generated content (club descriptions, notices, regulations, event
details) is visible only to members of the same club. There is no public
feed, no cross-club search, and no direct messaging between users. Club
leaders approve each membership request.

Build 4 includes the following moderation features:
  • Filtering  : Text submitted for clubs, outings, notices, regulations
                 and profile nicknames is checked against a
                 prohibited-word list on our server and rejected before
                 it is stored.
  • Reporting  : Every piece of user content and every user can be
                 reported from the ⋯ menu (reasons: spam, abuse,
                 inappropriate, fraud, privacy, other). Reports are
                 stored and also appear in our support queue.
  • Blocking   : Users can block another user; the blocked user's
                 clubs, outings, notices and participation are hidden.
                 Blocks can be managed under My → Edit Profile →
                 Blocked Users.
  • Response   : We review every report within 24 hours and remove
                 content or suspend accounts as needed.
  • Terms      : Our Terms of Service (accepted at sign-up) state that
                 objectionable content and abusive users are not
                 tolerated and describe the reporting, blocking and
                 suspension process (Article 7 and 7-2).

────────────────────────────────────────
8. DATE OF BIRTH AND GENDER (2026-09-17 review)
────────────────────────────────────────
Date of birth and gender are OPTIONAL. They are not required for
registration, for signing in, or for any core feature of the app.

They are used only by two golf-specific conveniences:
  • Automatic team formation for an outing, which can balance groups
    by age range.
  • Tee box suggestion (men's / ladies' tees), which uses gender.

In build 1.0 (2) the profile screen incorrectly treated date of birth as
a required field, and the "complete your profile" gate that appears
before joining a club also required both fields. Both have been fixed in
build 1.0 (4): the fields are labeled as optional and every club, outing,
settlement and score feature works without them.

────────────────────────────────────────
ADDITIONAL NOTES
────────────────────────────────────────
  • Account deletion is available in-app (My → Edit Profile → Delete
    Account) and takes effect immediately.
  • The "settlement" feature only records and splits real-world expenses
    among club members; no money is transferred or paid within the app.

Contact: pixencrew@gmail.com
```

---

## 3. 「메모」 필드용 축약본

앱 심사 정보 → 메모 (4,000자)에 넣을 버전.

```
[LOGIN]
Demo account (already a member of a sample club with outings and notices):
On the login screen, tap the app logo 7 times to open "Reviewer Login",
then use  reviewer@teeup.run / reviewer1234!
Sign in with Apple / Google also work with any account.

[KEY PATHS]
Sample club: Clubs tab → "티업 골프 동호회"
Create club: Clubs tab → Create Club
Create outing: Meetings tab → Create Rounding
Record score: Home → Record Round
Report content: ⋯ button on club / outing / notice / regulation detail
                or on a member row → Report
Block user: ⋯ button on a member / participant row → Block User
Blocked users: My → Edit Profile → Blocked Users
Delete account: My → Edit Profile → Delete Account
Support: Full Menu → 1:1 Inquiry, or pixencrew@gmail.com

[UGC / Guideline 1.2]
Content is visible only within the user's own club (no public feed, no
cross-club search, no direct messaging). Club leaders approve membership.
Server-side prohibited-word filter rejects objectionable text before it
is stored. Any content or user can be reported; users can block other
users. We act on reports within 24 hours. Terms of Service (Article 7,
7-2) state zero tolerance for objectionable content and abusive users.

[OPTIONAL FIELDS]
Date of birth and gender are optional and not required for registration
or any core feature. They are used only for optional age-balanced team
formation and tee box suggestion.

[SERVICES]
Sign in with Apple, Google Sign-In, Firebase Cloud Messaging (push only),
own backend at https://www.teeup.kr. No IAP, no ads, no payment processing.

[REGION]
Functions identically in all regions. Korean-language service.

Contact: pixencrew@gmail.com
```
