/// <reference path="./deno.d.ts" />

import { create, BazxOptions } from './mod.ts';

export const $ = createDeno();

export function createDeno(options?: Partial<BazxOptions>) {
  return create({
    async exec(cmd, { stdin, stdout, stderr }) {
      const proc = Deno.run({
        cmd,
        stdin: stdin ? 'piped' : 'null',
        stdout: stdout ? 'piped' : 'null',
        stderr: stderr ? 'piped' : 'null'
      });
      const procIn = stdin && stdin.pipeTo(streamCopyFromStream(proc.stdin!));
      const procOut = stdout && streamCopyToStream(proc.stdout!).pipeTo(stdout);
      const procErr = stderr && streamCopyToStream(proc.stderr!).pipeTo(stderr);
      const result = await proc.status();
      await Promise.all([
        procIn,
        procOut,
        procErr
      ])
      proc.close();
      return result;
    },
    get stdout() {
      return streamCopyFromStream({ write: chunk => Deno.stdout.write(chunk) });
    },
    get stderr() {
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      return new WritableStream<Uint8Array>({
        async write(chunk) {
          await Deno.stderr.write(encoder.encode(`\x1B[31m${decoder.decode(chunk)}\x1B[0m`));
        }
      }, new ByteLengthQueuingStrategy({
        highWaterMark: 16_640
      }));
    }
  }, options);
}

function streamCopyFromStream(writer: Deno.Writer & Partial<Deno.Closer>) {
  return new WritableStream<Uint8Array>({
    async write(chunk) {
      await writer.write(chunk);
    },
    close() {
      writer.close?.();
    },
    abort() {
      writer.close?.();
    }
  }, new ByteLengthQueuingStrategy({
    highWaterMark: 16_640
  }));
}

function streamCopyToStream(reader: Deno.Reader & Deno.Closer) {
  const buffer = new Uint8Array(16_640);
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      let read;
      try {
        while (controller.desiredSize! > 0) {
          if ((read = await reader.read(buffer.subarray(0, Math.min(buffer.byteLength, controller.desiredSize ?? Number.MAX_VALUE)))) === null) {
            reader.close?.();
            controller.close();
            return;
          }
          controller.enqueue(buffer.slice(0, read));
        }
      } catch (err) {
        if (!(err instanceof Deno.errors.BadResource))
          controller.error(err);
        else
          controller.close();
      }
    },
    cancel() {
      reader.close?.();
    }
  }, new ByteLengthQueuingStrategy({
    highWaterMark: 16_640
  }));
}
