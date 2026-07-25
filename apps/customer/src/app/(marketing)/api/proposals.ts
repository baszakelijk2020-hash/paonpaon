import type { CommercialProspectRepository } from '@paon/database/repositories/commercial-prospect-repository';
import ProposalGenerationService from '@paon/database/services/proposal-generation-service';
import { auditLog } from '@paon/logging/audit';

const mockRepo = {} as CommercialProspectRepository;
const proposalGenerationService = new ProposalGenerationService(mockRepo, {} as any);

const AUTHORIZED_ROLES = ['platform_staff', 'service_role'];

const validateProposalAccess = (role: string) => {
  if (!AUTHORIZED_ROLES.includes(role)) {
    throw new Error('Unauthorized access to proposal generation');
  }
};

const logProposalGeneration = (params: { role: string; prospectId: string }) => {
  auditLog({
    action: 'generate_proposal',
    role: params.role,
    prospectId: params.prospectId
  });
};

const generateProposalWithAccessControl = async (params: {
  prospectId: string;
  role: string | null;
}): Promise<any> => {
  validateProposalAccess(params.role);
  logProposalGeneration(params);
  return proposalGenerationService.generateProposal(params.prospectId);
};

const getProposalWithAccessControl = async (prospectId: string, role: string): Promise<any> => {
  validateProposalAccess(role);
  logProposalGeneration({ role, prospectId });
  return proposalGenerationService.generateProposal(prospectId);
};

// Export the secured functions
export { generateProposalWithAccessControl as generateProposal };
export { getProposalWithAccessControl as getProposal };
export { validateProposalAccess, logProposalGeneration };