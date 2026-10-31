#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${WHISPER_CPP_SOURCE_DIR:-$HOME/src/whisper.cpp-1.9.5}"
BUILD_DIR="${WHISPER_CPP_BUILD_DIR:-$SOURCE_DIR/build-nk1-termux}"
JOBS="${WHISPER_CPP_JOBS:-2}"
MODEL_NAME="${WHISPER_CPP_MODEL:-tiny}"
THREADS="${WHISPER_CPP_THREADS:-2}"

if [[ ! -f "$SOURCE_DIR/CMakeLists.txt" || ! -f "$SOURCE_DIR/include/whisper.h" ]]; then
  echo "whisper.cpp source not found: $SOURCE_DIR" >&2
  echo "Unpack the supplied whisper.cpp-1.9.5.zip and set WHISPER_CPP_SOURCE_DIR." >&2
  exit 2
fi
if ! command -v cmake >/dev/null 2>&1 || ! command -v clang++ >/dev/null 2>&1; then
  echo "Install Termux build tools first: pkg install cmake clang make" >&2
  exit 2
fi
if ! [[ "$THREADS" =~ ^[1-8]$ ]]; then
  echo "WHISPER_CPP_THREADS must be an integer from 1 to 8." >&2
  exit 2
fi
case "$MODEL_NAME" in
  tiny|base) ;;
  *) echo "Supported mobile model presets are tiny or base (multilingual)." >&2; exit 2 ;;
esac

cmake -S "$SOURCE_DIR" -B "$BUILD_DIR" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
  -DWHISPER_BUILD_TESTS=OFF \
  -DWHISPER_BUILD_EXAMPLES=ON \
  -DWHISPER_BUILD_SERVER=ON \
  -DWHISPER_CURL=OFF \
  -DWHISPER_COMMON_FFMPEG=OFF \
  -DWHISPER_SDL2=OFF \
  -DGGML_NATIVE=OFF \
  -DGGML_OPENMP=OFF \
  -DGGML_CUDA=OFF \
  -DGGML_VULKAN=OFF \
  -DGGML_METAL=OFF

cmake --build "$BUILD_DIR" --config Release --target whisper-server -j "$JOBS"

SERVER="$BUILD_DIR/bin/whisper-server"
if [[ ! -x "$SERVER" ]]; then
  echo "Build completed but whisper-server was not found: $SERVER" >&2
  exit 3
fi

MODEL_PATH="$SOURCE_DIR/models/ggml-$MODEL_NAME.bin"
if [[ ! -s "$MODEL_PATH" ]]; then
  echo "Downloading the multilingual $MODEL_NAME model into $SOURCE_DIR/models"
  (cd "$SOURCE_DIR" && bash ./models/download-ggml-model.sh "$MODEL_NAME")
fi
if [[ ! -s "$MODEL_PATH" ]]; then
  echo "Whisper model missing after download: $MODEL_PATH" >&2
  exit 3
fi

echo "Build ready."
echo "Start the local sidecar with:"
printf '  "%s" --host 127.0.0.1 --port 8081 --model "%s" --language auto --threads %s --no-gpu\n' "$SERVER" "$MODEL_PATH" "$THREADS"
echo "Configure the NK1 runtime with:"
echo "  NK1_WHISPER_CPP_URL=http://127.0.0.1:8081/inference"
