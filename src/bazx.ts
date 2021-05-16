const RUN = Symbol();

export interface ExecutionResult {
  success: boolean;
  code: number;
}

export interface BazxContext {
  log(cmd: OpaqueCommand, streams: CommandStreamConfig): void;
  exec(cmd: [string, ...string[]], streams: CommandStreamConfig): PromiseLike<ExecutionResult>;
  throw: boolean;
}

export abstract class OpaqueCommand implements PromiseLike<ExecutionResult> {
  #context: BazxContext;
  #completed: PromiseLike<ExecutionResult> | null = null;

  #stdin: TransformStream<Uint8Array, Uint8Array> | null = null;
  #stdout: TransformStream<Uint8Array, Uint8Array> | null = null;
  #stderr: TransformStream<Uint8Array, Uint8Array> | null = null;

  protected abstract [RUN](exec: BazxContext['exec'], streams: CommandStreamConfig): PromiseLike<ExecutionResult>;

  // abstract readonly stdin: WritableStream<Uint8Array>;
  // abstract readonly stdout: ReadableStream<Uint8Array>;
  // abstract readonly stderr: ReadableStream<Uint8Array>;

  protected constructor(
    context: BazxContext
  ) {
    this.#context = context;
  }

  private get completed(): PromiseLike<ExecutionResult> {
    if (this.#completed === null) {
      const streams = {
        stdin: this.#stdin?.readable || null,
        stdout: this.#stdout?.writable || null,
        stderr: this.#stderr?.writable || null
      };
      this.#context.log(this, streams);
      this.#completed = this[RUN](this.#context.exec, streams).then(res => {
        if (res.success || !this.#context.throw)
          return res;
        throw new Error(`Command "${this}" exited with code ${res.code}`);
      }, err => {
        throw new Error(`Command "${this}" failed: ${err?.message ?? err}`);
      });
    }
    return this.#completed;
  }

  get stdin(): WritableStream<Uint8Array> {
    if (this.#stdin === null)
      this.#stdin = new TransformStream<Uint8Array, Uint8Array>({}, strategy, strategy);
    return this.#stdin.writable;
  }

  get stdout(): ReadableStream<Uint8Array> {
    if (this.#stdout === null)
      this.#stdout = new TransformStream<Uint8Array, Uint8Array>({}, strategy, strategy);
    return this.#stdout.readable;
  }

  get stderr(): ReadableStream<Uint8Array> {
    if (this.#stderr === null)
      this.#stderr = new TransformStream<Uint8Array, Uint8Array>({}, strategy, strategy);
    return this.#stderr.readable;
  }

  then<TResult1 = ExecutionResult, TResult2 = never>(
    onfulfilled?: ((value: ExecutionResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.completed.then(onfulfilled, onrejected);
  }

  pipe(target: OpaqueCommand): PipedStdoutCommand;
  pipe(target: TransformStream): TransformStreamCommand;
  pipe(target: OpaqueCommand | TransformStream): PipedStdoutCommand | TransformStreamCommand {
    if (target instanceof OpaqueCommand)
      return new PipedStdoutCommand(this.#context, this, target);
    return new TransformStreamCommand(this.#context, this, target);
  }
}

export class TransformStreamCommand extends OpaqueCommand {
  #input: OpaqueCommand;
  #output: ReadableStream<Uint8Array> | null = null;
  #stdin: WritableStream<Uint8Array>;
  #stdout: ReadableStream<Uint8Array>;

  public constructor(
    context: BazxContext,
    input: OpaqueCommand,
    stream: TransformStream<Uint8Array, Uint8Array>
  ) {
    super(context);
    this.#input = input;
    this.#stdin = stream.writable;
    this.#stdout = stream.readable;
  }

  protected async [RUN](exec: BazxContext['exec'], { stdin, stdout, stderr }: CommandStreamConfig): Promise<ExecutionResult> {
    const pipe = new TransformStream<Uint8Array, Uint8Array>({}, strategy);
    const inPipe = pipe.readable.pipeTo(this.#stdin);
    const outPipe = stdout && this.#stdout.pipeTo(stdout);
    const result = this.#input[RUN](exec, {
      stdin,
      stdout: pipe.writable,
      stderr
    });
    await Promise.all([inPipe, outPipe]);
    return result;
  }

  get stdin() {
    return this.#input.stdin;
  }

  get stdout() {
    if (this.#output === null) {
      const [first, second] = this.#stdout.tee();
      this.#stdout = first;
      this.#output = second;
    }
    return this.#output;
  }

  get stderr() {
    return this.#input.stderr;
  }

  toString() {
    return `${this.#input} \x1B[35m|\x1B[0m \x1B[33m<#stream>\x1B[0m`;
  }
}

export class PipedStdoutCommand extends OpaqueCommand {
  #left: OpaqueCommand;
  #right: OpaqueCommand;

  public constructor(
    context: BazxContext,
    left: OpaqueCommand,
    right: OpaqueCommand
  ) {
    super(context);
    this.#left = left;
    this.#right = right;
  }

  protected async [RUN](exec: BazxContext['exec'], { stdin, stdout, stderr }: CommandStreamConfig): Promise<ExecutionResult> {
    const pipe = new TransformStream<Uint8Array, Uint8Array>({}, strategy);
    const writer = stderr?.getWriter();
    let left = 2;
    const [, result] = await Promise.all([
      this.#left[RUN](exec, {
        stdin,
        stdout: pipe.writable,
        stderr: !writer ? null : writableStreamFromWriter(writer, () => (--left || writer.close()))
      }),
      this.#right[RUN](exec, {
        stdin: pipe.readable,
        stdout,
        stderr: !writer ? null : writableStreamFromWriter(writer, () => (--left || writer.close()))
      })
    ]);
    return result;
  }

  get left() {
    return this.#left;
  }

  get right() {
    return this.#right;
  }

  // get stdin(): WritableStream<Uint8Array> {
  //   return this.#left.stdin;
  // }
  // get stdout(): ReadableStream<Uint8Array> {
  //   return this.#right.stdout;
  // }
  // get stderr(): ReadableStream<Uint8Array> {
  //   return this.#right.stderr; // TODO merge
  // }

  toString() {
    return `${this.#left} \x1B[35m|\x1B[0m ${this.#right}`;
  }
}

const strategy = new ByteLengthQueuingStrategy({
  highWaterMark: 65535
});

export interface CommandStreamConfig {
  stdin: ReadableStream<Uint8Array> | null,
  stdout: WritableStream<Uint8Array> | null,
  stderr: WritableStream<Uint8Array> | null
}

export interface CommandInfo {
  cmd: [string, ...string[]];
}

export class NativeCommand extends OpaqueCommand {
  #info: CommandInfo;

  public constructor(
    context: BazxContext,
    info: CommandInfo
  ) {
    super(context);
    this.#info = info;
  }

  protected [RUN](exec: BazxContext['exec'], streams: CommandStreamConfig): PromiseLike<ExecutionResult> {
    return exec(this.#info.cmd, streams);
  }

  get command() {
    return this.#info.cmd[0];
  }

  get args() {
    return this.#info.cmd.slice(1);
  }

  toString() {
    return `\x1B[32m${this.command}\x1B[0m ${this.args.map(x => `\x1B[4m${x}\x1B[0m`).join(' ')}`.trim();
  }
}

function writableStreamFromWriter(writer: WritableStreamDefaultWriter<Uint8Array>, done: (err?: any) => void) {
  return new WritableStream<Uint8Array>({
    async write(chunk) {
      await writer!.write(chunk);
    },
    abort(err) {
      done(err);
    },
    close() {
      done();
    }
  });
}
