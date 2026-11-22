/**
 * Everything a command touches in the world, passed in so a test can stand in for it.
 *
 * @typedef {object} Ctx
 * @property {Record<string, string | undefined>} env
 * @property {typeof fetch} fetch
 * @property {(line: string) => void} out Where answers go.
 * @property {(line: string) => void} err Where words about progress and problems go.
 * @property {(text: string) => void} raw Text with no new line, for the moving line.
 * @property {boolean} interactive Whether a person is watching a terminal.
 * @property {(ms: number) => Promise<void>} sleep
 * @property {() => string} [computerName]
 * @property {(file: string) => Promise<Uint8Array>} readFile
 * @property {(file: string) => Promise<number>} sizeOf
 * @property {(address: string) => void} [openBrowser]
 *
 * @typedef {object} Command
 * @property {string} name
 * @property {string} usage
 * @property {string} summary
 * @property {boolean} common Whether the short help shows it.
 * @property {(args: string[], ctx: Ctx) => Promise<void> | void} run
 */
export {};
