-- PHASE 2.7: audit import enrichment attempts alongside existing AI generations.

alter type public.ai_generation_kind add value if not exists 'import_enrichment';
