#!/bin/bash
# Builds lpisim.apk using Docker (no local Android Studio required).
# Output: ../lpisim.apk (same directory as lpisim.html)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$(dirname "$SCRIPT_DIR")"
SDK_CACHE="$SCRIPT_DIR/.android-sdk-cache"

echo "==> Syncing web assets into Android project..."
source ~/.nvm/nvm.sh 2>/dev/null || true
npx cap sync android

echo "==> Building APK with Docker (JDK 21)..."
mkdir -p "$SDK_CACHE"

docker run --rm \
  -v "$SCRIPT_DIR":/project:ro \
  -v "$SDK_CACHE":/android-sdk \
  -v "$OUT_DIR":/output \
  eclipse-temurin:21-jdk \
  bash -c '
    set -e

    # Install Android cmdline-tools if not already in the cache volume
    if [ ! -f /android-sdk/cmdline-tools/latest/bin/sdkmanager ]; then
      echo "[sdk] Installing Android command-line tools..."
      apt-get update -qq && apt-get install -y -qq wget unzip > /dev/null
      mkdir -p /android-sdk/cmdline-tools
      wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
           -O /tmp/cmdtools.zip
      unzip -q /tmp/cmdtools.zip -d /tmp/cmdtools
      mv /tmp/cmdtools/cmdline-tools /android-sdk/cmdline-tools/latest
    fi

    export ANDROID_HOME=/android-sdk
    export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

    # Install SDK packages if missing
    if [ ! -d /android-sdk/platforms/android-35 ]; then
      echo "[sdk] Installing Android SDK platforms and build-tools..."
      yes | sdkmanager --licenses > /dev/null 2>&1 || true
      sdkmanager "platforms;android-35" "build-tools;35.0.0" "platform-tools" > /dev/null
    fi

    # Copy project into writable temp dir (source is mounted read-only)
    echo "[build] Copying project to temp workspace..."
    cp -r /project /tmp/lpisim

    cd /tmp/lpisim/android
    chmod +x ./gradlew

    echo "[build] Running Gradle assembleDebug..."
    ./gradlew assembleDebug --no-daemon -q

    APK=/tmp/lpisim/android/app/build/outputs/apk/debug/app-debug.apk
    if [ -f "$APK" ]; then
      cp "$APK" /output/lpisim.apk
      echo "[done] lpisim.apk copied to output."
    else
      echo "[error] APK not found at $APK"
      exit 1
    fi
  '

echo "==> Done! APK is at: $OUT_DIR/lpisim.apk"
