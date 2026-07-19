import { config } from "@paon/eslint-config/base.js";

export default [
  ...config,
  {
    files: ["scripts/**/*.ts"],
    rules: {
      // CLI scripts report their result on stdout by design.
      "no-console": "off",
    },
  },
];
