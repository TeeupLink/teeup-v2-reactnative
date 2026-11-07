#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYSTORE_PATH="$PROJECT_ROOT/credentials/teeup-upload.jks"
KEY_ALIAS='teeup-upload'
TEMP_DIR=''

if [ ! -f "$KEYSTORE_PATH" ]; then
  echo "Missing keystore: $KEYSTORE_PATH" >&2
  exit 1
fi

cleanup() {
  unset VERIFY_STORE_PASSWORD VERIFY_KEY_PASSWORD

  if [ -n "$TEMP_DIR" ]; then
    rm -f \
      "$TEMP_DIR/probe.txt" \
      "$TEMP_DIR/verify.jar" \
      "$TEMP_DIR/verify-signed.jar"
    rmdir "$TEMP_DIR" 2>/dev/null || true
  fi
}

trap cleanup EXIT

read -r -s -p 'ANDROID_UPLOAD_STORE_PASSWORD: ' VERIFY_STORE_PASSWORD
printf '\n'
export VERIFY_STORE_PASSWORD

if ! keytool -list \
  -keystore "$KEYSTORE_PATH" \
  -alias "$KEY_ALIAS" \
  -storepass:env VERIFY_STORE_PASSWORD >/dev/null 2>&1; then
  echo 'Invalid keystore password.' >&2
  exit 1
fi

echo 'Keystore password: OK'

read -r -s -p 'ANDROID_UPLOAD_KEY_PASSWORD: ' VERIFY_KEY_PASSWORD
printf '\n'
export VERIFY_KEY_PASSWORD

TEMP_DIR="$(mktemp -d)"
printf 'TeeUp Android signing key verification\n' > "$TEMP_DIR/probe.txt"
jar --create \
  --file "$TEMP_DIR/verify.jar" \
  -C "$TEMP_DIR" probe.txt

if ! jarsigner \
  -keystore "$KEYSTORE_PATH" \
  -storepass:env VERIFY_STORE_PASSWORD \
  -keypass:env VERIFY_KEY_PASSWORD \
  -signedjar "$TEMP_DIR/verify-signed.jar" \
  "$TEMP_DIR/verify.jar" \
  "$KEY_ALIAS" >/dev/null 2>&1; then
  echo 'Invalid key password.' >&2
  exit 1
fi

echo 'Key password: OK'
echo 'Android upload keystore verification succeeded.'
