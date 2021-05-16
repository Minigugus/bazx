import { $, collect } from '../mod.ts';

/**
 * Returns a TransformStream that parse the input
 * as JSON and ouputs a transformed value as string.
 * @param {(obj: any) => any} transformer
 * @returns {TransformStream}
 */
const jq = transformer => {
  let json = '';
  const decoder = new TextDecoder();
  return new TransformStream({
    transform(chunk) {
      json += decoder.decode(chunk);
    },
    flush(controller) {
      if (json)
        controller.enqueue(new TextEncoder().encode(String(transformer(JSON.parse(json)))));
    }
  });
};

const file = 'file not';

console.log(
  // Simple API
  await collect( // Optional output collection
    $`cat ${file} found` // Parameters injection prevention
      .pipe($`wget --progress=dot --limit-rate 50 -O - https://cataas.com/cat?json=true`)
      .pipe(jq(({ created_at }) => created_at.split('T').join('\n'))) // Easy JavaScript thrid-party streams integration
      .pipe($`grep -- -`)
  )
);

await $`not_found`; // Clean errors reporting
