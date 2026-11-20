Output "/out/start-peretyn.mp4"

Set Shell bash
Set FontSize 20
Set Width 1500
Set Height 760
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 45ms

Hide
Type "source /repo/services/docs/capture/session.bash && clear"
Enter
Sleep 500ms
Show

Sleep 800ms
Type "curl -fsSL https://peretyn.dev/install | sh"
Sleep 600ms
Enter

Wait+Screen@1m /Install directory/
Sleep 1.5s
Enter
Wait+Screen /Domain for peretyn/
Sleep 1.2s
Enter
Wait+Screen /Admin email/
Sleep 600ms
Type "you@example.com"
Sleep 500ms
Enter
Wait+Screen /Admin name/
Sleep 1s
Enter
Wait+Screen /Resend API key/
Sleep 1s
Enter
Wait+Screen /Install\? \[Y\/n\]/
Sleep 2.5s
Enter

Hide
Wait+Screen@5m /Next steps/
Show
Sleep 7s
