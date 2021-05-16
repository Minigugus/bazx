// @ts-check

import { $, stdout } from '../mod.ts';

await $`ls -1`.pipe($`wc -l`)

let branch = (await stdout($`git branch`)).stdout
await $`printf ${branch}`.pipe($`wc`) // The new line trimmed from stdout.

let foo = `hi; echo 'oops'`
await $`echo "${foo}"`.pipe($`wc`) // Vars properly quoted.