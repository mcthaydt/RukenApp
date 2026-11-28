<!--
  Ask a parent: the teen's first name and a parent's phone number, and one blue button that texts the parent. A plain
  form, so it works before any script loads.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import Icon from "../../../../lib/icon.svelte";
  import PhoneFields from "../../../../lib/phone-fields.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
  let sending = $state(false);
</script>

<main class="card ask">
  <h1>Ask a parent</h1>
  <!-- A problem takes the line under the heading, so the form and its button still fit a small phone with it showing. -->
  {#if form?.problem}
    <p class="problem" role="alert">{form.problem}</p>
  {:else}
    <p>We'll text your parent a link to say yes.</p>
  {/if}
  <form
    method="POST"
    use:enhance={() => {
      sending = true;
      return async ({ update }) => {
        await update({ reset: false });
        sending = false;
      };
    }}
  >
    <p>
      <label>
        Your first name
        <input type="text" name="name" autocomplete="given-name" maxlength="30" value={form?.name} />
      </label>
    </p>
    <PhoneFields countries={data.countries} country={form?.country} phone={form?.phone} />
    <p class="row">
      <a class="button safe back" href="/settings/feed" aria-label="Back to your feed"><Icon name="back" /></a
      >
      <button disabled={sending} aria-busy={sending}>Text my parent</button>
    </p>
  </form>
</main>
