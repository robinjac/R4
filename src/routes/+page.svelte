<script>
  import "../styles.css";
  import Stack from "../components/Stack.svelte";
  import View from "../components/View.svelte";
</script>

<Stack vertical gap="s">
  <h4>stack vertical start</h4>
  <Stack gap="xxs" vertical align="start">
    <View padding="xxs" border background="green">element 1</View>
    <View padding="xxs" border background="green">element 2</View>
    <View padding="xxs" border background="green">element 3</View>
  </Stack>
  <h4>stack vertical center</h4>
  <Stack gap="xxs" vertical align="center">
    <View padding="xxs" border background="green">element 1</View>
    <View padding="xxs" border background="green">element 2</View>
    <View padding="xxs" border background="green">element 3</View>
  </Stack>
  <h4>stack vertical end</h4>
  <Stack gap="xxs" vertical align="end">
    <View padding="xxs" border background="green">element 1</View>
    <View padding="xxs" border background="green">element 2</View>
    <View padding="xxs" border background="green">element 3</View>
  </Stack>
  <h4>stack horizontal start</h4>
  <Stack gap="xxs" align="start">
    <View padding="xxs" border background="green">element 1</View>
    <View padding="xxs" border background="green">element 2</View>
    <View padding="xxs" border background="green">element 3</View>
  </Stack>
  <h4>stack horizontal center</h4>
  <Stack gap="xxs" align="center">
    <View padding="xxs" border background="green">element 1</View>
    <View padding="xxs" border background="green">element 2</View>
    <View padding="xxs" border background="green">element 3</View>
  </Stack>
  <h4>stack horizontal end</h4>
  <Stack gap="xxs" align="end">
    <View padding="xxs" border background="green">element 1</View>
    <View padding="xxs" border background="green">element 2</View>
    <View padding="xxs" border background="green">element 3</View>
  </Stack>

  <h4>nested stacks</h4>
   <Stack gap="xxs">
    <View padding="xxs" border rounded background="green">element 1</View>
    <Stack align="center">
        <View padding="xxs" border rounded background="green">element 2</View>
    </Stack>
  </Stack>
</Stack>
