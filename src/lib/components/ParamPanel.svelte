<script lang="ts">
	import { Select, Slider, Stack, Switch, Text, Tooltip } from '@ruckc/truss-ui';
	import { defaultFor, type Control, type Group } from '$lib/engines/params';
	import type { AnyParams } from '$lib/engines/types';

	interface Props {
		params: AnyParams;
		groups: Group[];
		/** Called on every change; the caller decides how to debounce. */
		onchange: () => void;
	}

	let { params = $bindable(), groups, onchange }: Props = $props();

	function set(c: Control, value: unknown) {
		params[c.key] = value;
		onchange();
	}

	// Selects carry strings; numeric parameters need converting back.
	function setFromSelect(c: Control, raw: string | number | null) {
		set(c, typeof params[c.key] === 'number' ? Number(raw) : raw);
	}
</script>

<Stack gap={5}>
	{#each groups as group (group.title)}
		{@const controls = group.controls.filter((c) => !c.visible || c.visible(params))}
		{#if controls.length}
			<Stack gap={3} as="section">
				<Text as="h3" size="xs" tone="muted"><strong>{group.title.toUpperCase()}</strong></Text>
				{#each controls as c (c.key)}
					<Tooltip text={c.help} placement="left">
						{#if c.kind === 'select'}
							<Select
								label={c.label}
								options={c.options}
								size="sm"
								bind:value={() => String(params[c.key]), (v) => setFromSelect(c, v)}
							/>
						{:else if c.kind === 'toggle'}
							<Switch bind:checked={() => Boolean(params[c.key]), (v) => set(c, v)}>
								{c.label}
							</Switch>
						{:else if c.kind === 'range'}
							<Slider
								label={c.label}
								min={c.min}
								max={c.max}
								step={c.step}
								numberInput
								bind:value={() => (params[c.key] as number) ?? 0, (v) => set(c, v as number)}
							/>
						{:else}
							<Slider
								label={c.label}
								min={c.min}
								max={c.max}
								step={c.step}
								nullable
								offLabel={c.whenOff}
								defaultValue={defaultFor(c) as number}
								bind:value={
									() => (params[c.key] as number | null) ?? null, (v) => set(c, v as number | null)
								}
							/>
						{/if}
					</Tooltip>
				{/each}
			</Stack>
		{/if}
	{/each}
</Stack>
