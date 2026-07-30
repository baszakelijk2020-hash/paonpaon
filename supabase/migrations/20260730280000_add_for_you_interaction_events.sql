-- PHASE 7.6: For You impression/click/dismiss/correction event names (CLI-007).

alter table public.behavioral_events
  drop constraint if exists behavioral_events_name_check;

alter table public.behavioral_events
  add constraint behavioral_events_name_check check (
    name in (
      'session_started',
      'session_heartbeat',
      'session_ended',
      'page_viewed',
      'product_viewed',
      'category_browsed',
      'search_performed',
      'filter_applied',
      'product_favorited',
      'product_skipped',
      'cart_updated',
      'knowledge_opened',
      'advisor_question',
      'appointment_intent',
      'conversion_recorded',
      'tie_mate_impressed',
      'for_you_impressed',
      'for_you_clicked',
      'for_you_dismissed',
      'for_you_correction'
    )
  );
