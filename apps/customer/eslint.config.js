import { config } from "@paon/eslint-config/next.js";

export default [
  ...config,
  {
    ignores: [".next-e2e-*/**"],
  },
];
