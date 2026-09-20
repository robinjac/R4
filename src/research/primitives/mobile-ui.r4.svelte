<script module lang="ts">
	export const experiment = {
		id: 'mobile-ui-primitives',
		title: 'Mobile UI primitives',
		group: 'Primitives',
		kind: 'experiment',
		description: 'Navigation, collections, status, forms, overlays, and feed semantics in one contract laboratory.',
		status: 'explore'
	} as const;
</script>

<script lang="ts">
	import {
		Alert,
		Badge,
		Button,
		Checkbox,
		DateInput,
		Form,
		List,
		ListItem,
		Navigation,
		NavigationItem,
		NumberInput,
		Page,
		Progress,
		Select,
		Sheet,
		Stack,
		Tab,
		Tabs,
		Text,
		Textarea,
		TimeInput,
		View
	} from '$lib/index.js';

	const projectOptions = [
		{ value: 'oak', label: 'Oak Street renovation' },
		{ value: 'harbor', label: 'Harbor office fit-out' }
	];
	let activeTab = $state('controls');
	let selectedProject = $state('oak');
	let hours = $state<number | null>(7.5);
	let description = $state('Installed kitchen framing and prepared electrical routes.');
	let workDate = $state('2026-09-20');
	let startTime = $state('07:00');
	let billable = $state(true);
	let sheetOpen = $state(false);
</script>

<Page title="Mobile UI primitives" description="R4 mobile interaction contract laboratory" padding="none" background="#edf2ed">
	<Stack gap="none">
		<View padding="md" background="#dbe8df">
			<Stack gap="xs">
				<Text role="caption" tone="success">PRIMITIVE LAB / MOBILE</Text>
				<Text role="heading">Field interface vocabulary</Text>
				<Text tone="muted">Generic controls that can compose project tools, messaging, commerce, or service applications.</Text>
			</Stack>
		</View>

		<Tabs label="Primitive categories">
			<Tab selected={activeTab === 'controls'} onselect={() => (activeTab = 'controls')}><Text role="label">Controls</Text></Tab>
			<Tab selected={activeTab === 'collections'} onselect={() => (activeTab = 'collections')}><Text role="label">Collections</Text></Tab>
		</Tabs>

		<View padding="md">
			{#if activeTab === 'controls'}
				<Form label="Work report controls">
					<Select label="Project" options={projectOptions} value={selectedProject} onchange={(value) => (selectedProject = value)} />
					<Stack direction="horizontal" gap="sm">
						<DateInput label="Date" value={workDate} onchange={(value) => (workDate = value)} />
						<TimeInput label="Started" value={startTime} onchange={(value) => (startTime = value)} />
					</Stack>
					<NumberInput label="Hours" value={hours} min={0} step={0.25} unit="h" onchange={(value) => (hours = value)} />
					<Textarea label="Work completed" value={description} onchange={(value) => (description = value)} />
					<Checkbox label="Billable work" checked={billable} description="Include this report in the invoice basis." onchange={(checked) => (billable = checked)} />
					<Alert title="Ready to submit" tone="success"><Text role="caption">All required field values are represented semantically.</Text></Alert>
					<Progress label="Photo upload" value={64} />
					<Button onclick={() => (sheetOpen = true)}><Text role="label">Open mobile sheet</Text></Button>
				</Form>
			{:else}
				<List label="Example project collection">
					<ListItem selected>
						<Stack direction="horizontal" gap="sm" align="center" distribute="between">
							<Stack gap="2xs"><Text role="label">Oak Street renovation</Text><Text role="caption" tone="muted">Today / 07:00-15:30</Text></Stack>
							<Badge tone="success"><Text role="caption">On site</Text></Badge>
						</Stack>
					</ListItem>
					<ListItem>
						<Stack direction="horizontal" gap="sm" align="center" distribute="between">
							<Stack gap="2xs"><Text role="label">Harbor office fit-out</Text><Text role="caption" tone="muted">Tomorrow / 08:00</Text></Stack>
							<Badge tone="accent"><Text role="caption">Planned</Text></Badge>
						</Stack>
					</ListItem>
				</List>
			{/if}
		</View>

		<Navigation label="Primitive preview navigation" placement="bottom">
			<NavigationItem selected><Text role="label">Today</Text></NavigationItem>
			<NavigationItem><Text role="label">Projects</Text></NavigationItem>
			<NavigationItem><Text role="label">Assistant</Text></NavigationItem>
		</Navigation>
	</Stack>

	<Sheet title="Register work" description="A modal mobile presentation primitive." open={sheetOpen} onclose={() => (sheetOpen = false)}>
		<Stack gap="md">
			<Textarea label="Summary" value={description} onchange={(value) => (description = value)} />
			<Button onclick={() => (sheetOpen = false)}><Text role="label">Save report</Text></Button>
		</Stack>
	</Sheet>
</Page>
