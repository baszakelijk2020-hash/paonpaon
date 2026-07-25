import { CommercialProspectRepository } from '../repositories/commercial-prospect-repository';
import { ProposalGenerationService } from './proposal-generation-service';
import type { CreateCommercialProspectParams } from '../repositories/commercial-prospect-repository';

export class ProspectCreationService {
  constructor(
    private readonly prospectRepo: CommercialProspectRepository,
    private readonly proposalService: ProposalGenerationService
  ) {}

  async createWithProposal(params: CreateCommercialProspectParams): Promise<{ prospectId: string; proposalId: string }> {
    // Create the prospect
    const prospectId = await this.prospectRepo.create(params);
    
    // Generate a proposal for the newly created prospect
    const proposal = await this.proposalService.generateProposal(prospectId);
    
    return { prospectId, proposalId: proposal.id };
  }
}