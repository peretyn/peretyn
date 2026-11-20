Output "/out/set-environment.mp4"

Set Shell bash
Set FontSize 20
Set Width 1500
Set Height 380
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 35ms

Hide
Type "source /repo/services/docs/capture/session.bash && unset PERETYN_TAG COMPOSE_PROGRESS && export PERETYN_URL=http://localhost && clear"
Enter
Sleep 500ms
Show

Sleep 800ms
Type "export PERETYN_TOKEN={{DEVELOPMENT_KEY}}"
Sleep 400ms
Enter
Type "export PERETYN_RUNTIME_URL=$PERETYN_URL"
Sleep 400ms
Enter
Type "export PERETYN_CONTROL_URL=$PERETYN_URL"
Sleep 400ms
Enter
Sleep 600ms
Type "env | grep PERETYN_ | sort"
Sleep 400ms
Enter
Sleep 6s
