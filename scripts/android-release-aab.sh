#!/usr/bin/env bash

set -euo pipefail

KEYSTORE="credentials/teeup-upload.jks"

if [ ! -f "$KEYSTORE" ]; then
  echo "Missing keystore: $KEYSTORE" >&2
  exit 1
fi

KEYTOOL="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}/bin/keytool"
if [ ! -x "$KEYTOOL" ]; then
  echo "keytool not found: $KEYTOOL (JAVA_HOME 확인)" >&2
  exit 1
fi

cleanup() {
  stty echo
}

trap cleanup EXIT

ask() {
  printf '%s: ' "$1" >&2
  stty -echo
  read -r REPLY_PW
  stty echo
  printf '\n' >&2
}

ask 'ANDROID_UPLOAD_STORE_PASSWORD'
ANDROID_UPLOAD_STORE_PASSWORD="$REPLY_PW"

# 금고 비밀번호를 먼저 검증한다. 20 분 빌드 끝에 서명에서 죽는 것보다
# 여기서 즉시 틀렸다고 알려주는 쪽이 낫다.
if ! KEYSTORE_LIST=$("$KEYTOOL" -list -keystore "$KEYSTORE" \
      -storepass "$ANDROID_UPLOAD_STORE_PASSWORD" 2>&1); then
  echo "키스토어를 열 수 없습니다. keytool 이 말한 이유는 이렇다:" >&2
  printf '%s\n' "$KEYSTORE_LIST" | sed 's/^/  | /' >&2
  exit 1
fi

# 별칭을 추측하지 않고 키스토어에서 읽는다. macOS 기본 bash 는 3.2 라서
# mapfile 이 없고 set -u 에서 빈 배열 전개가 죽는다. 문자열로 다룬다.
ALIASES=$(printf '%s\n' "$KEYSTORE_LIST" \
  | awk -F',' '/PrivateKeyEntry/ { gsub(/^[ \t]+|[ \t]+$/, "", $1); print $1 }')
ALIAS_COUNT=$(printf '%s' "$ALIASES" | grep -c . || true)

if [ "$ALIAS_COUNT" -eq 0 ]; then
  echo "키스토어에 PrivateKeyEntry 가 없습니다. 서명할 키가 없습니다." >&2
  exit 1
elif [ "$ALIAS_COUNT" -eq 1 ]; then
  ANDROID_UPLOAD_KEY_ALIAS="$ALIASES"
  echo "키 별칭: $ANDROID_UPLOAD_KEY_ALIAS"
else
  echo "별칭이 여러 개입니다:" >&2
  printf '%s\n' "$ALIASES" | sed 's/^/  /' >&2
  printf '쓸 별칭을 입력하세요: ' >&2
  read -r ANDROID_UPLOAD_KEY_ALIAS
fi

# PKCS#12 키스토어는 금고와 키가 같은 비밀번호를 쓰는 게 보통이다.
# 그냥 엔터를 치면 위에서 받은 값을 그대로 쓴다.
ask 'ANDROID_UPLOAD_KEY_PASSWORD (엔터 = storePassword 와 동일)'
if [ -z "$REPLY_PW" ]; then
  ANDROID_UPLOAD_KEY_PASSWORD="$ANDROID_UPLOAD_STORE_PASSWORD"
  echo "storePassword 와 같은 값을 쓴다."
else
  ANDROID_UPLOAD_KEY_PASSWORD="$REPLY_PW"
fi

# 키 비밀번호도 검증한다. -certreq 는 키스토어를 바꾸지 않고
# 키를 실제로 열어보는 읽기 전용 동작이다.
if ! KEY_ERR=$("$KEYTOOL" -certreq -alias "$ANDROID_UPLOAD_KEY_ALIAS" \
      -keystore "$KEYSTORE" \
      -storepass "$ANDROID_UPLOAD_STORE_PASSWORD" \
      -keypass "$ANDROID_UPLOAD_KEY_PASSWORD" 2>&1 >/dev/null); then
  echo "키를 열 수 없습니다. keytool 이 말한 이유는 이렇다:" >&2
  printf '%s\n' "$KEY_ERR" | sed 's/^/  | /' >&2
  exit 1
fi

echo "비밀번호 확인 완료. 빌드를 시작합니다."

export ANDROID_UPLOAD_STORE_PASSWORD
export ANDROID_UPLOAD_KEY_ALIAS
export ANDROID_UPLOAD_KEY_PASSWORD

EAS_BUILD_PLATFORM=android expo prebuild --platform android
cd android
EAS_BUILD_PLATFORM=android ./gradlew :app:bundleRelease

echo
echo "AAB: $(cd .. && pwd)/android/app/build/outputs/bundle/release/app-release.aab"
