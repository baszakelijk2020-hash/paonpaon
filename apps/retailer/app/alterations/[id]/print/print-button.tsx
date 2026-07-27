"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-[#1a1a1a] px-4 py-2 text-sm text-white"
    >
      Print or save as PDF
    </button>
  );
}
