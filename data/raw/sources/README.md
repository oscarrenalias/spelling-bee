Source inputs for dictionary build.

Automated setup:

```bash
npm run prepare:sources
```

This command will:
- clone/update `en-wl/wordlist` (SCOWL source) into `.cache/`
- build and export `scowl.txt`
- create a local Python venv in `.venv-wordfreq/`
- install `wordfreq`
- generate `wordfreq.tsv`

Optional flags:
- `--scowl-size=60` (default `60`)
- `--region=A` (default `A`)
- `--spelling-level=1` (default `1`)
- `--categories=` (default empty)
- `--python=python3` (choose Python executable)
- `--force-reclone` (drop cached SCOWL repo and clone again)

Files expected by `data/raw/policy.json`:

1. `scowl.txt`
- Plain text word list, one word per line.
- Comment lines starting with `#` are ignored.

2. `wordfreq.tsv`
- Tab-separated file with a header row.
- Must include columns named `word` and `zipf`.
- Example:
  `word<TAB>zipf`
  `about<TAB>5.22`

Notes:
- `policy.json` currently marks both files as optional.
- If these files are present, they are included automatically.
- If absent, the pipeline falls back to `data/raw/dictionary-base.txt`.
