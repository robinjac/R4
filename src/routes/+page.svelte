<script>
  import "../styles.css";
  import Stack from "../components/Stack.svelte";
  import View from "../components/View.svelte";
</script>

<Stack vertical gap="s">
  <h4>stack vertical start</h4>
  <Stack gap="xxs" vertical align="start">
    <View padding="xxs" border background="lightgrey">element 1</View>
    <View padding="xxs" border background="lightgrey">element 2</View>
    <View padding="xxs" border background="lightgrey">element 3</View>
  </Stack>
  <h4>stack vertical center</h4>
  <Stack gap="xxs" vertical align="center">
    <View padding="xxs" border background="lightgrey">element 1</View>
    <View padding="xxs" border background="lightgrey">element 2</View>
    <View padding="xxs" border background="lightgrey">element 3</View>
  </Stack>
  <h4>stack vertical end</h4>
  <Stack gap="xxs" vertical align="end">
    <View padding="xxs" border background="lightgrey">element 1</View>
    <View padding="xxs" border background="lightgrey">element 2</View>
    <View padding="xxs" border background="lightgrey">element 3</View>
  </Stack>
  <h4>stack horizontal start</h4>
  <Stack gap="xxs" align="start">
    <View padding="xxs" height={100} border background="lightgrey">element 1</View>
    <View padding="xxs" height=fit border background="lightgrey">element 2</View>
    <View padding="xxs" height=fit border background="lightgrey">element 3</View>
  </Stack>
  <h4>stack horizontal center</h4>
  <Stack gap="xxs" align="center">
    <View padding="xxs" height={100} border background="lightgrey">element 1</View>
    <View padding="xxs" height=fit border background="lightgrey">element 2</View>
    <View padding="xxs" height=fit border background="lightgrey">element 3</View>
  </Stack>
  <h4>stack horizontal end</h4>
  <Stack gap="xxs" align="end">
    <View padding="xxs" height={100} border background="lightgrey">element 1</View>
    <View padding="xxs" height=fit border background="lightgrey">element 2</View>
    <View padding="xxs" height=fit border background="lightgrey">element 3</View>
  </Stack>

  <h4>nested stacks</h4>
  <Stack gap="xxs">
    <View padding="xxs" border height="fit" rounded background="lightgrey">element 1</View>
    <Stack gap="xxs" align="end">
        <View padding="xxs" border width="fill" rounded background="lightgrey"/>
        <View padding="xxs" border height={200} rounded background="lightgrey">element 3</View>
    </Stack>
  </Stack>

  <h4>nested stacks 2 (center item)</h4>
  <Stack gap=xxs align=center>
    <View padding="xxs" border height={300} rounded background="lightgrey">
      <Stack gap=xxs vertical align=center>
         <View padding=xxs width={400} rounded background=white>element 1</View>
         <View padding=xxs width=fill rounded background=white>element 2</View>
      </Stack>
    </View>
  </Stack>

</Stack>
