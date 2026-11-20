curl() {
  if [ "$*" = "-fsSL https://peretyn.dev/install" ]; then
    cat /repo/deploy/install.sh
    return
  fi
  command curl "$@"
}

export COMPOSE_PROGRESS=quiet
export PERETYN_TAG="$CAPTURE_PERETYN_TAG"
PS1='\[\e[1;34m\]\w\[\e[0m\] $ '
cd ~ || return
