#!/bin/sh
set -eu

REPOSITORY="peretyn/peretyn"
RUNTIME_TAG_PREFIX="@peretyn/runtime@"
RELEASES_API="https://api.github.com/repos/$REPOSITORY/releases?per_page=100"
RAW_ORIGIN="https://raw.githubusercontent.com/$REPOSITORY"
DEFAULT_DIR="/opt/peretyn"
DEPLOY_FILES="compose.yaml Caddyfile"
REQUIRED_PORTS="80 443"
CONTROL_HEALTH_URL="http://127.0.0.1:3001/healthz"
CONTROL_READY_ATTEMPTS=60
CONTROL_READY_DELAY_SECONDS=2
SECRET_BYTES=32
ADMIN_PASSWORD_BYTES=12

say() {
  printf '%s\n' "$*"
}

fail() {
  printf 'peretyn install: %s\n' "$*" >&2
  exit 1
}

has_command() {
  command -v "$1" >/dev/null 2>&1
}

download() {
  curl --proto '=https' --tlsv1.2 -fsSL "$@"
}

has_terminal() {
  [ -r /dev/tty ] && (: </dev/tty) 2>/dev/null
}

ask() {
  name="$1"
  question="$2"
  eval "is_set=\${$name+set}"
  if [ -n "$is_set" ]; then
    return
  fi
  has_terminal || fail "$name is not set and there is no terminal to ask for it. Set $name and run again."
  printf '%s ' "$question" >/dev/tty
  read -r "${name?}" </dev/tty
}

require_value() {
  eval "current=\${$1:-}"
  [ -n "$current" ] || fail "$1 is required."
}

check_prerequisites() {
  has_command curl || fail "curl is required."
  has_command openssl || fail "openssl is required."
  has_command docker || fail "Docker is required. Install it from https://get.docker.com and run again."
  docker info >/dev/null 2>&1 || fail "this user cannot run Docker. Run as root or join the docker group."
  docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is required (the 'docker compose' command)."
}

is_port_in_use() {
  has_command ss || return 1
  ss -ltnH "sport = :$1" | grep -q .
}

check_ports_are_free() {
  for port in $REQUIRED_PORTS; do
    if is_port_in_use "$port"; then
      fail "port $port is already in use. Caddy needs ports 80 and 443."
    fi
  done
}

warn_when_domain_does_not_resolve() {
  has_command getent || return 0
  getent hosts "$PERETYN_DOMAIN" >/dev/null && return 0
  say "Warning: $PERETYN_DOMAIN does not resolve yet. Caddy keeps retrying the certificate once DNS points at this host."
}

fetch_releases() {
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    download -H "Authorization: Bearer $GITHUB_TOKEN" "$RELEASES_API"
    return
  fi
  download "$RELEASES_API"
}

latest_runtime_version() {
  fetch_releases |
    grep -o "\"tag_name\": *\"${RUNTIME_TAG_PREFIX}[^\"]*\"" |
    head -n 1 |
    sed "s|.*${RUNTIME_TAG_PREFIX}\([^\"]*\)\"|\1|"
}

resolve_version() {
  if [ -z "${PERETYN_TAG:-}" ]; then
    PERETYN_TAG=$(latest_runtime_version)
  fi
  [ -n "$PERETYN_TAG" ] || fail "could not find the latest peretyn release. GitHub may be rate-limiting this address: set PERETYN_TAG to a version, or GITHUB_TOKEN to a GitHub token, and run again."
}

deploy_files_url() {
  printf '%s/%%40peretyn%%2Fruntime%%40%s/deploy' "$RAW_ORIGIN" "$PERETYN_TAG"
}

download_deploy_files() {
  base_url=$(deploy_files_url)
  for file in $DEPLOY_FILES; do
    download "$base_url/$file" -o "$file.download" || fail "could not download $file for version $PERETYN_TAG."
    mv "$file.download" "$file"
  done
}

enter_install_dir() {
  mkdir -p "$PERETYN_DIR" 2>/dev/null || fail "cannot create $PERETYN_DIR. Run as root or set PERETYN_DIR to a directory you own."
  cd "$PERETYN_DIR"
}

generate_secret() {
  openssl rand -hex "$1"
}

write_env_file() {
  umask 077
  cat >.env <<EOF
PERETYN_TAG=$PERETYN_TAG
PERETYN_DOMAIN=$PERETYN_DOMAIN
PERETYN_DASHBOARD_URL=https://$PERETYN_DOMAIN
POSTGRES_PASSWORD=$(generate_secret "$SECRET_BYTES")
PERETYN_INTERNAL_SECRET=$(generate_secret "$SECRET_BYTES")
BETTER_AUTH_SECRET=$(generate_secret "$SECRET_BYTES")
PERETYN_RESEND_API_KEY=${PERETYN_RESEND_API_KEY:-}
PERETYN_EMAIL_FROM=no-reply@$PERETYN_DOMAIN
PERETYN_ALLOW_SIGNUP=false
EOF
}

set_env_tag() {
  sed "s/^PERETYN_TAG=.*/PERETYN_TAG=$PERETYN_TAG/" .env >.env.next
  chmod 600 .env.next
  mv .env.next .env
}

start_stack() {
  docker compose pull --quiet
  docker compose up -d --remove-orphans
}

wait_for_control() {
  attempt=0
  until docker compose exec -T control wget -qO- "$CONTROL_HEALTH_URL" >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    [ "$attempt" -lt "$CONTROL_READY_ATTEMPTS" ] || fail "the control plane did not become ready. Check 'docker compose logs control' in $PERETYN_DIR."
    sleep "$CONTROL_READY_DELAY_SECONDS"
  done
}

enroll_admin() {
  wait_for_control
  docker compose exec -T control node services/control/dist/scripts/enroll.js \
    "$PERETYN_ADMIN_EMAIL" "$ADMIN_PASSWORD" "${PERETYN_ADMIN_NAME:-}" --admin >/dev/null ||
    fail "could not create the admin account. Create it from $PERETYN_DIR with: docker compose exec control node services/control/dist/scripts/enroll.js <email> <password> <name> --admin"
}

collect_install_answers() {
  ask PERETYN_DOMAIN "Domain for peretyn (e.g. peretyn.example.com):"
  require_value PERETYN_DOMAIN
  ask PERETYN_ADMIN_EMAIL "Admin email:"
  require_value PERETYN_ADMIN_EMAIL
  ask PERETYN_ADMIN_NAME "Admin name (optional):"
  ask PERETYN_RESEND_API_KEY "Resend API key for email (optional, leave empty to send no email):"
}

install() {
  check_ports_are_free
  collect_install_answers
  warn_when_domain_does_not_resolve
  download_deploy_files
  write_env_file
  start_stack
  ADMIN_PASSWORD=$(generate_secret "$ADMIN_PASSWORD_BYTES")
  enroll_admin
  say ""
  say "peretyn $PERETYN_TAG is running at https://$PERETYN_DOMAIN"
  say "Admin: $PERETYN_ADMIN_EMAIL"
  say "Password: $ADMIN_PASSWORD"
  say "This password is shown once. Change it after you sign in."
}

upgrade() {
  download_deploy_files
  set_env_tag
  start_stack
  say ""
  say "peretyn is now on $PERETYN_TAG in $PERETYN_DIR"
}

main() {
  PERETYN_DIR="${PERETYN_DIR:-$DEFAULT_DIR}"
  check_prerequisites
  resolve_version
  enter_install_dir
  if [ -f .env ]; then
    upgrade
    return
  fi
  install
}

main "$@"
