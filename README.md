<center>
  <h1><a href="https://deno.land/x/bazx">BAZX</a></h1>

> 🐚️ [zx](https://github.com/google/zx) on 💊️ steroids
</center>

[![asciicast](https://asciinema.org/a/ydfYbBXFyDDyDOeSPormkjEo6.svg)](https://asciinema.org/a/ydfYbBXFyDDyDOeSPormkjEo6)

## Main differences with ZX

 * Written from scratch
 * **0 dependencies** by default
 * **Plateform-agnostic** (not limited to *Deno* or *NodeJS*)
 * Extensible (enables **remote command execution** and thus **browser support**)
 * [**Streams**](#streams) at the core for better performances ([no streaming support with zx](https://github.com/google/zx/issues/14#issuecomment-841672494))
 * Tree-shakable (usefull for **bundling**)
 * Modern (TypeScript, Deno, ES2020)
 * **MIT** vs Apache license
 * Library only

### Streams

Unlike zx, bazx doesn't gather outputs into possibly big strings by default. The main reason for that is to avoid out of memory, especially on embedded devices and with "loud" commands (for instance, ``await $`yes`;`` with zx *will* crash the process, but not with bazx).

## Support

 * Deno: 🐥️ (working)
 * NodeJS: 🥚️ (not started yet)
 * QuickJS: 🥚️ (not started yet)
 * Browser: 🥚️ (not started yet)
 * Mock: 🥚️ (not started yet)

## Setup

### Deno

```js
import { $ } from 'https://deno.land/x/bazx/mod.ts';
```

As of now, only the `--allow-run` command is required at runtime.

### (Bring Your Own Runtime)

```ts
// `index.ts` is isomorphic, `mod.ts` is Deno only
import { create } from 'https://deno.land/x/bazx/index.ts';

const $ = create({
  exec(
    cmd: [string, ...string[]],
    streams: {
      stdin: ReadableStream<Uint8Array>,
      stdout: WritableStream<Uint8Array>,
      stderr: WritableStream<Uint8Array>
    }
  ): PromiseLike<{ success: boolean, code: number }> {
    // Create thread here
  }
}, { /* Default options */ });
```

## Usage

See the [`test`](test/) folder for more complete examples

### The `$` tagged template function

Prepare a command. The process will spawn only when the returned object will be awaited (`then` called). The returned object as `stdin`, `stdout` and `stderr` properties, that are streams the user can use to communicated with the process. Also, it is possible to call the `pipe(cmdOrTransfertStream: NativeCommand | PipeCommand | TransformStream)` function to pipe the *this* command into the provided `cmdOrTransfertStream` stream, or to `stdin` stream of the provided command.

```js
$`echo Never called`; // (never executed - missing `await`)

await $`echo Hi!`; // $ echo Hi!

const cmd = $`echo Only invoked once`;
(await cmd) === (await cmd); // => true

await $`env`.pipe($`grep PATH`); // $ env | grep PATH
```

The `$` function can be obtained using the `create` function, or from a third party module that wrap this function. For instance, the [`deno.ts`](deno.ts) module expose a `createDeno` function, which is a wrapper function around `create`.

See [`test/debug.js`](test/debug.js) for a pratical overview.

### `stdout`, `stderr` and `collect` exports

Utilities to read respectively `stdout`, `stderr` and both from the command passed as argument:

```js
import { stdout } from 'https://deno.land/x/bazx/index.ts';

console.log(await stdout($`echo Hello world!`));

// => { success: true, code: 0, stdout: "Hello world!" }
```

### Environment variables

Environment variables are inherited from the runtime. For instance, with *Deno*, you must use `Deno.env` with the appropriate permission to change environment variables passed to the child process (`Deno.run` inherits `Deno.env` by default).

Environment variables are still under discussion. Suggestions welcomed :slightly_smiling_face:.

## WIP

This project is a work in progress for now; bugs and API change are expected.

Please fill an issue for any bug you encounter and open a discussion for any question or suggestion. :wink:

### TODO

 * [ ] Improve docs
 * [ ] Rollup for NodeJS and browser builds
 * [ ] Add more runtime support (NodeJS at least)
 * [ ] Fix bugs (some complex use case doesn't work yet)
 * [ ] Dynamic config update (like `set` in bash (enable/disable logs, etc.))
 * [ ] `NO_COLOR` support (for CI/CD)
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
