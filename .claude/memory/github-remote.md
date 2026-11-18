---
name: github-remote
description: Repo is public on GitHub; the remote may use an SSH host alias for the personal account
metadata:
  type: reference
---

Remote: `aviadfux/properties_manager` on GitHub (public repo). On the first machine the remote is `git@github-personal:aviadfux/properties_manager.git`, where `github-personal` is an SSH host alias for the personal key, because plain `github.com` uses a work key there. On another machine, check `git remote -v` and `ssh -T` before pushing. The `gh` CLI may be signed in to a different (work) account: check `gh auth status` before using it for this repo.

Public repo → no company-specific material and no real personal data, see [[bilingual-spec-files]] and [[security-first]].
