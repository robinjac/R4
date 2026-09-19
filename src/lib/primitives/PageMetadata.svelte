<script lang="ts">
	let { title, description }: { title: string; description?: string } = $props();
</script>

<svelte:head>
	<title>{title}</title>
	{#if description}<meta name="description" content={description} />{/if}
</svelte:head>
