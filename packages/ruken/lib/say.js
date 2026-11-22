// What a command shows. `out` is where answers go; `progress` is the line that moves while something takes a while: a
// spinner on a terminal, one plain line anywhere else (a pipe, a build log).

/**
 * @typedef {import("./types.js").Ctx} Ctx
 */

const FRAMES = ["|", "/", "-", "\\"];

/**
 * @param {Ctx} ctx
 * @param {string} words
 */
export function spinner(ctx, words) {
  if (!ctx.interactive) {
    ctx.err(words);
    return { update() {}, stop() {} };
  }
  let frame = 0;
  let text = words;
  const draw = () => {
    frame += 1;
    ctx.raw(`\r${FRAMES[frame % FRAMES.length]} ${text}   `);
  };
  draw();
  const timer = setInterval(draw, 120);
  return {
    /** @param {string} next */
    update(next) {
      text = next;
    },
    stop() {
      clearInterval(timer);
      ctx.raw(`\r${" ".repeat(text.length + 6)}\r`);
    },
  };
}
