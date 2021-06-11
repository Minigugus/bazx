import { BazxExecConfig, BazxExec } from './provider.ts';

function getStrategyFromContext(context: BazxOptions) {
  if (context.highWaterMark)
    return new ByteLengthQueuingStrategy({
      highWaterMark: context.highWaterMark
    });
}

const ENCODER = new TextEncoder();

const createStdoutLogger = (context: BazxOptions) => context.log ? new WritableStream<Uint8Array>({
  async write(chunk) {
    await context.log!(chunk);
  }
}) : undefined;

const createStderrLogger = (context: BazxOptions) => {
  if (!context.log)
    return undefined;
  if (context.noColors)
    return new WritableStream<Uint8Array>({
      async write(chunk) {
        await context.log!(chunk);
      }
    });
  const redBuffer = ENCODER.encode('\x1B[31m');
  const resetBuffer = ENCODER.encode('\x1B[0m');
  return new WritableStream<Uint8Array>({
    async write(chunk) {
      const buffer = new Uint8Array(redBuffer.byteLength + chunk.byteLength + resetBuffer.byteLength);
      buffer.set(redBuffer, 0);
      buffer.set(chunk, redBuffer.byteLength);
      buffer.set(resetBuffer, redBuffer.byteLength + chunk.byteLength);
      await context.log!(buffer);
    }
  });
};

function mergedWritableStream(writer: WritableStreamDefaultWriter<Uint8Array>, done: (err?: any) => void) {
  return new WritableStream<Uint8Array>({
    async write(chunk) {
      await writer!.write(chunk);
    },
    async abort(err) {
      await done(err);
    },
    async close() {
      await done();
    }
  });
}

async function exec2StdoutResponse(
  cmd: string,
  cwd: string | undefined,
  env: Record<string, string>,
  context: BazxOptions,
  invoke: (config?: BazxExecConfig) => ReturnType<BazxExec>
) {
  const strategy = getStrategyFromContext(context);
  const output = new TransformStream<Uint8Array, Uint8Array>(
    context.log ? {
      async transform(chunk, controller) {
        await context.log!(chunk); // Cheap logging hack
        controller.enqueue(chunk);
      }
    } : {},
    strategy,
    strategy
  );
  const [{ code }, result] = await Promise.all([
    invoke({
      cwd,
      env,
      stdout: output.writable,
      stderr: createStderrLogger(context)
    }),
    new Response(output.readable).blob()
  ]);
  return new CommandResponse(
    cmd,
    env,
    code,
    result
  );
}

class Command implements Body, PromiseLike<Response> {
  #context: BazxOptions;

  #fetch: (config?: BazxExecConfig) => ReturnType<BazxExec>;
  #cmd: (colors: boolean) => string;
  #cwd: string | undefined = undefined;
  #env: Record<string, string> = Object.create(null);

  public constructor(
    context: BazxOptions,
    cmd: (colors: boolean) => string,
    fetch: (config?: BazxExecConfig) => ReturnType<BazxExec>
  ) {
    this.#context = context;
    this.#fetch = fetch;
    this.#cmd = cmd;
  }

  then<TResult1 = Response, TResult2 = never>(
    onfulfilled?: (value: Response) => TResult1 | PromiseLike<TResult1>,
    onrejected?: (reason: any) => TResult2 | PromiseLike<TResult2>
  ): PromiseLike<TResult1 | TResult2> {
    return this.stdout.then(onfulfilled, onrejected);
  }

  get body(): ReadableStream<Uint8Array> {
    const buffer = new TransformStream<Uint8Array, Uint8Array>();
    this.stdout
      .then(rejectOnNonZeroExitCode)
      .then(response => response.body!.pipeTo(buffer.writable))
      .catch(err => buffer.writable.abort(err).catch(() => { /* Prevent unhandled promise rejection */ }));
    return buffer.readable;
  }

  get bodyUsed(): boolean {
    return false; // Each call to `body` creates a new stream, so the body is never "used"
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    return this.stdout
      .then(rejectOnNonZeroExitCode)
      .then(response => response.arrayBuffer());
  }

  blob(): Promise<Blob> {
    return this.stdout
      .then(rejectOnNonZeroExitCode)
      .then(response => response.blob());
  }

  formData(): Promise<FormData> {
    return this.stdout
      .then(rejectOnNonZeroExitCode)
      .then(response => response.formData());
  }

  json(): Promise<any> {
    return this.stdout
      .then(rejectOnNonZeroExitCode)
      .then(response => response.json());
  }

  text(): Promise<string> {
    return this.stdout
      .then(rejectOnNonZeroExitCode)
      .then(response => response.text());
  }

  get url() {
    return this.command;
  }

  get command() {
    return this.#cmd(false);
  }

  cwd(path: string | null): Command {
    this.#cwd = path ?? undefined;
    return this;
  }

  env(key: string, value: string | null): Command {
    if (value === null)
      delete this.#env[key];
    else
      this.#env[key] = value;
    return this;
  }

  get ok() {
    return this.status
      .then((code) => code === 0);
  }

