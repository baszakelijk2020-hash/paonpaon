import { supabase } from '@/lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { ALTERATION_MEASUREMENT_TYPES } from './constants';
import { logError } from '@/lib/utils';

export class AlterationMeasurementService {
  /**
   * Process voice command and store measurement
   * @param userId - Authenticated user ID
   * @param voiceCommand - Raw voice command text
   * @param measurementType - Type of measurement being set
   * @param value - Numeric value from voice command
   * @param unit - Unit of measurement (default 'mm')
   * @returns Object with measurement details
   */
  static async processVoiceCommand(
    userId: string,
    voiceCommand: string,
    measurementType: string,
    value: number,
    unit: string = 'mm'
  ): Promise<any> {
    try {
      // Validate measurement type
      if (!Object.values(ALTERATION_MEASUREMENT_TYPES).includes(measurementType)) {
        throw new Error(`Invalid measurement type: ${measurementType}`);
      }

      // Parse and validate value
      const numericValue = parseFloat(value);
      if (isNaN(numericValue) || numericValue < 0) {
        throw new Error(`Invalid measurement value: ${value}`);
      }

      // Store measurement
      const { data, error } = await supabase
        .from('alteration_measurements')
        .insert({
          customer_id: userId,
          garment_id: null, // Will be set based on context
          measurement_type: measurementType,
          value: numericValue,
          unit,
          voice_command: voiceCommand.toLowerCase(),
          confidence_score: 0.9, // Could be calculated from speech recognition
          status: 'validated'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      logError('ALTERATION_MEASUREMENT_SERVICE_ERROR', error);
      throw error;
    }
  }

  /**
   * Get measurement history for a customer
   * @param customerId - Customer ID
   * @param options - Filter options
   * @returns Array of measurements
   */
  static async getMeasurementHistory(
    customerId: string,
    options?: {
      type?: string;
      limit?: number;
      orderBy?: 'recorded_at' | 'measurement_type';
    }
  ): Promise<any[]> {
    try {
      const query = supabase
        .from('alteration_measurements')
        .select(`
          *,
          customers!inner(id, name, email)
        `)
        .eq('customer_id', customerId)
        .order('recorded_at', { ascending: false });

      // Apply filters
      if (options?.type) {
        query.eq('measurement_type', options.type);
      }
      if (options?.limit) {
        query.limit(options.limit);
      }
      if (options?.orderBy) {
        query.order(options.orderBy, { ascending: options.orderBy === 'recorded_at' });
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      logError('ALTERATION_MEASUREMENT_HISTORY_ERROR', error);
      throw error;
    }
  }

  /**
   * Get measurement by ID
   * @param measurementId - UUID of measurement
   * @returns Measurement object
   */
  static async getMeasurementById(measurementId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('alteration_measurements')
        .select('*')
        .eq('id', measurementId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
        throw error;
      }

      return data;
    } catch (error) {
      logError('ALTERATION_MEASUREMENT_BY_ID_ERROR', error);
      throw error;
    }
  }

  /**
   * Update measurement status
   * @param measurementId - UUID of measurement
   * @param status - New status ('pending', 'validated', 'rejected')
   * @returns Updated measurement object
   */
  static async updateMeasurementStatus(
    measurementId: string,
    status: 'pending' | 'validated' | 'rejected'
  ): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('alteration_measurements')
        .update({ status })
        .eq('id', measurementId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      logError('ALTERATION_MEASUREMENT_STATUS_UPDATE_ERROR', error);
      throw error;
    }
  }

  /**
   * Get confidence score threshold for auto-validation
   * @returns Number - Confidence threshold
   */
  static get CONFIDENCE_THRESHOLD(): number {
    return 0.85; // 85% confidence required for automatic validation
  }
}

// Constants for measurement types
export const ALTERATION_MEASUREMENT_TYPES = {
  NEGIENG: 'neiging',      // Leg length adjustment
  KRAAG: 'kraag',          // Collar adjustment
  SCHOUDER_R: 'schouder_r', // Right shoulder adjustment
  SCHOUDER_L: 'schouder_l', // Left shoulder adjustment
  SLUITKNOOP: 'sluitknoop', // Button adjustment
  ARMLENGTE: 'arm_length', // Sleeve length
  BORSTEL: 'borstel',      // Chest measurement
  TALLE: 'taille',         // Waist measurement
  HEUP: 'heup',            // Hip measurement
  MIJNEN: 'mijnen',        // Inseam
  BUITENLEG: 'buitenleg',  // Outseam
  RIEM: 'riem',            // Belt
  BROEKLEN: 'broeklen',    // Pant length
  JAKEEN: 'jakeen',        // Sleeve opening
  SCHOUDER_BREEDTE: 'schouder_breedte', // Shoulder width
  BORSTEL_OMvang: 'borstel_omvang', // Chest circumference
  HANDLEENGTE: 'hand_length', // Hand length
  VINGER_LANGTE: 'vinger_lengte', // Finger length
  // Add more as needed
};

export default AlterationMeasurementService;