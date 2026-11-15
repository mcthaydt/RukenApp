<!--
  The maker's area wears the felt as the whole window (spec 4): a bar with the way home and one more link, and under it
  whatever screen this is. It also makes a move between two questions a step: before the new page comes, it says
  which way the maker is going, so the stylesheet can lift the old question away and raise the new one into place.
-->
<script lang="ts">
  import { onNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import type { LayoutProps } from "./$types";

  let { data, children }: LayoutProps = $props();

  /** The one more link in the bar: where the maker goes to stop for now, or to their account. */
  const more = $derived.by(() => {
    if (page.url.pathname === "/make") return { href: "/me", words: "Your account" };
    // The last two steps (the agreement, Check and send) can be left for later too, as any question can.
    if (
      page.url.pathname === "/make/new" ||
      page.params.question !== undefined ||
      /\/(agreement|check)$/.test(page.url.pathname)
    ) {
      return { href: "/make", words: "Finish later" };
    }
    return null;
  });

  const asked: readonly string[] = $derived(data.questions);

  /** The question's place among the questions, or -1 for a screen that is not one (a new game's name is before all). */
  function placeOf(question: string | undefined): number {
    return question === undefined ? -1 : asked.indexOf(question);
  }

  // A step is only for a move inside the maker's area, and only for a person who welcomes motion. Without the
  // browser's view transitions the new question's lines still rise (a plain animation), and the old one just goes.
  onNavigate((navigation) => {
    if (navigation.to?.url.pathname.startsWith("/make") !== true) return;
    const going = placeOf(navigation.to.params?.question) < placeOf(navigation.from?.params?.question);
    document.documentElement.dataset.step = going ? "back" : "on";
    if (!("startViewTransition" in document) || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    return new Promise<void>((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });
</script>

<div class="screen">
  <div class="topbar">
    <a class="wordmark" href="/">Ruken</a>
    {#if more !== null}
      <a href={more.href}>{more.words}</a>
    {/if}
  </div>
  {@render children()}
</div>
