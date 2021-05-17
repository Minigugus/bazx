import { $, stdout, collect } from '../mod.ts';

await $`echo two arguments, ${'one argument'}`;

// FROM https://github.com/google/zx/issues/35#issue-880926668
const dir = import.meta.url.slice(import.meta.url.indexOf('://') + 3, import.meta.url.lastIndexOf('/'));
console.log(
  await collect(
    $`find ${dir} -type f -print0`
      .pipe($`xargs -0 grep foo`)
      .pipe($`wc -l`)
  )
);

console.log(
  await collect(
    $`cat ${'this will cause an error'}`
      .pipe($`env`)
      .pipe(new TransformStream({
        transform(chunk) {
          console.warn('DROPPED', chunk.byteLength, 'BYTES');
        },
        flush(controller) {
          controller.enqueue(new TextEncoder().encode('TRANSFORMED BY TRANSFORM STREAM\nTHIS LINE WILL BE REMOVED BY grep'));
        }
      }))
      .pipe($`grep STREAM`)
  )
);

console.log(
  await stdout(
    $`wget --limit-rate 3 -O - http://detectportal.firefox.com/success.txt`
      .pipe(new TransformStream({
        transform(chunk, controller) {
          controller.enqueue(new TextEncoder().encode(new TextDecoder().decode(chunk).toUpperCase()));
        }
      }))
  )
);

await $`not_found`;
