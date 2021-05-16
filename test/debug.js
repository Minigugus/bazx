import { $, stdout, collect } from '../mod.ts';

await $`echo two arguments, ${'one argument'}`;

console.log(
  await collect(
    $`cat ${'this will cause an error'}`
      .pipe($`env`)
      .pipe(new TransformStream({
        transform(chunk, controller) {
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
