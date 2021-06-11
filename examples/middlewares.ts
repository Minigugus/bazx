import $, { filtered } from '../deno.ts';

let $safe = $
  .with(filtered(
    cmd => ['echo'].includes(cmd[0]) // only the `echo` command is allowed to run
  ))

let text = await $safe`echo Hello world!`.text()

let alwaysNull = null;
try {
  alwaysNull = await $safe`rm -rf /`.status
} catch (err) {
  console.error(err);
}

let mixed$ = await $safe`echo From echo` // using $safe
  .pipe($`sh -c ${'cat >&2; echo From sh'}`) // using $
  .text()

// advanced usage
import { interceptCurl, swapStdoutStderr, shWrapper } from '../deno.ts';

let $$ = $
  .with(shWrapper) // last invoked
  .with(interceptCurl) // first invoked

let $swap = $$
  .with(swapStdoutStderr)

let advanced = await (
  await $safe`echo ${new Date().toISOString()}` // passed as input to `curl` below
    .pipe($$`curl http://detectportal.firefox.com/success.txt`)
    .env('Content-Type', 'text/plain') // passed to `curl` above

    // transform `curl` output
    .pipe(new TransformStream({
      transform(chunk, controller) {
        for (let index = 0; index < chunk.length; index++)
          if (chunk[index] === 10)
            break;
          else
            chunk[index]++;
        controller.enqueue(chunk);
      }
    }))

    // >&2 works thanks to `shWrapper` and is required to print to stdout because of `swapStdoutStderr`
    .pipe($swap`cat - /notfound >&2`)
).text() // not calling `.text()` directly to avoid an error with `cat` that exit with code 1

console.table({
  text,
  alwaysNull,
  mixed$,
  advanced
})
