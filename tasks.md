# Autonomous Task Queue

<!--
Format rules (the orchestrator parses this file):
- Each project block starts with: ## project: <name>
- path:    absolute path to the local repo on your PC
- context: one-line description injected into the Claude Code prompt
- Tasks:   - [ ] <description> | priority: high|medium|low
- Done:    - [x] <description> | priority: ...   (orchestrator writes this automatically)
-->

## project: biomarkers
path: C:\Users\ofek\Downloads\gitRepos\Project\biomarker-pipeline
context: Python bioinformatics pipeline for biomarker analysis

- [x] verify hydra migration is done | priority: high
- [x] commit changes to git | priority: medium


## project: claude automation
path: C:\Users\ofek\Downloads\gitRepos\ClaudeToDoAutomation
context: node project to automate todo list with claude

- [x] make the code run at each hour at hh:05 instead of each 15 minutest from start | priority: high