  get status(): Promise<number> {
    return Promise.resolve(this.#context.log?.(ENCODER.encode(`$ ${this}\r\n`)))
      .then(() => this.#fetch({
        cwd: this.#cwd,
        env: this.#env,
        stdout: createStdoutLogger(this.#context),
        stderr: createStderrLogger(this.#context)
      }))
      .then(({ code }) => code);
  }

  get stdout(): Promise<CommandResponse> {
    return Promise.resolve(this.#context.log?.(ENCODER.encode(`$ ${this}\r\n`)))
      .then(() => exec2StdoutResponse(
        this.#cmd(false),
        this.#cwd,
        this.#env,
        this.#context,
        this.#fetch
      ));
  }

  toString() {
    return this.#cmd(!this.#context.noColors);
  }

  pipe(command: Command): Command;
  pipe(transformStream: TransformStream<Uint8Array, Uint8Array>): Command;
  pipe(commandOrTransformStream: Command | TransformStream<Uint8Array, Uint8Array>): Command;
  pipe(commandOrTransformStream: Command | TransformStream<Uint8Array, Uint8Array>) {
    if (commandOrTransformStream instanceof Command) {
      const other = commandOrTransformStream;
      return new Command(
        this.#context,
        colors => {
          const left = this.#cmd(colors);
          const right = other.#cmd(colors);
          return !(left && right)
            ? left || right
            : colors
              ? `${left} \x1B[35m|\x1B[0m ${right}`
              : `${left} | ${right}`;
        },
        async ({ cwd, env = {}, stdin, stdout, stderr, signal } = {}) => {
          const strategy = getStrategyFromContext(this.#context);
          const pipe = new TransformStream<Uint8Array, Uint8Array>({}, strategy, strategy);
          const writer = stderr?.getWriter();
          let left = 2;
          const [, result] = await Promise.all([
            this.#fetch({
              cwd: this.#cwd ?? cwd,
              env: Object.assign({}, env, this.#env),
              stdin,
              stdout: pipe.writable,
              stderr: !writer ? undefined : mergedWritableStream(writer, () => (--left || writer.close())),
              signal
            }),
            other.#fetch({
              cwd: other.#cwd ?? cwd,
              env: Object.assign({}, env, other.#env),
              stdin: pipe.readable,
              stdout,
              stderr: !writer ? undefined : mergedWritableStream(writer, () => (--left || writer.close())),
              signal
            })
          ]);
          return result;
        });
    }
    const stream = commandOrTransformStream;
    return new Command(
      this.#context,
      colors => {
        const left = this.#cmd(colors);
        const right = colors ? `\x1B[33m${stream}\x1B[0m` : String(stream);
        return !left
          ? right
          : colors
            ? `${left} \x1B[35m|\x1B[0m ${right}`
            : `${left} | ${right}`;
      },
      async ({ cwd, env = {}, stdin, stdout, stderr, signal } = {}) => {
        const [result] = await Promise.all([
          this.#fetch({
            cwd: this.#cwd ?? cwd,
            env: Object.assign({}, env, this.#env),
            stdin,
            stdout: stream.writable,
            stderr,
            signal
          }),
          stream.readable.pipeTo(stdout || new WritableStream({}))
        ]);
        return result;
      });
  }
}

class CommandResponse extends Response {
  #url: string;
  #status: number;

  public constructor(
    cmd: string,
    env: Record<string, string>,
    status: number,
    stdout: Blob
  ) {
    super(stdout, {
      headers: env
    });
    this.#url = cmd;
    this.#status = status;
  }

  // @ts-ignore
  get url() {
    return this.#url;
  }

  // @ts-ignore
  get status() {
    return this.#status;
  }

  // @ts-ignore
  get ok() {
    return this.#status === 0;
  }
}

function rejectOnNonZeroExitCode(response: Response) {
  if (!response.ok)
    return Promise.reject(
      Object.assign(
        new Error(`Command ${response.url} exited with code ${response.status}`),
        { response }
      )
    );
  return Promise.resolve(response);
}

function parse(xs: TemplateStringsArray, ...args: any[]) {
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

export interface BazxOptions {
  highWaterMark?: number;
  noColors?: boolean;
  log?(chunk: Uint8Array): unknown | Promise<unknown>;
}

export interface $ {
  (xs: TemplateStringsArray, ...args: any[]): Command;

  with(middleware: (exec: BazxExec) => BazxExec): $;
}

export function createBaxz(exec: BazxExec, options: BazxOptions = {}): $ {
  function $(xs: TemplateStringsArray, ...args: any[]) {
    if (args.length === 0 && xs[0]?.length === 0)
      return new Command(options, () => '', async ({ stdin, stdout, stderr } = {}) => {
        await Promise.all([
          stdin?.cancel(),
          stdout?.getWriter().close(),
          stderr?.getWriter().close()
        ]);
        return ({ code: 0, signal: undefined })
      });
    const parsed = parse(xs, ...args);
    return new Command(
      options,
      colors => colors
        ? `\x1B[32m${parsed[0]}\x1B[0m ${parsed.slice(1).map(x => `\x1B[4m${x}\x1B[0m`).join(' ')}`.trim()
        : parsed.join(' '),
      config => exec(parsed, config)
    );
  }

  function withMiddleware(middleware: (exec: BazxExec) => BazxExec): $ {
    return createBaxz(middleware(exec), options);
  }

  return Object.assign($, {
    with: withMiddleware
  });
}
