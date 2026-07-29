/** Turn snake_case / kebab enum values into short human labels. */
export function humaniseStatus(value: string): string {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const DEMO_ENVIRONMENT_LABELS: Record<string, string> = {
  draft: "Not published",
  review_ready: "Ready to review",
  published: "Live demo",
  revoked: "Revoked",
  expired: "Expired",
};

export function demoEnvironmentLabel(status: string): string {
  return DEMO_ENVIRONMENT_LABELS[status] ?? humaniseStatus(status);
}
