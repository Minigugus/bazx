import $ from '../deno.ts';

let response = await $`echo Hi!`;

let text = await $`echo Hello world!`.text()

let [json] = await $`echo ${JSON.stringify(["Hello world!"])}`.json()

let buffer = await $`echo Hello world!`
  .pipe($`gzip`)
  .arrayBuffer()

let env = await $`env` // sees `WTF_A=wtf`, `WTF_B=b`
  .env('WTF_A', 'erased')
  .env('WTF_A', 'wtf')
  .pipe($`sh -c ${ // sees `WTF_A=a`, `WTF_B=b`
    'echo \\"env\\" sees: >&2; grep WTF; echo \\"sh\\" sees: >&2; env | grep WTF'
    }`)
  .env('WTF_A', 'a')
  .env('WTF_B', 'b')
  .text()

let cwd = await $`pwd` // runs in `/bin`
  .cwd('/root')
  .cwd('/bin')
  .pipe($`sh -c ${'cat; pwd'}`) // runs in `/`
  .cwd('/')
  .text()

let status = await $`sh -c ${'exit 42'}`.status

let throws;
try {
  throws = await $`grep nothing`.text()
} catch (err) {
  if (!(err?.response instanceof Response))
    throw err;
  throws = `Nothing found (exit code: ${err.response.status})`
}

console.table({
  text,
  json,
  buffer: String(buffer),
  env,
  cwd,
  status,
  throws,
  response: String(response),
});
