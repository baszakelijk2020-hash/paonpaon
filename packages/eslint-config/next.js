import nextPlugin from "@next/eslint-plugin-next";

import { config as reactInternalConfig } from "./react-internal.js";

/**
 * ESLint flat config for Next.js applications (admin, retailer, customer).
 * @type {import("eslint").Linter.Config[]}
 */
export const config = [
  ...reactInternalConfig,
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
];
