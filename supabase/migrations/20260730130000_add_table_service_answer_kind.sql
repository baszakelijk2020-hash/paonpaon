-- PHASE 3.4: grounded TableService answer audit kind.

alter type public.ai_generation_kind add value if not exists 'table_service_answer';
