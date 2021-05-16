# bazx (🐚️ + 💊️)

> 🐚️ [zx](https://github.com/google/zx) on 💊️ steroids

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

## Setup

### Deno

```js
import { $ } from 'https://github.com/Minigugus/bazx/master/mod.ts';
```

As of now, only the `--allow-run` command is required at runtime.

### (Bring Your Own Runtime)

```ts
import { create } from 'https://github.com/Minigugus/bazx/master/index.ts'; // `index.ts` is isomorphic, `mod.ts` is Deno only

const $ = create({
  exec(
    cmd: [string, ...string[]],
    streams: {
      stdin: ReadableStream<Uint8Array>,
      stdout: WritableStream<Uint8Array>,
      stderr: WritableStream<Uint8Array>
    }
  ): PromiseLike<{ success: boolean, code: number }> {
    // Insert runtime-dependant code here
  }
}, { /* Default options */ });
```

## Usage

See TypeScript types and documentation for more a accurate documentation.

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
console.log(await stdout($`echo Hello world!`));

// => { success: true, code: 0, stdout: "Hello world!" }
```

## WIP

This project is work in progress for now; bugs and API change are expected.

Please fill an issue for any bug you encounter :wink:.

### TODO

 * Rollup for NodeJS and browser builds
 * Improve docs
 * Add more runtime support (NodeJS at least)
 * Fix bugs (some complex use case doesn't work yet)

## License

[MIT](LICENSE)
