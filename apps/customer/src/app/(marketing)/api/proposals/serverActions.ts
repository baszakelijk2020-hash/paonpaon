'use server';

import type { Proposal } from '@paon/database/services/proposal-generation-service';
import type { CommercialProspectRepository } from '@paon/database/repositories/commercial-prospect-repository';
import SyntheticDemoService from '@paon/database/services/synthetic-demo-service';
import ProposalGenerationService from '@paon/database/services/proposal-generation-service';

const mockRepo = {} as CommercialProspectRepository;
const mockSyntheticDemoService = new SyntheticDemoService(mockRepo);
const proposalGenerationService = new ProposalGenerationService(mockRepo, mockSyntheticDemoService);

const AUTHORIZED_ROLES = ['platform_staff', 'service_role'] as const;

function validateProposalAccess(role: string): void {
  if (!AUTHORIZED_ROLES.includes(role as typeof AUTHORIZED_ROLES[number])) {
    throw new Error('Unauthorized access to proposal generation');
  }
}

export async function generateProposal(params: { prospectId: string; role: string }): Promise<Proposal> {
  validateProposalAccess(params.role);
  return proposalGenerationService.generateProposal(params.prospectId);
}

export async function getProposal(params: { prospectId: string; role: string }): Promise<Proposal> {
  validateProposalAccess(params.role);
  return proposalGenerationService.generateProposal(params.prospectId);
}