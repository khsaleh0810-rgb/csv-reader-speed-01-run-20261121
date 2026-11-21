# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/khsaleh0810-rgb/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/khsaleh0810-rgb/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0, for the "Read broken CSV files faster" bounty. `solve.js` gives the reference's answer on every case — the same `{columns, rows, errors}`, broken rows included (short and long rows, stray CRs, quote junk, unterminated quotes, blank lines) — by cutting whole fields out of the text with `indexOf` and `slice` instead of walking it one character at a time, and by taking a whole clean record at once with `split(',')` when it holds no quote and no carriage return. On the kit's practice set it runs about 5x faster than the reference (around 116 ms of CPU against about 604 ms for csv-reader 1.0.0, trimmed mean over 9 runs with `--no-incremental-marking`), with byte-identical answers on all 6 practice cases.

## Run it

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=./practice MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` reads every case from `/input/cases.json` (or `MAKEFUN_INPUT_DIR`), answers each one alone with `run()` from `solve.js`, and writes `/output/answers.json` (or `MAKEFUN_OUTPUT_DIR`).

## Files

- `solve.js` — the faster reader: `run(input)` returns `{columns, rows, errors}`.
- `main.ts` — the driver the harness runs: `node /bot/main.ts`.
- `package.json` — marks the package as an ES module.

---

<sub>Entered on [make.fun](https://make.fun/?ref=nnqh4m6a&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
