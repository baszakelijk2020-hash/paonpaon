import { SyntheticDemoService } from './synthetic-demo-service';
import type { CommercialProspectRepository } from '../repositories/commercial-prospect-repository';

// Mock repository
const mockRepository: CommercialProspectRepository = {} as CommercialProspectRepository;

describe('SyntheticDemoService', () => {
  let service: SyntheticDemoService;

  beforeEach(() => {
    service = new SyntheticDemoService(mockRepository);
  });

  describe('generateDemo', () => {
    it('should create sales manager persona for sales_manager role', async () => {
      const params = {
        role: 'sales_manager',
        device: 'desktop',
        config: {}
      };

      const result = await service.generateDemo(params);

      expect(result.personas).toHaveLength(1);
      expect(result.personas[0]).toMatchObject({
        key: 'sales_manager',
        label: 'Retail Sales Manager',
        attention: 'Conversion optimization',
        primaryAction: 'Schedule demo'
      });
    });

    it('should create fashion designer persona for fashion_designer role', async () => {
      const params = {
        role: 'fashion_designer',
        device: 'desktop',
        config: {}
      };

      const result = await service.generateDemo(params);

      expect(result.personas).toHaveLength(1);
      expect(result.personas[0]).toMatchObject({
        key: 'fashion_designer',
        label: 'Apparel Designer',
        attention: 'Customization options',
        primaryAction: 'Review product mix'
      });
    });

    it('should create generic persona for other roles', async () => {
      const params = {
        role: 'unknown_role',
        device: 'desktop',
        config: {}
      };

      const result = await service.generateDemo(params);

      expect(result.personas).toHaveLength(1);
      expect(result.personas[0]).toMatchObject({
        key: 'generic',
        label: 'Retail Professional',
        attention: 'Store operations',
        primaryAction: 'Review dashboard'
      });
    });

    it('should create VIP customer for desktop device', async () => {
      const params = {
        role: 'sales_manager',
        device: 'desktop',
        config: {}
      };

      const result = await service.generateDemo(params);

      expect(result.customers).toHaveLength(1);
      expect(result.customers[0]).toMatchObject({
        name: 'Tech-Savvy Shopper',
        tier: 'VIP',
        nextMoment: 'Collection preview',
        lifetimeValue: '€12,000'
      });
    });

    it('should create standard customer for mobile device', async () => {
      const params = {
        role: 'sales_manager',
        device: 'mobile',
        config: {}
      };

      const result = await service.generateDemo(params);

      expect(result.customers).toHaveLength(1);
      expect(result.customers[0]).toMatchObject({
        name: 'On-the-go Customer',
        tier: 'Standard',
        nextMoment: 'Quick fitting',
        lifetimeValue: '€8,500'
      });
    });

    it('should create walk-in customer for other devices', async () => {
      const params = {
        role: 'sales_manager',
        device: 'tablet',
        config: {}
      };

      const result = await service.generateDemo(params);

      expect(result.customers).toHaveLength(1);
      expect(result.customers[0]).toMatchObject({
        name: 'Walk-in Customer',
        tier: 'Standard',
        nextMoment: 'Fitting appointment',
        lifetimeValue: '€5,000'
      });
    });

    it('should process product mix configuration', async () => {
      const params = {
        role: 'sales_manager',
        device: 'desktop',
        config: {
          productMix: ['tailoring', 'bridal']
        }
      };

      const result = await service.generateDemo(params);

      expect(result.products).toHaveLength(2);
      expect(result.products[0]).toMatchObject({
        name: 'tailoring',
        category: 'Apparel',
        price: '€150',
        imageUrl: '/default-product.jpg'
      });
      expect(result.products[1]).toMatchObject({
        name: 'bridal',
        category: 'Apparel',
        price: '€150',
        imageUrl: '/default-product.jpg'
      });
    });

    it('should use default product when no product mix provided', async () => {
      const params = {
        role: 'sales_manager',
        device: 'desktop',
        config: {}
      };

      const result = await service.generateDemo(params);

      expect(result.products).toHaveLength(1);
      expect(result.products[0]).toMatchObject({
        name: 'Classic Tailored Suit',
        category: 'Tailoring',
        price: '€800',
        imageUrl: '/default-suit.jpg'
      });
    });

    it('should generate appointments based on role', async () => {
      const paramsSalesManager = {
        role: 'sales_manager',
        device: 'desktop',
        config: {}
      };
      const resultSalesManager = await service.generateDemo(paramsSalesManager);
      expect(resultSalesManager.appointments).toHaveLength(3); // 2 base + 1 for sales manager

      const paramsGeneric = {
        role: 'generic',
        device: 'desktop',
        config: {}
      };
      const resultGeneric = await service.generateDemo(paramsGeneric);
      expect(resultGeneric.appointments).toHaveLength(2); // only base appointments
    });

    it('should generate alterations based on product mix', async () => {
      const paramsWithTailoring = {
        role: 'sales_manager',
        device: 'desktop',
        config: {
          productMix: ['tailoring']
        }
      };
      const resultWithTailoring = await service.generateDemo(paramsWithTailoring);
      expect(resultWithTailoring.alterations).toHaveLength(1);
      expect(resultWithTailoring.alterations[0]).toMatchObject({
        garment: 'Wool Blazer',
        customer: 'Isabelle Moreau',
        status: 'In Progress',
        progress: 60,
        due: '2026-07-30'
      });

      const paramsWithBridal = {
        role: 'sales_manager',
        device: 'desktop',
        config: {
          productMix: ['bridal']
        }
      };
      const resultWithBridal = await service.generateDemo(paramsWithBridal);
      expect(resultWithBridal.alterations).toHaveLength(1);
      expect(resultWithBridal.alterations[0]).toMatchObject({
        garment: 'Evening Gown Hem',
        customer: 'Sophie Laurent',
        status: 'Pending',
        progress: 0,
        due: '2026-08-05'
      });

      const paramsWithoutMix = {
        role: 'sales_manager',
        device: 'desktop',
        config: {}
      };
      const resultWithoutMix = await service.generateDemo(paramsWithoutMix);
      expect(resultWithoutMix.alterations).toHaveLength(0);
    });

    it('should calculate metrics correctly', async () => {
      const params = {
        role: 'sales_manager',
        device: 'desktop',
        config: {}
      };

      const result = await service.generateDemo(params);

      // We have one customer with lifetimeValue €12,000
      expect(result.metrics.relationshipValue).toBe('€12,000');
      // We have 3 appointments (2 base + 1 for sales manager)
      expect(result.metrics.appointmentsToday).toBe(3);
      // We have 0 alterations in progress (since no tailoring or bridal in product mix by default)
      expect(result.metrics.garmentsInMotion).toBe(0);
      // Return rate is hardcoded to 5% in the service
      expect(result.metrics.returnRate).toBe('5%');
    });
  });
});