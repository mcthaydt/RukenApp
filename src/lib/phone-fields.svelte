<!--
  The country list and the phone number box, the same on sign up, sign in and forgot password. Plain HTML, so it
  works before any script loads. A country with no entry in `countries` is not offered.
-->
<script lang="ts">
  interface Props {
    countries: readonly { code: string; name: string; dialing: string }[];
    country?: string | undefined;
    phone?: string | undefined;
  }

  // `value` is left undefined on a first visit, not "": Svelte writes any value it is given onto the input when
  // it hydrates, which would wipe text typed before the script loaded.
  let { countries, country, phone }: Props = $props();
</script>

<p>
  <label>
    Country
    <select name="country" autocomplete="country">
      {#each countries as option (option.code)}
        <option value={option.code} selected={option.code === (country ?? "US")}>
          {option.name} ({option.dialing})
        </option>
      {/each}
    </select>
  </label>
</p>
<p>
  <label>
    Phone number
    <input type="tel" name="phone" autocomplete="tel-national" inputmode="tel" value={phone} />
  </label>
</p>
