export interface BazxExecConfig {
  cwd?: string;
  env?: Record<string, string>;
  stdin?: ReadableStream<Uint8Array>;
  stdout?: WritableStream<Uint8Array>;
  stderr?: WritableStream<Uint8Array>;
  signal?: AbortSignal;
}

export type BazxExec = (cmd: [string, ...string[]], options?: BazxExecConfig) => Promise<{ code: number }>;
