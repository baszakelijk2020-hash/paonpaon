"use client";

import type { ButtonHTMLAttributes } from "react";

import { Button, type ButtonProps } from "./Button";

/**
 * A form submit button that requires a native confirmation before the
 * action fires — for destructive or hard-to-reverse Server Action
 * submits (cancel a subscription, revoke a demo) where a whole modal
 * component would be more machinery than the decision warrants.
 */
export function ConfirmSubmitButton({
  confirmMessage,
  onClick,
  ...props
}: ButtonProps & {
  confirmMessage: string;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
}) {
  return (
    <Button
      type="submit"
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...props}
    />
  );
}
