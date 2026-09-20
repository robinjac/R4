<script module lang="ts">
	export const experiment = {
		id: 'project-collection',
		title: 'Project collection',
		group: 'Compositions',
		kind: 'composition',
		description: 'A touch-friendly project list composed from generic collection, status, layout, and text primitives.',
		status: 'explore'
	} as const;
</script>

<script lang="ts">
	import { Badge, List, ListItem, Stack, Text, View } from '$lib/index.js';

	interface Props {
		title?: string;
		description?: string;
	}

	let { title = 'Today’s projects', description = 'A reusable collection composed entirely from generic R4 UI primitives.' }: Props = $props();
	let selectedProject = $state('oak');
</script>

<View padding="md" background="#edf2ed">
	<Stack gap="md">
		<Stack gap="2xs">
			<Text role="caption" tone="success">COMPOSITION / COLLECTION</Text>
			<Text role="heading">{title}</Text>
			<Text tone="muted">{description}</Text>
		</Stack>

		<List label="Today's projects">
			<ListItem selected={selectedProject === 'oak'} onselect={() => (selectedProject = 'oak')}>
				<Stack direction="horizontal" gap="sm" align="center" distribute="between">
					<Stack gap="2xs"><Text role="label">Oak Street renovation</Text><Text role="caption" tone="muted">Kitchen / crew of 3</Text></Stack>
					<Badge tone="success"><Text role="caption">On site</Text></Badge>
				</Stack>
			</ListItem>
			<ListItem selected={selectedProject === 'harbor'} onselect={() => (selectedProject = 'harbor')}>
				<Stack direction="horizontal" gap="sm" align="center" distribute="between">
					<Stack gap="2xs"><Text role="label">Harbor office fit-out</Text><Text role="caption" tone="muted">Floor 4 / crew of 5</Text></Stack>
					<Badge tone="accent"><Text role="caption">Planned</Text></Badge>
				</Stack>
			</ListItem>
			<ListItem selected={selectedProject === 'birch'} onselect={() => (selectedProject = 'birch')}>
				<Stack direction="horizontal" gap="sm" align="center" distribute="between">
					<Stack gap="2xs"><Text role="label">Birch Lane extension</Text><Text role="caption" tone="muted">Inspection required</Text></Stack>
					<Badge tone="warning"><Text role="caption">Blocked</Text></Badge>
				</Stack>
			</ListItem>
		</List>

		<View padding="sm" rounded="md" background="#dbe8df">
			<Text role="caption">Selection state: {selectedProject}</Text>
		</View>
	</Stack>
</View>
