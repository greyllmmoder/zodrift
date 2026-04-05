Output assets/demo.gif
Require node
Set Shell "zsh"
Set FontSize 18
Set Width 1200
Set Height 700
Set Theme "Builtin Solarized Dark"
Set Padding 24
Set Framerate 30

Type "cd /Users/bennyxavier/dev/25CR2025/zodrift" Enter
Sleep 500ms
Type "node dist/cli.js check --pattern examples/broken.ts --semantics both" Enter
Sleep 700ms
Type "echo drift gate: FAIL (exit 1)" Enter
Sleep 500ms
Type "node dist/cli.js check --pattern examples/fixed.ts --semantics both" Enter
Sleep 700ms
Type "echo drift gate: PASS (exit 0)" Enter
Sleep 1200ms
