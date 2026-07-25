import type { CommercialProspectRepository } from '../repositories/commercial-prospect-repository';
import type { SyntheticDemoService } from './synthetic-demo-service';
import type { CommercialProspect, ProspectDemoConfiguration, ProspectDemoEnvironment, DemoSyntheticData, RetailerBrandTheme } from '@paon/domain';
import { DEFAULT_RETAILER_BRAND_THEME } from '@paon/domain/retailer/retailer';

export interface Proposal {
  id: string;
  prospectId: string;
  generatedAt: string;
  prospect: CommercialProspect;
  configuration?: ProspectDemoConfiguration | null;
  environment?: ProspectDemoEnvironment | null;
  syntheticData: DemoSyntheticData;
  // Additional proposal-specific fields
  coverLetter: string;
  pricingSummary: {
    planName: string;
    monthlyPrice: string;
    setupFee?: string;
    contractTerm: string;
  };
  implementationTimeline: {
    phases: Array<{
      name: string;
      duration: string;
      description: string;
    }>;
  };
  termsAndConditions: string;
}

export class ProposalGenerationService {
  constructor(
    private readonly prospectRepo: CommercialProspectRepository,
    private readonly syntheticDemoService: SyntheticDemoService
  ) {}

  async generateProposal(prospectId: string): Promise<Proposal> {
    // Fetch prospect
    const prospect = await this.prospectRepo.findById(prospectId);
    if (!prospect) {
      throw new Error(`Prospect not found: ${prospectId}`);
    }

    // Fetch configuration (if exists)
    const configuration = await this.prospectRepo.findConfiguration(prospectId);

    // Explicit null check for configuration - provide default if null
    const config = configuration ?? {
      prospectId: prospect.id,
      planId: '',
      theme: DEFAULT_RETAILER_BRAND_THEME,
      marketingHeadline: '',
      personalizedIntroduction: '',
      locations: [],
      productMix: ['tailoring'],
      featureKeys: [],
      status: 'draft',
      currentVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Fetch latest environment (if exists) or generate synthetic data
    let environment = await this.prospectRepo.findEnvironment(prospectId);
    let syntheticData: DemoSyntheticData;

    if (environment) {
      syntheticData = environment.syntheticData;
    } else {
      // If no environment exists, generate synthetic data based on configuration
      // We'll use a default role and device for the proposal
      syntheticData = await this.syntheticDemoService.generateDemo({
        role: 'sales_manager', // Default role for proposal
        device: 'desktop',
        config: {
          productMix: config.productMix
        }
      });
    }

    // Generate proposal-specific content
    const coverLetter = this.generateCoverLetter(prospect, configuration);
    const pricingSummary = this.generatePricingSummary(configuration);
    const implementationTimeline = this.generateImplementationTimeline(configuration);
    const termsAndConditions = this.generateTermsAndConditions();

    return {
      id: crypto.randomUUID(),
      prospectId: prospect.id,
      generatedAt: new Date().toISOString(),
      prospect,
      configuration: configuration ?? null,
      environment: environment ?? null,
      syntheticData,
      coverLetter,
      pricingSummary,
      implementationTimeline,
      termsAndConditions
    };
  }

  private generateCoverLetter(prospect: CommercialProspect, configuration?: ProspectDemoConfiguration | null): string {
    const planName = configuration?.planId || 'Standard Plan';
    return `
      Dear ${prospect.primaryContactName},

      Thank you for considering PAON for ${prospect.companyName}'s retail operations needs.

      Based on our discussions and your observed opportunities in ${prospect.observedOpportunities.join(', ')}, 
      we have prepared a personalized proposal that outlines how our ${planName} solution can help you achieve your business objectives.

      Our proposal includes a customized demonstration environment showcasing our platform's capabilities tailored to your specific needs.

      We look forward to the opportunity to work with ${prospect.companyName}.

      Best regards,
      The PAON Team
    `.trim();
  }

  private generatePricingSummary(configuration?: ProspectDemoConfiguration | null): {
    planName: string;
    monthlyPrice: string;
    setupFee?: string;
    contractTerm: string;
  } {
    // In a real implementation, we would look up plan pricing from a plans service
    const planId = configuration?.planId || 'standard';
    let planName = 'Standard Plan';
    let monthlyPrice = '€299';
    let setupFee = '€999';
    let contractTerm = '12 months';

    // This is simplified - in reality we'd have a plans catalog
    if (planId === 'premium') {
      planName = 'Premium Plan';
      monthlyPrice = '€499';
      setupFee = '€1499';
    } else if (planId === 'enterprise') {
      planName = 'Enterprise Plan';
      monthlyPrice = '€999';
      setupFee = '€2999';
      contractTerm = '24 months';
    }

    return {
      planName,
      monthlyPrice,
      setupFee,
      contractTerm
    };
  }

  private generateImplementationTimeline(_configuration?: ProspectDemoConfiguration | null): {
    phases: Array<{
      name: string;
      duration: string;
      description: string;
    }>;
  } {
    return {
      phases: [
        {
          name: 'Onboarding',
          duration: '2-4 weeks',
          description: 'Account setup, data migration, and initial configuration'
        },
        {
          name: 'Training',
          duration: '1-2 weeks',
          description: 'Staff training on platform usage and best practices'
        },
        {
          name: 'Go Live',
          duration: '1 week',
          description: 'Full launch with ongoing support'
        },
        {
          name: 'Optimization',
          duration: 'Ongoing',
          description: 'Continuous improvement and feature adoption'
        }
      ]
    };
  }

  private generateTermsAndConditions(): string {
    return `
      1. This proposal is valid for 30 days from the date of generation.
      2. Pricing does not include applicable taxes.
      3. Implementation timeline begins upon receipt of signed agreement.
      4. Services are subject to PAON's standard terms of service terms.
      5. Custom development outside the defined scope may incur additional charges.
      6. Data security and privacy are governed by our GDPR-compliant policies.
    `.trim();
  }
}

export default ProposalGenerationService;