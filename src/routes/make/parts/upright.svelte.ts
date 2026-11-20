// Whether this screen is upright, known only in the browser: before then (and without script) it is taken as upright,
// so the upright video stands in. It follows the screen when it is turned.
import { onMount } from "svelte";

/** Call while a component starts. Its `upright` follows the screen's shape. */
export function watchUpright(): { readonly upright: boolean } {
  let upright = $state(true);
  onMount(() => {
    const wide = matchMedia("(orientation: landscape)");
    const follow = () => {
      upright = !wide.matches;
    };
    follow();
    wide.addEventListener("change", follow);
    return () => {
      wide.removeEventListener("change", follow);
    };
  });
  return {
    get upright() {
      return upright;
    },
  };
}
