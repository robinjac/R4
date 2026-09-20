<script module lang="ts">
	export const experiment = {
		id: 'field-operations',
		title: 'Field Operations',
		group: 'Applications',
		kind: 'application',
		description: 'A mobile field-work application assembled from R4 primitives, including reporting and a project-aware AI assistant.',
		status: 'explore'
	} as const;
</script>

<script lang="ts">
	import ProjectCollection from '../compositions/project-collection.r4.svelte';
	import {
		Alert,
		Badge,
		Button,
		Checkbox,
		DateInput,
		Feed,
		FeedItem,
		Form,
		List,
		ListItem,
		Navigation,
		NavigationItem,
		NumberInput,
		Page,
		Progress,
		RichText,
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
	let section = $state('today');
	let projectTab = $state('overview');
	let reportOpen = $state(false);
	let project = $state('oak');
	let date = $state('2026-09-20');
	let startTime = $state('07:00');
	let hours = $state<number | null>(7.5);
	let summary = $state('Installed kitchen framing and prepared electrical routes.');
	let billable = $state(true);
	let question = $state('Summarize this week and flag anything that could delay invoicing.');
	let sent = $state(false);
</script>

<Page title="Field Operations" description="Mobile R4 reference application" padding="none" background="#edf2ed">
	<Stack gap="none">
		<View padding="md" background="#dbe8df">
			<Stack direction="horizontal" gap="sm" align="center" distribute="between">
				<Stack gap="2xs">
					<Text role="caption" tone="success">SUNDAY / 20 SEPTEMBER</Text>
					<Text role="heading">Good morning, Robin</Text>
				</Stack>
				<Badge tone="success"><Text role="caption">Synced</Text></Badge>
			</Stack>
		</View>

		<View padding="md">
			{#if section === 'today'}
				<Stack gap="md">
					<Alert title="Two reports need attention" tone="warning"><Text role="caption">Yesterday’s material entry and one project photo are still missing.</Text></Alert>
					<Stack direction="horizontal" gap="sm">
						<View width="fill" padding="sm" rounded="md" background="#fffef9"><Stack gap="2xs"><Text role="caption" tone="muted">TODAY</Text><Text role="heading">7.5 h</Text></Stack></View>
						<View width="fill" padding="sm" rounded="md" background="#fffef9"><Stack gap="2xs"><Text role="caption" tone="muted">TO REPORT</Text><Text role="heading">1</Text></Stack></View>
					</Stack>
					<Stack direction="horizontal" gap="sm" align="center" distribute="between">
						<Text role="heading">Today’s work</Text>
						<Button variant="quiet" onclick={() => (reportOpen = true)}><Text role="label">Register work</Text></Button>
					</Stack>
					<List label="Today's assignments">
						<ListItem selected>
							<Stack gap="xs">
								<Stack direction="horizontal" gap="sm" align="center" distribute="between"><Text role="label">Oak Street renovation</Text><Badge tone="success"><Text role="caption">On site</Text></Badge></Stack>
								<Text tone="muted">Kitchen framing / 07:00-15:30</Text>
								<Progress label="Work order progress" value={68} />
							</Stack>
						</ListItem>
						<ListItem>
							<Stack direction="horizontal" gap="sm" align="center" distribute="between"><Stack gap="2xs"><Text role="label">Harbor office fit-out</Text><Text role="caption" tone="muted">Tomorrow / electrical inspection</Text></Stack><Badge tone="accent"><Text role="caption">Planned</Text></Badge></Stack>
						</ListItem>
					</List>
				</Stack>
			{:else if section === 'projects'}
				<Stack gap="md">
					<Stack gap="2xs"><Text role="caption" tone="success">PROJECT / 24018</Text><Text role="heading">Oak Street renovation</Text><Text tone="muted">12 Oak Street / Kitchen and ground-floor renovation</Text></Stack>
					<Tabs label="Project sections">
						<Tab selected={projectTab === 'overview'} onselect={() => (projectTab = 'overview')}><Text role="label">Overview</Text></Tab>
						<Tab selected={projectTab === 'activity'} onselect={() => (projectTab = 'activity')}><Text role="label">Activity</Text></Tab>
						<Tab selected={projectTab === 'files'} onselect={() => (projectTab = 'files')}><Text role="label">Files</Text></Tab>
					</Tabs>
					{#if projectTab === 'overview'}
						<ProjectCollection title="Active projects" description="Reusable composition imported into the application boundary." />
					{:else if projectTab === 'activity'}
						<Feed label="Project activity" live="off">
							<FeedItem author="Robin / 14:52"><Text>Added 7.5 hours and a framing note.</Text></FeedItem>
							<FeedItem author="Mikael / 11:18"><Text>Uploaded three site photos.</Text></FeedItem>
						</Feed>
					{:else}
						<Alert title="Project files"><Text role="caption">12 photos, 3 drawings, and 1 signed change order.</Text></Alert>
					{/if}
				</Stack>
			{:else}
				<Stack gap="md">
					<Stack gap="2xs"><Text role="caption" tone="success">PROJECT ASSISTANT</Text><Text role="heading">Ask about Oak Street</Text><Text tone="muted">The UI presents project context, sources, and proposed actions. AI execution remains outside R4.</Text></Stack>
					<Feed label="Assistant conversation">
						<FeedItem author="You" align="end"><Text>What could delay invoicing this week?</Text></FeedItem>
						<FeedItem author="R4 Assistant">
							<RichText label="Assistant response"><Stack gap="xs"><Text>Two items need attention before invoicing:</Text><Text>1. The electrical inspection is not signed.</Text><Text>2. Yesterday’s material delivery has no receipt attached.</Text><Alert title="Suggested action"><Text role="caption">Prepare a reminder for the project manager. No project data will change without confirmation.</Text></Alert></Stack></RichText>
						</FeedItem>
						{#if sent}<FeedItem author="You" align="end" status="pending"><Text>{question}</Text></FeedItem>{/if}
					</Feed>
					<Form label="Ask the project assistant" onsubmit={() => (sent = true)}>
						<Textarea label="Message" value={question} rows={3} onchange={(value) => (question = value)} />
						<Button type="submit"><Text role="label">Send message</Text></Button>
					</Form>
				</Stack>
			{/if}
		</View>

		<Navigation label="Primary application navigation" placement="bottom">
			<NavigationItem selected={section === 'today'} onselect={() => (section = 'today')}><Text role="label">Today</Text></NavigationItem>
			<NavigationItem selected={section === 'projects'} onselect={() => (section = 'projects')}><Text role="label">Projects</Text></NavigationItem>
			<NavigationItem selected={section === 'assistant'} onselect={() => (section = 'assistant')}><Text role="label">Assistant</Text></NavigationItem>
		</Navigation>
	</Stack>

	<Sheet title="Register work" description="Create a local report for the selected project." open={reportOpen} onclose={() => (reportOpen = false)}>
		<Form label="Work report" onsubmit={() => (reportOpen = false)}>
			<Select label="Project" options={projectOptions} value={project} onchange={(value) => (project = value)} />
			<Stack direction="horizontal" gap="sm"><DateInput label="Date" value={date} onchange={(value) => (date = value)} /><TimeInput label="Started" value={startTime} onchange={(value) => (startTime = value)} /></Stack>
			<NumberInput label="Hours" value={hours} min={0} step={0.25} unit="h" onchange={(value) => (hours = value)} />
			<Textarea label="Work completed" value={summary} onchange={(value) => (summary = value)} />
			<Checkbox label="Billable work" checked={billable} onchange={(checked) => (billable = checked)} />
			<Button type="submit"><Text role="label">Save report</Text></Button>
		</Form>
	</Sheet>
</Page>
