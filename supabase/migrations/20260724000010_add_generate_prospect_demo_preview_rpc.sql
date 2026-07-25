-- Migration: Add RPC function for generating synthetic demo previews

create or replace function public.generate_prospect_demo_preview(
  p_environment_id uuid,
  p_role text,
  p_device text,
  p_config jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_preview_id uuid;
  v_synthetic_data jsonb;
begin
  -- Verify platform staff access
  if not (public.is_platform_staff() or auth.role() = 'service_role') then
    raise exception 'Platform staff access required';
  end if;

  -- Verify environment exists
  if not exists (
    select 1 from public.prospect_demo_environments
    where id = p_environment_id
  ) then
    raise exception 'Demo environment not found';
  end if;

  -- Generate synthetic data based on role, device, and config
  -- This is a simplified version - in production, this would call the TypeScript service
  v_synthetic_data := jsonb_build_object(
    'personas', jsonb_build_array(
      jsonb_build_object(
        'key', p_role,
        'label', case p_role
          when 'sales_manager' then 'Retail Sales Manager'
          when 'fashion_designer' then 'Apparel Designer'
          else 'Retail Professional'
        end,
        'attention', case p_role
          when 'sales_manager' then 'Conversion optimization'
          when 'fashion_designer' then 'Customization options'
          else 'Store operations'
        end,
        'primaryAction', case p_role
          when 'sales_manager' then 'Schedule demo'
          when 'fashion_designer' then 'Review product mix'
          else 'Review dashboard'
        end
      )
    ),
    'customers', jsonb_build_array(
      jsonb_build_object(
        'name', case p_device
          when 'desktop' then 'Tech-Savvy Shopper'
          when 'mobile' then 'On-the-go Customer'
          else 'Walk-in Customer'
        end,
        'tier', case p_device
          when 'desktop' then 'VIP'
          else 'Standard'
        end,
        'nextMoment', case p_device
          when 'desktop' then 'Collection preview'
          when 'mobile' then 'Quick fitting'
          else 'Fitting appointment'
        end,
        'lifetimeValue', case p_device
          when 'desktop' then '€12,000'
          when 'mobile' then '€8,500'
          else '€5,000'
        end
      )
    ),
    'products', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'name', product,
          'category', 'Apparel',
          'price', '€150',
          'imageUrl', '/default-product.jpg'
        )
      ) from jsonb_array_elements_text(p_config->'productMix') as product),
      jsonb_build_array(
        jsonb_build_object(
          'name', 'Classic Tailored Suit',
          'category', 'Tailoring',
          'price', '€800',
          'imageUrl', '/default-suit.jpg'
        )
      )
    ),
    'appointments', jsonb_build_array(
      jsonb_build_object('time', '10:00', 'customer', 'Isabelle Moreau', 'purpose', 'Fitting', 'status', 'Confirmed'),
      jsonb_build_object('time', '14:30', 'customer', 'James Wilson', 'purpose', 'Consultation', 'status', 'Pending')
    ),
    'alterations', jsonb_build_array(),
    'orders', jsonb_build_array(),
    'metrics', jsonb_build_object(
      'relationshipValue', '€0',
      'appointmentsToday', 2,
      'garmentsInMotion', 0,
      'returnRate', '5%'
    )
  );

  -- Insert preview record
  insert into public.prospect_demo_previews (environment_id, role, device, preview_data)
  values (p_environment_id, p_role, p_device, v_synthetic_data)
  returning id into v_preview_id;

  return v_preview_id;
end;
$$;

revoke all on function public.generate_prospect_demo_preview(uuid, text, text, jsonb) from public;
grant execute on function public.generate_prospect_demo_preview(uuid, text, text, jsonb) to authenticated, service_role;