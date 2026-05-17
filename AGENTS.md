---
description: Codex entrypoint that delegates to CLAUDE.md and project skills.
alwaysApply: true
---

# AGENTS.md

このプロジェクトは Claude で作成・運用されていたため、共通の正本は `CLAUDE.md` と `.claude/rules/` に置く。

## Codex の読み込み方

1. まず `CLAUDE.md` を読む。開発コマンド、技術スタック、核心ルール、構成、制約は `CLAUDE.md` を正とする。
2. 詳細ルールが必要な作業では、Agent Skill `$bonnsa-sns-rules` を使う。
3. `$bonnsa-sns-rules` は `.claude/rules/*.md` の索引として使い、作業に関係するルールだけを必要時に読む。
4. `.claude/rules` の本文を `AGENTS.md` に複製しない。Claude が読める既存形式を維持する。
5. ルールを更新する場合は、正本である `CLAUDE.md` または `.claude/rules/*.md` を更新し、`AGENTS.md` は薄い参照入口のまま保つ。

## Project Skill

- Skill: `.codex/skills/bonnsa-sns-rules/SKILL.md`
- 用途: Codex が `.claude/rules` を必要なときだけ読み込むためのナビゲーション
