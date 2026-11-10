#!/bin/sh
set -eu

REPOSITORY="peretyn/peretyn"
CLI_TAG_PREFIX="@peretyn/go-cli@"
RELEASES_API="https://api.github.com/repos/$REPOSITORY/releases?per_page=100"
DOWNLOAD_ORIGIN="https://github.com/$REPOSITORY/releases/download"
BINARY_NAME="peretyn"
CHECKSUMS_FILE="SHA256SUMS"
SUPPORTED_PLATFORMS="linux-amd64 linux-arm64 darwin-arm64"
MINIMUM_NODE_MAJOR=24

say() {
  printf '%s\n' "$*"
}

fail() {
  printf 'peretyn cli install: %s\n' "$*" >&2
  exit 1
}

has_command() {
  command -v "$1" >/dev/null 2>&1
}

download() {
  curl --proto '=https' --tlsv1.2 -fsSL "$@"
}

detect_os() {
  case "$(uname -s)" in
    Linux) echo linux ;;
    Darwin) echo darwin ;;
    *) fail "unsupported operating system $(uname -s)." ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64 | amd64) echo amd64 ;;
    aarch64 | arm64) echo arm64 ;;
    *) fail "unsupported architecture $(uname -m)." ;;
  esac
}

require_supported_platform() {
  case " $SUPPORTED_PLATFORMS " in
    *" $1 "*) return ;;
  esac
  fail "no peretyn CLI build for $1. Supported: $SUPPORTED_PLATFORMS."
}

fetch_releases() {
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    download -H "Authorization: Bearer $GITHUB_TOKEN" "$RELEASES_API"
    return
  fi
  download "$RELEASES_API"
}

latest_cli_version() {
  fetch_releases |
    grep -o "\"tag_name\": *\"${CLI_TAG_PREFIX}[^\"]*\"" |
    head -n 1 |
    sed "s|.*${CLI_TAG_PREFIX}\([^\"]*\)\"|\1|"
}

resolve_version() {
  if [ -z "${PERETYN_CLI_VERSION:-}" ]; then
    PERETYN_CLI_VERSION=$(latest_cli_version)
  fi
  [ -n "$PERETYN_CLI_VERSION" ] || fail "could not find the latest peretyn CLI release. GitHub may be rate-limiting this address: set PERETYN_CLI_VERSION to a version, or GITHUB_TOKEN to a GitHub token, and run again."
}

release_url() {
  printf '%s/%%40peretyn%%2Fgo-cli%%40%s' "$DOWNLOAD_ORIGIN" "$PERETYN_CLI_VERSION"
}

sha256_of() {
  if has_command sha256sum; then
    sha256sum "$1" | cut -d ' ' -f 1
    return
  fi
  has_command shasum || fail "sha256sum or shasum is required to verify the download."
  shasum -a 256 "$1" | cut -d ' ' -f 1
}

verify_checksum() {
  asset="$1"
  expected=$(awk -v name="$asset" '$2 == name { print $1 }' "$CHECKSUMS_FILE")
  [ -n "$expected" ] || fail "$CHECKSUMS_FILE has no entry for $asset."
  actual=$(sha256_of "$asset")
  [ "$actual" = "$expected" ] || fail "checksum mismatch for $asset. Refusing to install."
}

download_release_files() {
  asset="$1"
  base_url=$(release_url)
  download "$base_url/$CHECKSUMS_FILE" -o "$CHECKSUMS_FILE" ||
    fail "release $PERETYN_CLI_VERSION has no $CHECKSUMS_FILE to verify against."
  download "$base_url/$asset" -o "$asset" || fail "could not download $asset for version $PERETYN_CLI_VERSION."
}

install_binary() {
  asset="$1"
  mkdir -p "$PERETYN_BIN_DIR" || fail "cannot create $PERETYN_BIN_DIR. Set PERETYN_BIN_DIR to a directory you own."
  chmod 755 "$asset"
  mv "$asset" "$PERETYN_BIN_DIR/$BINARY_NAME"
}

warn_when_not_on_path() {
  case ":$PATH:" in
    *":$PERETYN_BIN_DIR:"*) return ;;
  esac
  say "Add $PERETYN_BIN_DIR to your PATH to run peretyn from anywhere:"
  say "  export PATH=\"$PERETYN_BIN_DIR:\$PATH\""
}

node_major_version() {
  node --version | sed 's/^v\([0-9]*\).*/\1/'
}

warn_when_node_is_missing_or_old() {
  if has_command node && [ "$(node_major_version)" -ge "$MINIMUM_NODE_MAJOR" ]; then
    return
  fi
  say "Note: 'peretyn build' needs Node.js $MINIMUM_NODE_MAJOR or later to run your schema module."
}

main() {
  PERETYN_BIN_DIR="${PERETYN_BIN_DIR:-$HOME/.local/bin}"
  has_command curl || fail "curl is required."
  platform="$(detect_os)-$(detect_arch)"
  require_supported_platform "$platform"
  resolve_version
  work_dir=$(mktemp -d)
  trap 'rm -rf "$work_dir"' EXIT
  cd "$work_dir"
  asset="$BINARY_NAME-$platform"
  download_release_files "$asset"
  verify_checksum "$asset"
  install_binary "$asset"
  say "Installed $("$PERETYN_BIN_DIR/$BINARY_NAME" --version) to $PERETYN_BIN_DIR/$BINARY_NAME"
  warn_when_not_on_path
  warn_when_node_is_missing_or_old
}

main "$@"
