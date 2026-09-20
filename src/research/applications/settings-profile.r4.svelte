<script module lang="ts">
	export const experiment = {
		id: 'settings-profile',
		title: 'Settings & Profile',
		group: 'Applications',
		description: 'A reference application for portable text entry, boolean settings, validation, and save feedback.',
		status: 'explore'
	} as const;
</script>

<script lang="ts">
	import { Button, Input, Page, Stack, Switch, Text, View } from '$lib/index.js';

	let profile = $state({
		displayName: 'Ada Lovelace',
		email: 'ada@example.com',
		publicProfile: true,
		productUpdates: false
	});
	let persistedProfile = $state({
		displayName: 'Ada Lovelace',
		email: 'ada@example.com',
		publicProfile: true,
		productUpdates: false
	});
	let canSave = $derived(profile.displayName.trim().length > 0 && profile.email.includes('@'));
	let isSaved = $derived(
		persistedProfile.displayName === profile.displayName &&
			persistedProfile.email === profile.email &&
			persistedProfile.publicProfile === profile.publicProfile &&
			persistedProfile.productUpdates === profile.productUpdates
	);
</script>

<Page title="Settings and profile" description="R4 reference application for account preferences" padding="lg">
	<Stack gap="lg">
		<Stack gap="xs">
			<Text role="caption" tone="accent">REFERENCE APPLICATION 01</Text>
			<Text role="title">Settings & Profile</Text>
			<Text tone="muted">Portable form semantics should describe values and intent, never browser events.</Text>
		</Stack>

		<View padding="lg" rounded="lg" bordered background="#fffef9">
			<Stack gap="md">
				<Stack gap="2xs">
					<Text role="heading">Profile</Text>
					<Text tone="muted">This information appears anywhere your account has a public identity.</Text>
				</Stack>

				<Input
					label="Display name"
					value={profile.displayName}
					placeholder="Your name"
					description="Shown on your public profile."
					onchange={(value) => (profile = { ...profile, displayName: value })}
				/>
				<Input
					label="Email address"
					type="email"
					value={profile.email}
					description="Used for account notices and recovery."
					onchange={(value) => (profile = { ...profile, email: value })}
				/>
			</Stack>
		</View>

		<View padding="lg" rounded="lg" bordered background="#fffef9">
			<Stack gap="md">
				<Stack gap="2xs">
					<Text role="heading">Preferences</Text>
					<Text tone="muted">Boolean settings use a value callback rather than a platform event object.</Text>
				</Stack>

				<Switch
					label="Public profile"
					checked={profile.publicProfile}
					description="Allow other people to find your profile."
					onchange={(checked) => (profile = { ...profile, publicProfile: checked })}
				/>
				<Switch
					label="Product updates"
					checked={profile.productUpdates}
					description="Receive occasional release and research notes."
					onchange={(checked) => (profile = { ...profile, productUpdates: checked })}
				/>
			</Stack>
		</View>

		<View padding="md" rounded="md" background="#e8eef8">
			<Stack gap="2xs">
				<Text role="caption" tone="accent">LIVE PROFILE PREVIEW</Text>
				<Text role="heading">{profile.displayName || 'Unnamed profile'}</Text>
				<Text tone="muted">{profile.email}</Text>
				<Text role="caption">{profile.publicProfile ? 'Visible to everyone' : 'Private profile'} / {profile.productUpdates ? 'Updates enabled' : 'Updates disabled'}</Text>
			</Stack>
		</View>

		<Stack direction="horizontal" gap="md" align="center" distribute="between" wrap>
			{#if isSaved}
				<Text role="label" tone="success">All changes saved.</Text>
			{:else}
				<Text role="caption" tone="muted">Unsaved changes. Data remains local to this reference application.</Text>
			{/if}
			<Button disabled={!canSave || isSaved} onclick={() => (persistedProfile = profile)}><Text role="label">Save profile</Text></Button>
		</Stack>
	</Stack>
</Page>
