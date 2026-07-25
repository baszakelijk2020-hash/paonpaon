// Integration test for pilot-to-live onboarding transition
import { supabase } from '../client';
import { v4 as uuidv4 } from 'uuid';

describe('Pilot-to-Live Onboarding Transition', () => {
  const testProspectId = uuidv4();

  // Create a test prospect in 'pilot' stage
  beforeAll(async () => {
    await supabase.from('commercial_prospects').insert({
      company_name: 'Test Retailer Inc.',
      primary_contact_name: 'John Doe',
      primary_contact_email: 'john@example.com',
      stage: 'pilot',
      source: 'test',
    });
  });

  test('converts pilot prospect to live retailer', async () => {
    const { data: retailer, error } = await supabase.rpc('convert_pilot_to_live_retailer', {
      p_prospect_id: testProspectId,
    });

    expect(error).toBeNull();
    expect(retailer).toBeTruthy();
    expect(retailer.id).toBeTruthy();

    // Verify the prospect stage was updated
    const { data: updatedProspect } = await supabase
      .from('commercial_prospects')
      .select('stage')
      .eq('id', testProspectId)
      .single();

    expect(updatedProspect.stage).toBe('converted');

    // Verify the retailer was created with correct attributes
    const { data: retailerDetails } = await supabase
      .from('retailers')
      .select('status, legal_name, display_name')
      .eq('id', retailer)
      .single();

    expect(retailerDetails.status).toBe('active');
    expect(retailerDetails.legal_name).toBe('Test Retailer Inc.');
  });
});
