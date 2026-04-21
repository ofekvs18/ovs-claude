# Autonomous Task Queue

<!--
Format rules (the orchestrator parses this file):
- Each project block starts with: ## project: <name>
- path:    absolute path to the local repo on your PC
- context: one-line description injected into the Claude Code prompt
- Tasks:   - [ ] <description> | priority: high|medium|low
- Done:    - [x] <description> | priority: ...   (orchestrator writes this automatically)
-->

## project: discord-bot
path: C:\Users\ofek\projects\discord-bot
context: TypeScript discord.js v14 bot deployed on Railway, slash commands, SOS alert system

- [ ] fix rate-limit bug on SOS command | priority: high
- [ ] add /status slash command showing active alerts | priority: medium
- [ ] write unit tests for alert dispatch logic | priority: low

## project: office-scripts
path: C:\Users\ofek\projects\office-scripts
context: Office Scripts TypeScript for Excel automation, todo aggregator and conditional formatting

- [ ] refactor todo-aggregator to use Map instead of nested array loops | priority: high
- [ ] add CSV export to todo aggregator output | priority: low
