#!/bin/sh
set -eu

NAME="$1"
FPS="$2"
BLOCK_SIZE=16
MAX_BLOCK_ERROR=6
WORK_DIR="/out/verify-$NAME"

timeline() {
  mkdir -p "$WORK_DIR/$1"
  anim_dump -folder "$WORK_DIR/$1" -prefix frame "$2" >/dev/null 2>&1
  webpinfo "$2" | awk '/Duration:/ { print $2 }' >"$WORK_DIR/$1.durations"
  find "$WORK_DIR/$1" -name 'frame*.png' | sort | paste - "$WORK_DIR/$1.durations" |
    awk '{ printf "file %s\nduration %.3f\n", $1, $2 / 1000; last = $1 } END { printf "file %s\n", last }' >"$WORK_DIR/$1.list"
}

measure_block_errors() {
  ffmpeg -loglevel error -f concat -safe 0 -i "$WORK_DIR/encoded.list" -f concat -safe 0 -i "$WORK_DIR/reference.list" \
    -lavfi "[0:v]fps=${FPS},format=gray[encoded];[1:v]fps=${FPS},format=gray[reference];[encoded][reference]blend=all_mode=difference,scale=iw/${BLOCK_SIZE}:ih/${BLOCK_SIZE}:flags=area,signalstats,metadata=print:key=lavfi.signalstats.YMAX:file=$WORK_DIR/errors.log" \
    -f null -
}

summarize() {
  awk -F= -v limit="$MAX_BLOCK_ERROR" '
    /YMAX/ { error = $2 + 0; if (error > worst) worst = error; if (error > limit) bad++; total++ }
    END { printf "%d %d %d\n", worst, bad + 0, total }' "$WORK_DIR/errors.log"
}

rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"
img2webp -loop 0 -d "$(awk -v fps="$FPS" 'BEGIN { printf "%d", 1000 / fps + 0.5 }')" "/out/png-$NAME"/*.png -o "$WORK_DIR/reference.webp" >/dev/null
timeline reference "$WORK_DIR/reference.webp"
timeline encoded "/out/$NAME.webp"
measure_block_errors
summarize >"$WORK_DIR/summary"
read -r worst bad total <"$WORK_DIR/summary"
printf 'capture: %s worst block error %s, %s of %s frames over %s\n' "$NAME" "$worst" "$bad" "$total" "$MAX_BLOCK_ERROR"
[ "$bad" -eq 0 ]
