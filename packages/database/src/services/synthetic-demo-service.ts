import type { DemoSyntheticData, ProspectDemoConfiguration, DemoProductMix } from '@paon/domain/retailer/commercial-prospect';
import type { CommercialProspectRepository } from '../repositories/commercial-prospect-repository';

interface GenerateSyntheticDemoParams {
  role: string;
  device: string;
  config: ProspectDemoConfiguration;
}

class SyntheticDemoService {
  constructor(private readonly prospectRepo: CommercialProspectRepository) {}

  async generateDemo(params: GenerateSyntheticDemoParams): Promise<DemoSyntheticData> {
    const baseData: DemoSyntheticData = {
      personas: [],
      customers: [],
      products: [],
      appointments: [],
      alterations: [],
      orders: [],
      metrics: {
        relationshipValue: '€0',
        appointmentsToday: 0,
        garmentsInMotion: 0,
        returnRate: '0%'
      }
    };

    // Role-specific personas
    switch (params.role) {
      case 'sales_manager':
        baseData.personas.push({
          key: 'sales_manager',
          label: 'Retail Sales Manager',
          attention: 'Conversion optimization',
          primaryAction: 'Schedule demo'
        });
        break;

      case 'fashion_designer':
        baseData.personas.push({
          key: 'fashion_designer',
          label: 'Apparel Designer',
          attention: 'Customization options',
          primaryAction: 'Review product mix'
        });
        break;

      default:
        baseData.personas.push({
          key: 'generic',
          label: 'Retail Professional',
          attention: 'Store operations',
          primaryAction: 'Review dashboard'
        });
    }

    // Device-specific customers
    switch (params.device) {
      case 'desktop':
        baseData.customers.push({
          name: 'Tech-Savvy Shopper',
          tier: 'VIP',
          nextMoment: 'Collection preview',
          lifetimeValue: '€12,000'
        });
        break;

      case 'mobile':
        baseData.customers.push({
          name: 'On-the-go Customer',
          tier: 'Standard',
          nextMoment: 'Quick fitting',
          lifetimeValue: '€8,500'
        });
        break;

      default:
        baseData.customers.push({
          name: 'Walk-in Customer',
          tier: 'Standard',
          nextMoment: 'Fitting appointment',
          lifetimeValue: '€5,000'
        });
    }

    // Process product mix
    if (params.config && params.config.productMix && Array.isArray(params.config.productMix)) {
      params.config.productMix.forEach(product => {
        baseData.products.push({
          name: product || 'Sample Product',
          category: 'Apparel',
          price: '€150',
          imageUrl: '/default-product.jpg'
        });
      });
    } else {
      baseData.products.push({
        name: 'Classic Tailored Suit',
        category: 'Tailoring',
        price: '€800',
        imageUrl: '/default-suit.jpg'
      });
    }

    // Generate appointments
    baseData.appointments = this._generateAppointments(params.role);

    // Create alterations
    baseData.alterations = this._generateAlterations(params.config.productMix);

    // Calculate metrics
    baseData.metrics = this._calculateMetrics(baseData);

    return baseData;
  }

  private _generateAppointments(role: string): Array<{ time: string; customer: string; purpose: string; status: string }> {
    const appointments = [
      { time: '10:00', customer: 'Isabelle Moreau', purpose: 'Fitting', status: 'Confirmed' },
      { time: '14:30', customer: 'James Wilson', purpose: 'Consultation', status: 'Pending' }
    ];

    if (role === 'sales_manager') {
      appointments.push({ time: '16:00', customer: 'Corporate Client', purpose: 'Bulk Order', status: 'Scheduled' });
    }

    return appointments;
  }

  private _generateAlterations(productMix: DemoProductMix[] | undefined): Array<{ garment: string; customer: string; status: string; progress: number; due: string }> {
    const alterations: Array<{ garment: string; customer: string; status: string; progress: number; due: string }> = [];

    if (productMix && productMix.includes('tailoring')) {
      alterations.push({
        garment: 'Wool Blazer',
        customer: 'Isabelle Moreau',
        status: 'In Progress',
        progress: 60,
        due: '2026-07-30'
      });
    }

    if (productMix && productMix.includes('bridal')) {
      alterations.push({
        garment: 'Evening Gown Hem',
        customer: 'Sophie Laurent',
        status: 'Pending',
        progress: 0,
        due: '2026-08-05'
      });
    }

    return alterations;
  }

  private _calculateMetrics(data: DemoSyntheticData): { relationshipValue: string; appointmentsToday: number; garmentsInMotion: number; returnRate: string } {
    const totalValue = data.customers.reduce((sum: number, c: { lifetimeValue: string }) => {
      const value = parseFloat(c.lifetimeValue.replace(/[^\d]/g, '')) || 0;
      return sum + value;
    }, 0);

    return {
      relationshipValue: `€${totalValue.toLocaleString()}`,
      appointmentsToday: data.appointments.length,
      garmentsInMotion: data.alterations.filter((a: { status: string }) => a.status === 'In Progress').length,
      returnRate: '5%'
    };
  }
}

export default SyntheticDemoService;