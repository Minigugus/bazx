import type { OpaqueCommand } from './bazx.ts';

async function collectAsString(readable: ReadableStream<Uint8Array>, preventTrim = false) {
  let str = '';
  let read;
  const decoder = new TextDecoder();
  const reader = readable.getReader();
  while (!(read = await reader.read()).done)
    str += decoder.decode(read.value, { /*stream: true as any*/ }); // Stream mode not supported yet in Deno
  str += decoder.decode(undefined, { stream: false });
  return preventTrim ? str : str.trim();
}

/**
 * Read stdout from the specified command line as string
 * @param command The command to read stdout from
 * @returns The stdout stream concatenated as a string, plus process exit code
 */
export async function stdout(command: OpaqueCommand) {
  const [stdout, result] = await Promise.all([
    collectAsString(command.stdout),
    command
  ]);
  return {
    ...result,
    stdout
  };
}

/**
 * Read stderr from the specified command line as string
 * @param command The command to read stderr from
 * @returns The stderr stream concatenated as a string, plus process exit code
 */
export async function stderr(command: OpaqueCommand) {
  const [stderr, result] = await Promise.all([
    collectAsString(command.stderr),
    command
  ]);
  return {
    ...result,
    stderr
  };
}

/**
 * Read both stdout and stderr separately from the specified command line as string
 * @param command The command to read stdout and stderr from
 * @returns The stderr and stdout stream concatenated as a string, plus process exit code
 */
export async function collect(command: OpaqueCommand) {
  const [stdout, stderr, result] = await Promise.all([
    collectAsString(command.stdout),
    collectAsString(command.stderr),
    command,
  ]);
  return {
    ...result,
    stdout,
    stderr
  };
}
