# Contributing

Thanks for helping! The project translates React Native's API onto [Ink](https://github.com/vadimdemedes/ink). Rendering, layout and input belong to Ink; this library maps props, styles and behaviors.

## Setup

Use Node.js 22 or newer.

```sh
npm install
npm test
```

## Layout of the code

| Path                   | What lives there                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/style/`           | Pure functions translating React Native styles into Ink props                                         |
| `src/style/support.ts` | The support table behind dev warnings and `docs/compat.md`                                            |
| `src/components/`      | React Native components built from Ink's `Box`/`Text` and hooks                                       |
| `src/apis/`            | React Native APIs (AppRegistry, Animated, Alert, ...)                                                 |
| `src/internal/`        | Shared machinery: focus model, app root, modal host, contexts                                         |
| `test/`                | Unit tests, golden renders (`renderToString`), interaction tests (ink-testing-library), example tests |
| `examples/`            | Runnable apps: `npm run example -- <name>`                                                            |

## Guidelines

- **Match React Native first.** Use React Native's prop names, defaults and event shapes. If a terminal can't do something, ignore it with a `warnOnce` and add it to the support table, rather than throwing.
- **Add tests with every behavior.** Golden renders go in `test/render.test.tsx`; keyboard behavior goes in an interaction test.
- **Keep styles pure and covered.** Style translation stays in pure functions with table-driven tests (coverage gate: 95% for `src/style`).
- **Regenerate the compat doc** when you change the support table or the inventory in `scripts/generate-compat.ts`: `npm run docs:compat`.
- **Run the checks before opening a PR:** `npm run lint && npm run typecheck && npm test && npm run build`.

## Releasing

1. Update `version` in `package.json` and move the CHANGELOG entry out of "unreleased".
2. Commit, then tag and push: `git tag v0.1.0 && git push origin v0.1.0`.
3. The Release workflow tests and publishes to npm with provenance. It needs either npm trusted publishing configured for the repository or an `NPM_TOKEN` secret.
