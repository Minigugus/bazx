import type { BazxExec } from './provider.ts';

export type BazxMiddleware = (exec: BazxExec) => BazxExec;

export function filtered(predicate: (cmd: [string, ...string[]]) => boolean): BazxMiddleware {
  return exec => function filteredExec(cmd, options) {
    if (!predicate(cmd))
      throw new Error(`${cmd[0]}: not allowed to execute`);
    return exec(cmd, options);
  }
}

export const swapStdoutStderr: BazxMiddleware = exec => (cmd, options = {}) => exec(cmd, {
  ...options,
  stdout: options?.stderr, // stdout becomes stderr
  stderr: options?.stdout  // stderr becomes stdout
});

export const shWrapper: BazxMiddleware = exec => (cmd, options) =>
  exec(
    [
      'sh',
      '-c',
      cmd
        .map(a => a.includes(' ') ? `"${a}"` : a)
        .join(' ')
    ],
    options
  );

export const interceptCurl: BazxMiddleware = exec => async (cmd, options = {}) => {
  if (cmd[0] !== 'curl')
    return exec(cmd, options)
  await options.stderr?.abort(); // middleware MUST ensure that all streams in `options` are closed (deadlock otherwise)
  const response = await fetch(
    new URL(cmd[cmd.length - 1 || 1] ?? '', new URL(options.cwd || '.', 'file:///')).href,
    {
      method: options.stdin ? 'POST' : 'GET',
      headers: options.env,
      body: options.stdin
    }
  );
  if (response.body)
    await response.body.pipeTo(options.stdout ?? new WritableStream());
  else if (options.stdout)
    await options.stdout?.abort();
  return {
    code: response.status - 200
  }
}
