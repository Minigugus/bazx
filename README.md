<center>
  <h1><a href="https://deno.land/x/bazx">BAZX</a></h1>

> 🐚️ [zx](https://github.com/google/zx) on 💊️ steroids
</center>

> You are seeing the code of an upcoming release. The `main` branch contains the latest released code.
> Code on this branch is still under discussion and documentation is not completed yet.

## Main differences with ZX

 * Written from scratch
 * **0 dependencies** by default
 * **Plateform-agnostic** (not limited to *Deno* or *NodeJS*)
 * Extensible (enables **remote command execution** and thus **browser support**)
 * **Middlewares** support (filter allowed commands, hack input/outputs, and much more)
 * [**Streams**](#streams) at the core for better performances ([no streaming support with zx](https://github.com/google/zx/issues/14#issuecomment-841672494))
 * No shell by default (the `|` in ``$`echo |`;`` is not evaluated by default)
 * Modern (TypeScript, Deno, ES2020)
 * **MIT** vs Apache license
 * Library only

## Support

 * Deno: 🐥️ (working)
 * NodeJS: 🥚️ (not started yet)
 * QuickJS: 🥚️ (not started yet)
 * Browser: 🥚️ (not started yet)
 * Mock: 🐣️ (started)

## Setup

### Deno

```js
import $ from 'https://deno.land/x/bazx/deno.ts';
```

As of now, only the `--allow-run` command is required at runtime.

### Isomorphic (for testing purpose)

```js
import $ from 'https://deno.land/x/bazx/mock.ts';
```

This implementation doesn't know how to spawn a process and thus always throw.
Intended to be used along with middlewares in tests or sandboxes for instance.

### (Bring Your Own Runtime)

```ts
import { createBazx } from 'https://deno.land/x/bazx/mod.ts';

const $ = createBazx((
  cmd: [string, ...string[]],
  options: {
    cwd?: string,
    env?: Record<string, string>,
    stdin?: ReadableStream<Uint8Array>,
    stdout?: WritableStream<Uint8Array>,
    stderr?: WritableStream<Uint8Array>,
    signal?: AbortSignal,
  }
): PromiseLike<{ code: number }> => {
  // Spawn commands here.
  //
  // CAUTION: This function is reponsible for closing stdin/stdout/stderr.
  //          Missing to do so will result in deadlocks.
}, { /* Default options (logging, colors, and so on) */ });
```

## Usage

See the [`examples`](examples/) folder for more examples

### Middlewares

Middlewares are hooks that runs a process get spawned, so that it can for instance
dynamically hack streams, change the command line, working directories and environment
variabes, never really spawn a process, spawn a process twice, and so on.

For instance, this really simple middleware wraps processes with `time`, so that some process meta are displayed:

```typescript
import { BazxMiddleware } from 'https://deno.land/x/bazx/mod.ts';

export const timeWrapperMiddleware: BazxMiddleware =
  exec => (cmd, options) => exec(['time', ...cmd], options);
```

Then, it can be applied with the `$.with` function:

```typescript
import $ from 'https://deno.land/x/bazx/deno.ts';

const $$ = $.with(timeWrapperMiddleware);

await $$`echo Hello world!`.status

// $ echo Hello world!
// Hello world!
// 0.00user 0.00system 0:00.00elapsed 100%CPU (0avgtext+0avgdata 1936maxresident)k
// 0inputs+0outputs (0major+73minor)pagefaults 0swaps
```

As you can may have noticed, only the original command is printed to the user,
not the updated one with `time`. This way, middlewares are fully transparents to the user.

Each `.with` call returns a new `$` instance that use the config of the parent (`exec`, `options` and middlewares),
so that multiple `.with` calls can be chained.

### TODO

 * [ ] Improve docs (README + JSDoc)
 * [ ] Rollup for NodeJS and browser builds
 * [ ] Add more runtime support (NodeJS at least)
 * [ ] Fix bugs (some complex use case doesn't work yet)
 * [X] Dynamic config update (like `set` in bash (enable/disable logs, etc.))
 * [X] `NO_COLOR` support (for CI/CD)
 * [ ] Pipelines starting with a stream
 * [ ] `stderr` pipes
 * [ ] Add benchmarks, improve perfs (audit WHATWG streams perfs)
 * [ ] Discuss envrionment variables support

## FAQ

### Why is it called `bazx`?

Just like `bash` built from `sh`, there should be a `bazx` built from `zx` 😁️

### How do you prononce `bazx`?

*basix* (just like *basic* but with a *x* instead of a *c* at the end)

## License

Inspired by [zx](https://github.com/google/zx)

[MIT License](LICENSE)

Copyright 2021 Minigugus
