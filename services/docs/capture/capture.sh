#!/bin/sh
set -eu

CAPTURE_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_DIR=$(cd "$CAPTURE_DIR/../../.." && pwd)
OUT_DIR="$CAPTURE_DIR/out"
PUBLIC_DIR="$REPO_DIR/services/docs/public/quickstart"
BOX_IMAGE="peretyn-capture-box"
BOX="peretyn-capture"
PLAYWRIGHT_VERSION="1.63.0"
PLAYWRIGHT_IMAGE="mcr.microsoft.com/playwright:v$PLAYWRIGHT_VERSION-noble"
ADMIN_EMAIL="you@example.com"
ADMIN_PASSWORD="capture-password"
PERETYN_URL="http://localhost"
CLI_INSTALL_URL="https://peretyn.dev/install-cli"
RELEASES_API="https://api.github.com/repos/peretyn/peretyn/releases?per_page=100"
RUNTIME_TAG_PREFIX="@peretyn/runtime@"
TERMINAL_WIDTH=1200
TERMINAL_FPS=12
BROWSER_WIDTH=1600
BROWSER_HEIGHT=1000
BROWSER_FPS=15
TERMINAL_WEBP="-lossy -q 80 -m 6"
BROWSER_WEBP="-m 6"

say() {
  printf 'capture: %s\n' "$*"
}

latest_runtime_version() {
  curl -fsSL "$RELEASES_API" |
    grep -o "\"tag_name\": *\"${RUNTIME_TAG_PREFIX}[^\"]*\"" |
    head -n 1 |
    sed "s|.*${RUNTIME_TAG_PREFIX}\([^\"]*\)\"|\1|"
}

in_box() {
  docker exec -u dev -w /home/dev "$@"
}

start_box() {
  docker build -q -t "$BOX_IMAGE" "$CAPTURE_DIR" >/dev/null
  docker rm -f -v "$BOX" >/dev/null 2>&1 || true
  docker run -d --privileged --name "$BOX" -v "$REPO_DIR:/repo:ro" -v "$OUT_DIR:/out" "$BOX_IMAGE" >/dev/null
  until docker exec "$BOX" docker info >/dev/null 2>&1; do sleep 1; done
}

stop_box() {
  docker rm -f -v "$BOX" >/dev/null 2>&1 || true
}

stack_images() {
  sed -n 's/^ *image: *//p' "$REPO_DIR/deploy/compose.yaml" | sed "s/\${PERETYN_TAG[^}]*}/$1/"
}

pull_stack_images() {
  for image in $(stack_images "$1"); do
    docker exec "$BOX" docker pull -q "$image" >/dev/null
  done
}

record_tape() {
  in_box "$@" >/dev/null
}

reset_admin_password() {
  docker exec -u dev -w /home/dev/peretyn "$BOX" docker compose exec -T control \
    node services/control/dist/scripts/reset-password.js "$ADMIN_EMAIL" "$ADMIN_PASSWORD" >/dev/null
}

record_dashboard() {
  docker run --rm --network "container:$BOX" --user "$(id -u):$(id -g)" -e HOME=/tmp \
    -e CAPTURE_SCENE="$1" -e CAPTURE_ADMIN_EMAIL="$ADMIN_EMAIL" -e CAPTURE_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    -v "$CAPTURE_DIR:/capture:ro" -v "$OUT_DIR:/out" "$PLAYWRIGHT_IMAGE" \
    sh -c "mkdir -p /tmp/run && cd /tmp/run && npm install --silent --no-audit --no-fund playwright@$PLAYWRIGHT_VERSION >/dev/null && cp /capture/dashboard.mjs . && node dashboard.mjs"
}

record_environment() {
  sed "s|{{DEVELOPMENT_KEY}}|$(cat "$OUT_DIR/development-key")|" "$CAPTURE_DIR/set-environment.tape" >"$OUT_DIR/set-environment.tape"
  record_tape "$BOX" vhs /out/set-environment.tape
}

write_quickstart_env() {
  cat >"$OUT_DIR/quickstart.env" <<EOF
export PATH="\$HOME/.local/bin:\$PATH"
export PERETYN_TOKEN=$(cat "$OUT_DIR/development-key")
export PERETYN_RUNTIME_URL=$PERETYN_URL
export PERETYN_CONTROL_URL=$PERETYN_URL
EOF
}

