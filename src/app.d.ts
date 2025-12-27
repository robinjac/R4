// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }

  type Spacing = "0" | "xxs" | "xs" | "s" | "m" | "l" | "xl" | "xxl" | "xxl";

  type Background =
    | string // e.g., "#ff0000" or "red" for now
    | {
        type: "linear" | "radial";
        colors: string[];
        angle?: number; // for linear gradient
      };
}

export {};
