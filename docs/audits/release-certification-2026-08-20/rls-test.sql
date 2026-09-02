-- RLS TESTING SCRIPT
-- This script tests cross-tenant access attempts

-- Test 1: List tenant-scoped tables and their RLS status
SELECT 
  tablename,
  (SELECT count(*) FROM pg_policies WHERE tablename = pg_tables.tablename AND schemaname = 'public') as policy_count
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  SELECT column_name FROM information_schema.columns 
  WHERE table_schema = 'public' AND column_name IN ('retailer_id', 'customer_id')
  GROUP BY table_name HAVING count(*) > 0
)
ORDER BY tablename;

-- Test 2: Get some retailers and customers for cross-tenant test
\echo '=== RETAILER DATA ==='
SELECT id, legal_name FROM public.retailers WHERE deleted_at IS NULL LIMIT 3;

\echo '=== CUSTOMER DATA BY RETAILER ==='
SELECT 
  r.id as retailer_id,
  r.legal_name,
  COUNT(c.id) as customer_count,
  ARRAY_AGG(c.id) FILTER (WHERE c.id IS NOT NULL) as sample_customer_ids
FROM public.retailers r
LEFT JOIN public.customers c ON c.retailer_id = r.id AND c.deleted_at IS NULL
WHERE r.deleted_at IS NULL
GROUP BY r.id, r.legal_name
LIMIT 3;

-- Test 3: Test SECURITY DEFINER function behavior
\echo '=== TESTING SECURITY DEFINER FUNCTIONS ==='
-- Sample a critical SECURITY DEFINER function
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.prosecdef = true
  AND p.proname = 'current_retailer_id'
LIMIT 1;

