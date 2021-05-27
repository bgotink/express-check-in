import execa from 'execa';
import {Readable} from 'stream';

export class ExecError extends Error {
  constructor(message: string, readonly stderr: string) {
    super(message);
    this.name = new.target.name;
  }
}

export function exec(
  command: string,
  args: string[],
  {cwd, input}: {cwd: string; input?: string},
) {
  return new Promise<string>((resolve, reject) => {
    const child = execa(command, args, {
      cwd,
      stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'],
    });

    const out: Buffer[] = [];
    const err: Buffer[] = [];

    child.stdout!.on('data', buf => out.push(buf));
    child.stderr!.on('data', buf => err.push(buf));

    if (child.stdin && input) {
      Readable.from(input).pipe(child.stdin, {end: true});
    }

    child.on('close', (code, signal) => {
      if (code || signal) {
        reject(
          new ExecError(
            code
              ? `Command ${command} exited with code ${code}`
              : `Command ${command} exited with signal ${signal}`,
            Buffer.concat(err).toString('utf-8'),
          ),
        );
      } else {
        resolve(Buffer.concat(out).toString('utf-8'));
      }
    });
  });
}
