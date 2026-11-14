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
LOCAL_DOMAIN="localhost"
INSTALL_URL="https://peretyn.dev/install"
CLI_INSTALL_URL="https://peretyn.dev/install-cli"
QUICKSTART_URL="https://docs.peretyn.dev/quickstart"
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

value_or() {
  eval "current=\${$1-}"
  eval "is_set=\${$1+set}"
  if [ -n "$is_set" ]; then
    printf '%s' "$current"
    return
  fi
  printf '%s' "$2"
}

shell_quote() {
  case "$1" in
    *[!A-Za-z0-9._@:/+-]*) printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")" ;;
    *) printf '%s' "$1" ;;
  esac
}

unattended_example() {
  printf 'curl -fsSL %s | PERETYN_DOMAIN=%s PERETYN_ADMIN_EMAIL=%s PERETYN_ADMIN_NAME=%s PERETYN_RESEND_API_KEY= sh' \
    "$INSTALL_URL" \
    "$(shell_quote "$(value_or PERETYN_DOMAIN peretyn.example.com)")" \
    "$(shell_quote "$(value_or PERETYN_ADMIN_EMAIL you@example.com)")" \
    "$(shell_quote "$(value_or PERETYN_ADMIN_NAME '')")"
}

fail_without_terminal() {
  fail "$1 is not set and there is no terminal to ask for it. Set every answer as a variable and run again, for example:

  $(unattended_example)

To try peretyn on this machine without a domain, use PERETYN_DOMAIN=$LOCAL_DOMAIN."
}

ask() {
  name="$1"
  question="$2"
  eval "is_set=\${$name+set}"
  if [ -n "$is_set" ]; then
    return
  fi
  has_terminal || fail_without_terminal "$name"
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

is_ip_address() {
  case "$1" in
  *:*) return 0 ;;
  esac
  printf '%s' "$1" | grep -Eq '^[0-9]+([.][0-9]+){3}$'
}

is_local_install() {
  [ "$PERETYN_DOMAIN" = "$LOCAL_DOMAIN" ]
}

has_private_suffix() {
  case "$1" in
  *.test | *.local | *.internal | *.lan | *.example | *.invalid | *.home.arpa | *.localhost) return 0 ;;
  esac
  return 1
}

refuse_ip_address() {
  is_ip_address "$PERETYN_DOMAIN" || return 0
  fail "PERETYN_DOMAIN must be a domain name, not an IP address: no client can verify a TLS certificate for $PERETYN_DOMAIN. To try peretyn on this machine, set PERETYN_DOMAIN=$LOCAL_DOMAIN. To serve it to others, point a domain's DNS record at this host."
}

warn_when_domain_cannot_get_a_certificate() {
  has_private_suffix "$PERETYN_DOMAIN" || return 1
  say "Warning: $PERETYN_DOMAIN can't get a public TLS certificate, because its suffix is reserved for private networks. Caddy keeps retrying, and browsers, the CLI and the SDK fail with TLS errors. To try peretyn on this machine, use PERETYN_DOMAIN=$LOCAL_DOMAIN instead."
}

warn_when_domain_does_not_resolve() {
  has_command getent || return 0
  getent hosts "$PERETYN_DOMAIN" >/dev/null && return 0
  say "Warning: $PERETYN_DOMAIN does not resolve yet. Caddy keeps retrying the certificate once DNS points at this host."
}

check_domain() {
  refuse_ip_address
  is_local_install && return
  warn_when_domain_cannot_get_a_certificate && return
  warn_when_domain_does_not_resolve
}

public_url() {
  if is_local_install; then
    printf 'http://%s' "$PERETYN_DOMAIN"
    return
  fi
  printf 'https://%s' "$PERETYN_DOMAIN"
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
  if [ -n "${PERETYN_DEPLOY_REF:-}" ]; then
    printf '%s/%s/deploy' "$RAW_ORIGIN" "$PERETYN_DEPLOY_REF"
    return
  fi
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
PERETYN_DASHBOARD_URL=$(public_url)
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
  enroll_output=$(docker compose exec -T control node services/control/dist/scripts/enroll.js \
    "$PERETYN_ADMIN_EMAIL" "$ADMIN_PASSWORD" "${PERETYN_ADMIN_NAME:-}" --admin 2>&1) ||
    fail "could not create the admin account:
$enroll_output
Create it from $PERETYN_DIR with: docker compose exec control node services/control/dist/scripts/enroll.js <email> <password> <name> --admin"
}

collect_install_answers() {
  ask PERETYN_DOMAIN "Domain for peretyn (e.g. peretyn.example.com):"
  require_value PERETYN_DOMAIN
  check_domain
  ask PERETYN_ADMIN_EMAIL "Admin email:"
  require_value PERETYN_ADMIN_EMAIL
  ask PERETYN_ADMIN_NAME "Admin name (optional):"
  ask PERETYN_RESEND_API_KEY "Resend API key for email (optional, leave empty to send no email):"
}

say_when_local_install() {
  is_local_install || return 0
  say "This is a local evaluation install. It serves plain HTTP, so use it only from this machine."
}

say_when_email_is_off() {
  [ -z "${PERETYN_RESEND_API_KEY:-}" ] || return 0
  say "Email is off, so there are no password resets or invitations. To turn it on, set PERETYN_RESEND_API_KEY in $PERETYN_DIR/.env and run 'docker compose up -d'."
}

say_credentials() {
  say ""
  say "Sign in at $(public_url) with:"
  say "Admin: $PERETYN_ADMIN_EMAIL"
  say "Password: $ADMIN_PASSWORD"
  say "This password is shown once. Change it after you sign in."
}

say_next_steps() {
  say ""
  say "Next steps:"
  say "  1. Sign in and create an organization and a project. Copy the development key."
  say "  2. Install the CLI: curl -fsSL $CLI_INSTALL_URL | sh"
  say "  3. Follow the quickstart with PERETYN_URL=$(public_url): $QUICKSTART_URL"
}

install() {
  check_ports_are_free
  collect_install_answers
  download_deploy_files
  write_env_file
  start_stack
  ADMIN_PASSWORD=$(generate_secret "$ADMIN_PASSWORD_BYTES")
  enroll_admin
  say ""
  say "peretyn $PERETYN_TAG is running at $(public_url)"
  say_when_local_install
  say_when_email_is_off
  say_credentials
  say_next_steps
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
