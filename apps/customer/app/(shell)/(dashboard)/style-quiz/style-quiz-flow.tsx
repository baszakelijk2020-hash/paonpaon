"use client";

import type { StyleQuizArchetype, StyleQuizTweakQuestion } from "@paon/domain";
import { Button, buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";
import { useState, useTransition } from "react";

import { declareStyleQuizChoice } from "./actions";

export function StyleQuizFlow({
  retailerId,
  retailerName,
  archetypes,
  tweakQuestions,
  declaredConceptIds,
}: {
  retailerId: string;
  retailerName: string;
  archetypes: readonly StyleQuizArchetype[];
  tweakQuestions: readonly StyleQuizTweakQuestion[];
  declaredConceptIds: readonly string[];
}) {
  // Computed once, at mount, from the props this route loaded with — not
  // recomputed as those props change. Calling a Server Action from this
  // component makes Next.js refresh this route's server data once the
  // action resolves, which would otherwise pull an in-progress flow back
  // to the "already answered" summary after the very first tap.
  const [alreadyChosenArchetype] = useState(
    () =>
      archetypes.find((archetype) =>
        declaredConceptIds.includes(archetype.conceptId),
      ) ?? null,
  );

  const [isRetaking, setIsRetaking] = useState(false);
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();

  const totalSteps = 1 + tweakQuestions.length;

  function choose(conceptId: string) {
    startTransition(async () => {
      await declareStyleQuizChoice(retailerId, conceptId);
      setStep((current) => Math.min(current + 1, totalSteps));
    });
  }

  function skip() {
    setStep((current) => Math.min(current + 1, totalSteps));
  }

  function retake() {
    setIsRetaking(true);
    setStep(0);
  }

  if (alreadyChosenArchetype && !isRetaking) {
    return (
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
              {retailerName}
            </h2>
            <p className="text-sm text-[var(--color-stone-500)]">
              Your wardrobe: {alreadyChosenArchetype.emoji}{" "}
              <span className="font-medium text-[var(--color-stone-900)]">
                {alreadyChosenArchetype.label}
              </span>
            </p>
          </div>
          <Button variant="secondary" onClick={retake}>
            Retake the quiz
          </Button>
        </div>
        <Link
          href="/account"
          className="text-sm text-[var(--color-stone-500)] underline"
        >
          See your full style profile in Settings
        </Link>
      </Card>
    );
  }

  if (step >= totalSteps) {
    return (
      <Card className="flex flex-col items-center gap-3 text-center">
        <p className="text-lg font-medium text-[var(--color-stone-900)]">
          Your style profile is set.
        </p>
        <p className="text-sm text-[var(--color-stone-500)]">
          {retailerName} will use it to sharpen your daily picks. Retake this
          any time.
        </p>
        <div className="flex gap-3">
          <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
            Back to dashboard
          </Link>
          <Button variant="secondary" onClick={retake}>
            Retake
          </Button>
        </div>
      </Card>
    );
  }

  const isArchetypeStep = step === 0;
  const tweakQuestion = isArchetypeStep ? null : tweakQuestions[step - 1];

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          {retailerName}
        </h2>
        <span className="text-xs text-[var(--color-stone-500)]">
          Step {step + 1} of {totalSteps}
        </span>
      </div>

      {isArchetypeStep ? (
        <>
          <p className="text-sm text-[var(--color-stone-700)]">
            Which of these feels most like you?
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {archetypes.map((archetype) => (
              <button
                key={archetype.conceptId}
                type="button"
                disabled={isPending}
                onClick={() => choose(archetype.conceptId)}
                className="flex flex-col items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-3 py-4 text-center transition hover:border-[var(--color-stone-400)] disabled:opacity-50"
              >
                <span aria-hidden="true" className="text-3xl">
                  {archetype.emoji}
                </span>
                <span className="text-sm font-medium text-[var(--color-stone-900)]">
                  {archetype.label}
                </span>
                <span className="text-xs text-[var(--color-stone-500)]">
                  {archetype.description}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : tweakQuestion ? (
        <>
          <p className="text-sm text-[var(--color-stone-700)]">
            {tweakQuestion.question}
          </p>
          <div className="flex flex-wrap gap-2">
            {tweakQuestion.options.map((option) => (
              <button
                key={option.conceptId}
                type="button"
                disabled={isPending}
                onClick={() => choose(option.conceptId)}
                className="rounded-full border border-[var(--color-stone-300)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-stone-900)] transition hover:border-[var(--color-stone-500)] disabled:opacity-50"
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={skip}
            className="self-start text-xs text-[var(--color-stone-500)] underline"
          >
            Skip this one
          </button>
        </>
      ) : null}
    </Card>
  );
}
