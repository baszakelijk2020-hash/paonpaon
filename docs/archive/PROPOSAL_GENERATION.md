# Private Proposal Generation Service

## Overview

The Private Proposal Generation Service is a core component of PAON's Phase 5 (Engagement and Personalisation) roadmap. It enables the creation of personalized commercial proposals for prospects, integrating with the existing prospect management workflows and demo generation systems.

## Key Features

### 1. Personalized Proposal Generation

- Generates tailored proposals based on prospect data and configuration
- Includes customized cover letters, pricing summaries, and implementation timelines
- Integrates with prospect demo configurations and synthetic data

### 2. Integration with Prospect Management

- Works with existing `CommercialProspectRepository` for prospect data
- Leverages `ProspectDemoConfiguration` and `ProspectDemoEnvironment` for demo settings
- Uses `SyntheticDemoService` for generating synthetic demo data

### 3. API Endpoints

- Secure API endpoints for proposal generation with role-based access control
- RESTful design following existing patterns in the marketing API
- Includes proper authentication and audit logging

### 4. UI Components

- `ProposalCard` component for displaying proposal summaries
- `ProposalsPage` for viewing and managing personalized proposals
- Responsive design following PAON's design system

## Architecture

### Core Services

#### ProposalGenerationService

- **Location**: `packages/database/src/services/proposal-generation-service.ts`
- **Responsibilities**:
  - Fetches prospect data from repository
  - Retrieves or generates demo configurations
  - Creates synthetic demo data when needed
  - Generates proposal-specific content (cover letters, pricing, timelines)
  - Returns complete proposal object with all necessary data

#### CommercialProspectRepository

- **Location**: `packages/database/src/repositories/commercial-prospect-repository.ts`
- **Responsibilities**:
  - Manages prospect CRUD operations
  - Handles demo configuration and environment management
  - Provides methods for finding prospects, configurations, and environments

#### SyntheticDemoService

- **Location**: `packages/database/src/services/synthetic-demo-service.ts`
- **Responsibilities**:
  - Generates synthetic demo data for proposals
  - Creates personas, customers, products, appointments, and alterations
  - Calculates metrics based on generated data

### API Layer

#### Proposals API

- **Location**: `apps/customer/src/app/(marketing)/api/proposals.ts`
- **Features**:
  - Secure endpoints with role-based access control
  - Audit logging for all proposal generation requests
  - Proper error handling and validation

### UI Layer

#### ProposalCard Component

- **Location**: `apps/customer/src/app/(marketing)/components/proposal-card.tsx`
- **Features**:
  - Displays proposal summary information
  - Shows prospect details, status, and key metrics
  - Includes actions for viewing and downloading proposals

#### ProposalsPage

- **Location**: `apps/customer/src/app/(marketing)/proposals/page.tsx`
- **Features**:
  - Fetches and displays personalized proposals
  - Handles loading and error states
  - Provides navigation to marketing sections

## Data Models

### Proposal Interface

```typescript
interface Proposal {
  id: string;
  prospectId: string;
  generatedAt: string;
  prospect: CommercialProspect;
  configuration?: ProspectDemoConfiguration;
  environment?: ProspectDemoEnvironment;
  syntheticData: DemoSyntheticData;
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
```

### Integration Points

#### With Prospect Management

- **Endpoint**: `CommercialProspectRepository.findById()`
- **Purpose**: Retrieve prospect data for proposal generation
- **Usage**: Fetches prospect details including company information, contact details, and stage

#### With Demo Configuration

- **Endpoint**: `CommercialProspectRepository.findConfiguration()`
- **Purpose**: Retrieve or create demo configuration
- **Usage**: Provides theme, product mix, and feature configuration for personalized proposals

#### With Demo Environment

- **Endpoint**: `CommercialProspectRepository.findEnvironment()`
- **Purpose**: Retrieve existing demo environment or generate new one
- **Usage**: Uses synthetic data for proposal content and demonstration

## Usage Examples

### Generating a Proposal

```typescript
import { generateProposal } from "@/api/proposals";

const proposal = await generateProposal({
  prospectId: "prospect-123",
  role: "sales_manager",
});
```

### Viewing Proposals

```typescript
// Navigate to prospect-specific proposals page
router.push("/prospects/prospect-123/proposals");
```

## Testing

### Unit Tests

- **Location**: `packages/database/src/services/proposal-generation-service.test.ts`
- **Coverage**:
  - Prospect not found error handling
  - Proposal generation with configuration
  - Proposal generation with existing environment
  - Default theme usage when configuration is missing

### Integration Tests

- Test proposal generation with real prospect data
- Verify integration with demo configuration system
- Test API endpoint security and access control

## Security

### Access Control

- All proposal generation endpoints require authentication
- Role-based access control (platform_staff, service_role)
- Audit logging for all proposal generation requests

### Data Protection

- Prospect data is accessed through secure repository methods
- Sensitive information is properly sanitized in UI components
- API endpoints use HTTPS and proper authentication

## Performance Considerations

### Caching

- Proposal generation results can be cached for frequently accessed prospects
- Synthetic demo data generation is optimized for performance

### Database Queries

- Efficient querying of prospect, configuration, and environment data
- Minimized database round-trips through batch operations where possible

## Future Enhancements

### 1. Advanced Personalization

- Machine learning-based proposal customization
- Dynamic pricing based on prospect characteristics
- Automated proposal optimization based on conversion data

### 2. Collaboration Features

- Team collaboration on proposal generation
- Version control for proposals
- Approval workflows for proposal finalization

### 3. Integration with CRM

- Sync with external CRM systems
- Automated proposal generation based on CRM triggers
- Integration with sales pipeline management

## Migration Guide

### From Demo Generation to Proposal Generation

1. Update prospect management workflows to include proposal generation
2. Configure API endpoints for secure access
3. Update UI components to display proposal information
4. Train staff on new proposal generation processes

### Rollout Strategy

1. **Phase 1**: Internal testing and staff training
2. **Phase 2**: Limited external access for pilot prospects
3. **Phase 3**: Full rollout to all commercial prospects

## Troubleshooting

### Common Issues

#### "Prospect not found"

- **Cause**: Invalid prospect ID or prospect has been deleted
- **Solution**: Verify prospect ID and check prospect status

#### "Unauthorized access"

- **Cause**: Insufficient permissions for proposal generation
- **Solution**: Ensure user has required role (platform_staff or service_role)

#### "Configuration missing"

- **Cause**: Prospect has no demo configuration
- **Solution**: Create demo configuration for the prospect or use default settings

## Support

For issues with the proposal generation service:

1. Check the application logs for detailed error information
2. Verify prospect and configuration data
3. Ensure proper API authentication and permissions
4. Contact the development team for complex issues

## References

- [Phase 5 Roadmap](docs/ROADMAP.md)
- [Commercial Prospector Documentation](docs/DOMAIN_MODEL.md)
- [Demo Generation Service](packages/database/src/services/synthetic-demo-service.ts)
- [API Security Guidelines](docs/API.md)
