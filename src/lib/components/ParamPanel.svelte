<script lang="ts">
	import { defaultFor, type Control, type Group } from '$lib/engines/params';
	import type { AnyParams } from '$lib/engines/types';

	interface Props {
		params: AnyParams;
		groups: Group[];
		/** Called on every change; the caller decides how to debounce. */
		onchange: () => void;
	}

	let { params = $bindable(), groups, onchange }: Props = $props();

	const num = (c: Control) => (params[c.key] as number) ?? 0;

	function set(c: Control, value: unknown) {
		params[c.key] = value;
		onchange();
	}

	function toggleOptional(c: Control) {
		set(c, params[c.key] == null ? defaultFor(c) : null);
	}

	// Selects carry strings; numeric parameters need converting back.
	function setFromSelect(c: Control, raw: string) {
		set(c, typeof params[c.key] === 'number' ? Number(raw) : raw);
	}
</script>

{#each groups as group (group.title)}
	{@const controls = group.controls.filter((c) => !c.visible || c.visible(params))}
	{#if controls.length}
		<section>
			<h2>{group.title}</h2>
			{#each controls as c (c.key)}
				<div class="row" class:inline={c.kind === 'toggle'}>
					<label for="p-{c.key}" title={c.help}>
						{c.label}
						{#if c.kind === 'range'}
							<output>{num(c)}</output>
						{:else if c.kind === 'optionalRange'}
							<output>{params[c.key] ?? c.whenOff}</output>
						{/if}
					</label>

					{#if c.kind === 'select'}
						<select
							id="p-{c.key}"
							value={String(params[c.key])}
							onchange={(e) => setFromSelect(c, e.currentTarget.value)}
						>
							{#each c.options as o (o.value)}
								<option value={o.value}>{o.label}</option>
							{/each}
						</select>
					{:else if c.kind === 'toggle'}
						<input
							id="p-{c.key}"
							type="checkbox"
							checked={Boolean(params[c.key])}
							onchange={(e) => set(c, e.currentTarget.checked)}
						/>
					{:else if c.kind === 'range'}
						<input
							id="p-{c.key}"
							type="range"
							min={c.min}
							max={c.max}
							step={c.step}
							value={num(c)}
							oninput={(e) => set(c, e.currentTarget.valueAsNumber)}
						/>
					{:else}
						<div class="optional">
							<input
								id="p-{c.key}"
								type="range"
								min={c.min}
								max={c.max}
								step={c.step}
								disabled={params[c.key] == null}
								value={params[c.key] ?? defaultFor(c)}
								oninput={(e) => set(c, e.currentTarget.valueAsNumber)}
							/>
							<button
								class="switch"
								aria-pressed={params[c.key] != null}
								onclick={() => toggleOptional(c)}
							>
								{params[c.key] == null ? 'enable' : 'disable'}
							</button>
						</div>
					{/if}
				</div>
			{/each}
		</section>
	{/if}
{/each}

<style>
	section {
		margin-bottom: 1.25rem;
	}

	h2 {
		margin: 0 0 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: light-dark(#888, #999);
	}

	.row {
		margin-bottom: 0.6rem;
	}

	.row.inline {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	label {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		font-size: 0.85rem;
		cursor: help;
	}

	output {
		font-variant-numeric: tabular-nums;
		color: light-dark(#666, #aaa);
	}

	input[type='range'] {
		width: 100%;
		margin-top: 0.15rem;
	}

	input[type='range']:disabled {
		opacity: 0.4;
	}

	select {
		width: 100%;
		margin-top: 0.15rem;
		padding: 0.25rem;
		border: 1px solid light-dark(#d5d5d5, #444);
		border-radius: 0.3rem;
		background: light-dark(#fff, #222);
		color: inherit;
		font: inherit;
		font-size: 0.85rem;
	}

	.optional {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.switch {
		flex: none;
		padding: 0.1rem 0.4rem;
		border: 1px solid light-dark(#d5d5d5, #444);
		border-radius: 0.3rem;
		background: light-dark(#fff, #222);
		color: inherit;
		font: inherit;
		font-size: 0.7rem;
		cursor: pointer;
	}
</style>