prepare_quickstart_project() {
  write_quickstart_env
  in_box "$BOX" sh -c "curl -fsSL $CLI_INSTALL_URL | sh >/dev/null 2>&1
    mkdir -p ~/peretyn-quickstart && cd ~/peretyn-quickstart
    npm init -y >/dev/null && npm pkg set type=module
    npm install --silent --no-audit --no-fund @peretyn/sdk >/dev/null
    cp /repo/services/docs/snippets/quickstart/schema.ts ."
}

frames_to_webp() {
  in_box "$BOX" sh -c "img2webp -loop 0 -d $(frame_delay_ms "$2") $3 /out/png-$1/*.png -o /out/$1.webp >/dev/null"
  cp "$OUT_DIR/$1.webp" "$PUBLIC_DIR/$1.webp"
}

frame_delay_ms() {
  awk -v fps="$1" 'BEGIN { printf "%d", 1000 / fps + 0.5 }'
}

extract_frames() {
  in_box "$BOX" sh -c "mkdir -p /out/png-$1 && ffmpeg -loglevel error -y $2 -vf '$3' /out/png-$1/frame-%05d.png"
}

encode_terminal() {
  extract_frames "$2" "-i /out/$1" "fps=$TERMINAL_FPS,scale=$TERMINAL_WIDTH:-1:flags=lanczos"
  frames_to_webp "$2" "$TERMINAL_FPS" "$TERMINAL_WEBP"
}

encode_browser() {
  extract_frames "$2" "-f concat -safe 0 -i /out/$1/frames.txt" "fps=$BROWSER_FPS,scale=$BROWSER_WIDTH:-1:flags=lanczos"
  frames_to_webp "$2" "$BROWSER_FPS" "$BROWSER_WEBP"
}

browser_frame_filter() {
  printf 'fps=%s,scale=%s:%s:flags=lanczos,setsar=1,format=rgb24' "$BROWSER_FPS" "$BROWSER_WIDTH" "$BROWSER_HEIGHT"
}

encode_terminal_then_browser() {
  filter=$(browser_frame_filter)
  in_box "$BOX" sh -c "mkdir -p /out/png-$3 && ffmpeg -loglevel error -y -i /out/$1 -f concat -safe 0 -i /out/$2/frames.txt \
    -filter_complex '[0:v]${filter}[terminal];[1:v]${filter}[browser];[terminal][browser]concat=n=2:v=1' \
    /out/png-$3/frame-%05d.png"
  frames_to_webp "$3" "$BROWSER_FPS" "$BROWSER_WEBP"
}

verify_webp() {
  in_box "$BOX" sh /repo/services/docs/capture/verify-webp.sh "$1" "$2"
}

encode_all() {
  mkdir -p "$PUBLIC_DIR"
  encode_terminal start-peretyn.mp4 start-peretyn
  encode_browser create-project create-project
  encode_terminal set-environment.mp4 set-environment
  encode_terminal_then_browser publish-terminal.mp4 schema publish-schema
  verify_webp start-peretyn "$TERMINAL_FPS"
  verify_webp create-project "$BROWSER_FPS"
  verify_webp set-environment "$TERMINAL_FPS"
  verify_webp publish-schema "$BROWSER_FPS"
}

record_all() {
  say "installer"
  record_tape -e CAPTURE_PERETYN_TAG="$1" "$BOX" vhs /repo/services/docs/capture/start-peretyn.tape
  reset_admin_password
  say "project"
  record_dashboard create-project
  say "environment"
  record_environment
  say "publish"
  prepare_quickstart_project
  record_tape "$BOX" vhs /repo/services/docs/capture/publish-schema.tape
  record_dashboard schema
}

main() {
  rm -rf "$OUT_DIR"
  mkdir -p "$OUT_DIR"
  trap stop_box EXIT
  tag=$(latest_runtime_version)
  say "recording with peretyn $tag"
  start_box
  pull_stack_images "$tag"
  record_all "$tag"
  encode_all
  say "wrote the captures to $PUBLIC_DIR"
}

main "$@"
