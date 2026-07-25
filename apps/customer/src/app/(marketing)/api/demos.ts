import type { DemoSyntheticData, DemoProductMix } from '@paon/domain';
import type { CommercialProspectRepository } from '@paon/database/repositories/commercial-prospect-repository';
import SyntheticDemoService from '@paon/database/services/synthetic-demo-service';
import { auditLog } from '@paon/logging/audit';

const mockRepo = {} as CommercialProspectRepository;
const syntheticDemoService = new SyntheticDemoService(mockRepo);

const AUTHORIZED_ROLES = ['platform_staff', 'service_role'];

const validatePublicationAccess = (role: string) => {
  if (!AUTHORIZED_ROLES.includes(role)) {
    throw new Error('Unauthorized access to demo publication');
  }
};

const logPublication = (params: { role: string; device: string; config: Record<string, unknown> }) => {
  auditLog({
    action: 'publish_demo',
    role: params.role,
    device: params.device,
    config: params.config
  });
};

const generateDemoWithAccessControl = async (params: {
  role: string;
  device: string;
  config: {
    productMix?: DemoProductMix[];
    [key: string]: unknown;
  }
}): Promise<DemoSyntheticData> => {
  validatePublicationAccess(params.role);
  logPublication(params);
  return syntheticDemoService.generateDemo(params);
};

const getDemoPreviewWithAccessControl = async (environmentId: string, role: string, device: string, config: {
     productMix?: DemoProductMix[];
     [key: string]: unknown;
   }): Promise<DemoSyntheticData> => {
     validatePublicationAccess(role);
     logPublication({ role, device, config });
     return syntheticDemoService.generateDemo({ role, device, config, preview: true });
   };

// Export the secured functions
export { generateDemoWithAccessControl as generateDemo };
export { getDemoPreviewWithAccessControl as getDemoPreview };
export { validatePublicationAccess, logPublication };