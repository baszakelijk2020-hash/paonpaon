import { ProposalGenerationService } from './proposal-generation-service';
import type { CommercialProspectRepository } from '../repositories/commercial-prospect-repository';
import type { SyntheticDemoService } from './synthetic-demo-service';
import type { CommercialProspect, ProspectDemoConfiguration, DemoSyntheticData } from '@paon/domain';

// Mock repository
const mockProspectRepo: CommercialProspectRepository = {
  findById: jest.fn(),
  findConfiguration: jest.fn(),
  findEnvironment: jest.fn()
} as CommercialProspectRepository;

// Mock synthetic demo service
const mockSyntheticDemoService: SyntheticDemoService = {
  generateDemo: jest.fn()
} as SyntheticDemoService;

describe('ProposalGenerationService', () => {
  let service: ProposalGenerationService;

  beforeEach(() => {
    service = new ProposalGenerationService(mockProspectRepo, mockSyntheticDemoService);
    jest.clearAllMocks();
  });

  describe('generateProposal', () => {
    const mockProspect: CommercialProspect = {
      id: 'prospect-1',
      companyName: 'Test Company',
      primaryContactName: 'John Doe',
      primaryContactEmail: 'john@example.com',
      stage: 'qualified',
      source: 'website',
      observedOpportunities: ['opportunity1', 'opportunity2'],
      salesNotes: 'Test notes',
      recommendedPlanId: 'plan-1',
      nextAction: 'Schedule demo',
      nextActionDueAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const mockConfiguration: ProspectDemoConfiguration = {
      id: 'config-1',
      prospectId: 'prospect-1',
      planId: 'premium',
      theme: {
        logoUrl: '',
        faviconUrl: '',
        heroImageUrl: '',
        accentColor: '#000000',
        surfaceColor: '#ffffff',
        inkColor: '#000000',
        displayFont: 'paon_editorial',
        bodyFont: 'quiet_sans',
        cornerStyle: 'tailored'
      },
      marketingHeadline: 'Test Headline',
      personalizedIntroduction: 'Test Introduction',
      locations: [],
      productMix: ['tailoring'],
      featureKeys: ['feature1'],
      status: 'draft',
      currentVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const mockSyntheticData: DemoSyntheticData = {
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

    it('should handle missing prospect', async () => {
      mockProspectRepo.findById.mockResolvedValue(null);

      await expect(service.generateProposal('non-existent-id')).rejects.toThrow(
        'Prospect not found: non-existent-id'
      );
    });

    it('should handle missing configuration', async () => {
      mockProspectRepo.findById.mockResolvedValue(mockProspect);
      mockProspectRepo.findConfiguration.mockResolvedValue(null);
      mockProspectRepo.findEnvironment.mockResolvedValue(null);
      mockSyntheticDemoService.generateDemo.mockResolvedValue(mockSyntheticData);

      const proposal = await service.generateProposal('prospect-1');

      expect(proposal.configuration).toBeNull();
      expect(proposal.syntheticData).toEqual(mockSyntheticData);
      expect(proposal.coverLetter).toContain('Dear John Doe');
      expect(proposal.pricingSummary.planName).toBe('Premium Plan');
    });

    it('should handle synthetic demo service error', async () => {
      mockProspectRepo.findById.mockResolvedValue(mockProspect);
      mockProspectRepo.findConfiguration.mockResolvedValue(mockConfiguration);
      mockProspectRepo.findEnvironment.mockResolvedValue(null);
      mockSyntheticDemoService.generateDemo.mockRejectedValue(new Error('Demo generation failed'));

      await expect(service.generateProposal('prospect-1')).rejects.toThrow('Demo generation failed');
    });
  });
});