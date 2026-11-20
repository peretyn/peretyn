Output "/out/publish-terminal.mp4"

Set Shell bash
Set FontSize 24
Set Width 1600
Set Height 1000
Set Padding 32
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms

Hide
Type "source /repo/services/docs/capture/session.bash && source /out/quickstart.env && cd ~/peretyn-quickstart && clear"
Enter
Sleep 500ms
Show

Sleep 800ms
Type "peretyn build --schema schema.ts"
Sleep 400ms
Enter
Wait+Screen@1m /apply/
Sleep 2s
Type "peretyn plan"
Sleep 400ms
Enter
Wait+Screen@1m /run: peretyn apply/
Sleep 3s
Type "peretyn apply --label v1"
Sleep 400ms
Enter
Wait+Screen@1m /v1/
Sleep 3s
