import {
  ExecutionResult,
  OpaqueCommand,
  CommandStreamConfig,
  NativeCommand,
  BazxContext
} from './bazx.ts';

export * from './utils.ts';

export interface Bazx {
  (xs: TemplateStringsArray, ...args: any[]): NativeCommand;
}

export interface BazxConfig {
  logger?(cmd: OpaqueCommand): void;
  stdout?: WritableStream<Uint8Array>;
  stderr?: WritableStream<Uint8Array>;

  parse?(xs: TemplateStringsArray, ...args: any[]): [string, ...string[]];

  exec(cmd: [string, ...string[]], streams: CommandStreamConfig): PromiseLike<ExecutionResult>
}

export interface BazxOptions {
  logcmd: boolean;
  errexit: boolean;
}

export function create(config: BazxConfig, defaultOptions: Partial<BazxOptions> = {}): Bazx {
  const options: BazxOptions = Object.assign({
    logcmd: true,
    errexit: true
  }, defaultOptions);
  const context: BazxContext = {
    get throw() {
      return options.errexit;
    },
    log,
    exec
  };
  return $;

  function mergeWritable(left: WritableStream<Uint8Array>, right: WritableStream<Uint8Array>) {
    const middle = new TransformStream();
    const [first, second] = middle.readable.tee();
    first.pipeTo(left);
    second.pipeTo(right);
    return middle.writable;
  }

  function log(cmd: OpaqueCommand, streams: CommandStreamConfig) {
    if (options.logcmd) {
      if (config.logger)
        config.logger(cmd);
      else if (config.stdout) {
        const writer = config.stdout.getWriter();
        writer.write(new TextEncoder().encode(`$ ${cmd}\n`));
        writer.close();
      }
      if (config.stdout)
        streams.stdout = !streams.stdout ? config.stdout : mergeWritable(config.stdout, streams.stdout);
      if (config.stderr)
        streams.stderr = !streams.stderr ? config.stderr : mergeWritable(config.stderr, streams.stderr);
    }
  }

  function exec(cmd: [string, ...string[]], streams: CommandStreamConfig) {
    return config.exec(cmd, streams);
  }

  function $(xs: TemplateStringsArray, ...args: any[]) {
    const cmd = config.parse?.(xs, ...args) ?? parse(xs, ...args);
    return new NativeCommand(context, { cmd });
  }
}

export function parse(xs: TemplateStringsArray, ...args: any[]) {
  if (!Array.isArray(xs) || !Array.isArray(xs.raw))
    throw new Error('$ can only be used as a template string tag');
  const cmd: string[] = [];
  let left = '';
  let i = 0;
  for (let part of xs) {
    for (let index; (index = part.indexOf(' ')) !== -1; part = part.slice(index + 1)) {
      left += part.slice(0, index);
      if (left)
        cmd.push(left);
      left = '';
    }
    left += part;
    left += i === args.length ? '' : args[i++];
  }
  if (left)
    cmd.push(left);
  // const cmd = (xs[0]! + args.map((x, i) => x + xs[i + 1]!).join('')).split(' ').filter(x => x); // FIXME
  if (cmd.length < 1)
    throw new Error('Missing command name');
  return cmd as [string, ...string[]];
}
