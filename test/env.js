/// <reference path="../deno.d.ts" />

import { $, stdout } from '../mod.ts';

const VAR = 'CUSTOM_VARIABLE';

switch ((await Deno.permissions.query({ name: 'env' })).state) {
  case 'prompt':
    if ((await Deno.permissions.request({ name: 'env' })).state !== 'granted')
      break;
  case 'granted':
    Deno.env.set(VAR, 'custom_value');
}

try {
  console.log(
    'FOUND:',
    (await stdout(
      $`env`
        .pipe($`grep -- ${VAR}`)
    )).stdout
  );
} catch (err) {
  console.log('NOT FOUND (missing permission?)');
}
