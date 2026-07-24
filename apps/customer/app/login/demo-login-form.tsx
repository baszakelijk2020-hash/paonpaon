import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";

import { signInToDemo } from "./actions";

export function DemoLoginForm({ redirectTo }: { redirectTo: string }) {
  return (
    <form action={signInToDemo} className="flex flex-col gap-5">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <FormField label="Demo email" htmlFor="demo-email">
        <Input
          id="demo-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="contact+isabelle@nebelspiegel.com"
          required
        />
      </FormField>
      <FormField label="Demo password" htmlFor="demo-password">
        <Input
          id="demo-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </FormField>
      <Button type="submit" size="lg" className="mt-2 w-full">
        Enter the private client demo
      </Button>
    </form>
  );
}
