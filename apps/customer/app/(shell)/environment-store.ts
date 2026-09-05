"use client";

import { useSyncExternalStore } from "react";

export type PaonEnvironment = "store" | "customer";

let environment: PaonEnvironment | undefined;
const listeners = new Set<() => void>();

function environmentForPathname(pathname: string): PaonEnvironment {
  return pathname.startsWith("/r/") ? "store" : "customer";
}

function initialize(pathname: string): PaonEnvironment {
  environment ??= environmentForPathname(pathname);
  return environment;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(next: PaonEnvironment): void {
  const current =
    environment ??
    (typeof window === "undefined"
      ? next
      : environmentForPathname(window.location.pathname));
  if (current === next) return;
  environment = next;
  listeners.forEach((listener) => listener());
}

export function showStoreEnvironment(): void {
  publish("store");
}

export function showCustomerEnvironment(): void {
  publish("customer");
}

export function getEnvironmentSnapshot(): PaonEnvironment {
  if (environment) return environment;
  if (typeof window === "undefined") return "customer";
  return initialize(window.location.pathname);
}

export function usePaonEnvironment(initialPathname: string): PaonEnvironment {
  const initialEnvironment = environmentForPathname(initialPathname);
  if (typeof window !== "undefined") initialize(initialPathname);

  return useSyncExternalStore(
    subscribe,
    getEnvironmentSnapshot,
    () => initialEnvironment,
  );
}
