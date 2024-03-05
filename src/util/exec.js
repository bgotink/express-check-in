import child_process from 'node:child_process';
import {Readable} from 'node:stream';

export class ExecError extends Error {
	stderr;

	/**
	 * @param {string} message
	 * @param {string} stderr
	 */
	constructor(message, stderr) {
		super(message);
		this.name = 'ExecError';
		this.stderr = stderr;
	}
}

/**
 * @param {string} command
 * @param {readonly string[]} args
 * @param {{cwd: string; input?: string}} opts
 * @returns {Promise<string>}
 */
export function exec(command, args, {cwd, input}) {
	return new Promise((resolve, reject) => {
		const child = child_process.spawn(command, args, {
			cwd,
			stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'],
		});

		/** @type {Buffer[]} */
		const out = [];
		/** @type {Buffer[]} */
		const err = [];

		/** @type {Readable} */ (child.stdout).on('data', buf => out.push(buf));
		/** @type {Readable} */ (child.stderr).on('data', buf => err.push(buf));

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
				resolve(Buffer.concat(out).toString('utf-8').trimEnd());
			}
		});
	});
}
