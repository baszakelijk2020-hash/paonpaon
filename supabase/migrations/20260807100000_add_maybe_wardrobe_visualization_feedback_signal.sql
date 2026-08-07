-- Advisor visual roadmap review (VWS-001 / PHASE 4.9) needs a genuine
-- "maybe" signal distinct from love_it/save (keep) and not_for_me
-- (discard) — the founder brief's per-look roadmap review vocabulary
-- (Love it / Maybe / Not for me / Request change). "Request change"
-- reuses not_for_me plus the existing free-text `note` column rather than
-- adding a second signal for the same discard-with-reason shape.

alter table public.wardrobe_visualization_feedback
  drop constraint if exists wardrobe_visualization_feedback_signal_check;

alter table public.wardrobe_visualization_feedback
  add constraint wardrobe_visualization_feedback_signal_check check (
    signal in (
      'love_it', 'save', 'maybe', 'not_for_me', 'regenerate',
      'looks_like_me_no', 'fit_correction', 'colour_correction'
    )
  );
