<script>
  import "../styles.css";
  import Stack from "../components/Stack.svelte";
  import View from "../components/View.svelte";
</script>

<Stack vertical gap="s">
  <Stack gap="xxs" vertical align="end">
    <View padding="xxs" border background="green">element 1</View>
    <View padding="xxs" border background="green">element 2</View>
    <View padding="xxs" border background="green">element 3</View>
  </Stack>
  <Stack gap="xxs">
    <View padding="xxs" border background="green">element 1</View>
    <View padding="xxs" border background="green">element 2</View>
    <View padding="xxs" border background="green">element 3</View>
  </Stack>
</Stack>
