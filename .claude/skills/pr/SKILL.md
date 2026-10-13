---
name: pr
description: Use when writing a PR body.
---

# PR body

A reviewer gets the change in 10 seconds. The diff already lists every file;
the body says what the diff can't.

```markdown
## What

<One sentence.>

<Optional: the smallest visual that shows the change.>

## Why

<One sentence.> Refs #N

## How

- <A key decision or step. 4 bullets max.>

**Verified:** <command, test or artifact> · **Door:** one-way | two-way · **Blast radius:** <one word>
```

## Budget

- 15 lines max, not counting the visual. The visual: 10 lines max.
- Leave out what the title, diff or commits already show.
- `Closes #N` replaces `Refs #N` only in the PR that finishes the issue.

## Visual

Add one only when it beats prose. Pick the smallest:

- Layout change: a file tree, as a `diff` for added or removed files.
- Flow change: a call tree, or a Mermaid sequence.

## Words

Concise ASD-STE100: one idea per sentence, 20 words max, active voice, present
tense, simple words. Use the same term each time; use the project glossary.

## Door

One-way: hard to undo (data migration, deletion, public API). Two-way: a revert
undoes it.
