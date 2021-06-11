// Isomorphic bazx implementation that never runs a command (always throw).
// Intended to be used along with middlewares.

/// <reference path="./deno.d.ts" />

export * from './mod.ts'

import type { BazxExec, BazxOptions } from './mod.ts';

import { createBaxz } from './mod.ts';

export const exec: BazxExec = async function exec(cmd, { stdin, stdout, stderr } = {}) {
  await Promise.all([
    stdin?.cancel(),
    stdout?.getWriter().close(),
    stderr?.getWriter().close()
  ]);
  throw new Error(`${cmd[0]}: command not found`); // FIXME Return code 0 instead?
}

export const options: BazxOptions = {};

export const $ = createBaxz(exec, options);

export default $;
