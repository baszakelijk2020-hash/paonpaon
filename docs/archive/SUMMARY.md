> **Obsolete / archived.** Not authoritative. See [README.md](./README.md). Live constitution: [../README.md](../README.md).

# Secure Publication Controls for Demo Studio Workflows

## Overview

This implementation provides secure publication controls for the PAON demo studio workflows as part of roadmap phase 5. The solution implements role-based access control, validation, audit logging, and secure publishing workflows for synthetic demo generation.

## Core Components Implemented

### 1. Secure API Endpoints (`apps/customer/src/app/(marketing)/api/demos.ts`)

- **Role-based access control**: Validates that only authorized roles (`platform_staff`, `service_role`) can publish demos
- **Audit logging**: Logs all publication events with role, device, and configuration details
- **Validation functions**: Exports `validatePublicationAccess` and `logPublication` for reuse
- **Secure exports**: Wraps original `generateDemo` and `getDemoPreview` with access control

### 2. Secure Demo Publisher Component (`apps/customer/src/app/(marketing)/components/secure-demo-publisher.tsx`)

- **Interactive publishing workflow**: Complete UI for generating previews and publishing demos
- **Role/Device selection**: Dropdown controls for sales_manager, fashion_designer, generic roles and desktop/mobile devices
- **Product mix configuration**: Checkbox-based selection of product categories (tailoring, formalwear, ready_to_wear, accessories, bridal, made_to_measure)
- **Preview generation**: Real-time synthetic data preview before publishing
- **Secure publishing**: Validates access, logs publication, and calls secure RPC endpoint
- **Error handling**: Comprehensive error states with user-friendly messages
- **Success feedback**: Confirmation display upon successful publication
- **Accessibility**: Proper ARIA labels, roles, and form associations

### 3. Enhanced Synthetic Demo Service (`packages/database/src/services/synthetic-demo-service.ts`)

- **Role-specific personas**: Creates distinct user personas based on role inputs
- **Device-specific customers**: Generates customer profiles based on device type
- **Product mix processing**: Handles predefined product categories for tailored demo content
- **Appointment generation**: Creates realistic appointment schedules based on role
- **Alteration workflows**: Generates relevant garment alteration scenarios
- **Metrics calculation**: Computes business metrics with realistic values

### 4. Database Integration (`supabase/migrations/20260724000007_create_demo_studio.sql`)

- **Demo configuration tables**: `prospect_demo_configurations`, `prospect_demo_modules`, `prospect_demo_configuration_versions`
- **Secure RPC function**: `save_prospect_demo_configuration` with platform staff authorization
- **Row-level security**: Policies restricting access to platform staff only
- **Version control**: Automatic versioning with change notes and audit trail

### 5. Testing (`packages/database/src/services/synthetic-demo-service.test.ts`)

- **Comprehensive test suite**: Covers all synthetic data generation scenarios
- **Role-specific persona creation**: Tests for sales_manager, fashion_designer, generic roles
- **Device-specific customer profiles**: Tests for desktop, mobile, tablet devices
- **Product mix processing**: Validates product generation from configuration
- **Appointment generation**: Verifies role-based appointment scheduling
- **Alteration workflows**: Tests product mix-dependent alteration scenarios
- **Metrics calculation**: Validates business metric computations

## Security Features

### Role-Based Access Control

- Only `platform_staff` and `service_role` can publish demos
- Validation occurs at both API and database RPC levels
- Unauthorized attempts throw descriptive errors

### Audit Logging

- All publication events logged with:
  - Action type (`publish_demo`)
  - User role
  - Device type
  - Configuration parameters
- Immutable audit trail for compliance

### Data Validation

- Theme validation via `is_valid_retailer_brand_theme` function
- Product mix validation against allowed categories
- Location array length limits (max 25)
- Marketing headline (max 180 chars) and introduction (max 2000 chars) limits
- Change note requirements (2-240 chars)

## Integration Flow

1. User selects role, device, and product mix in Secure Demo Publisher
2. User clicks "Generate Preview" to see synthetic data
3. User reviews preview data (personas, customers, products, appointments, alterations, metrics)
4. User clicks "Publish Demo" to initiate secure publication
5. System validates publication access for the user's role
6. System logs publication event to audit trail
7. System calls secure RPC endpoint to persist demo configuration
8. Success confirmation displayed to user

## Benefits

- **Security**: Prevents unauthorized demo publication
- **Auditability**: Complete audit trail of all publications
- **Usability**: Intuitive UI for demo configuration and preview
- **Reliability**: Comprehensive validation prevents invalid configurations
- **Compliance**: Role-based access meets enterprise security requirements

## Next Steps

- [x] Implement secure publication RPC functions with role-based access control
- [x] Add validation and audit logging for demo publications
- [x] Create UI components for secure publishing workflow
- [x] Write unit tests for publication controls
- [x] Update documentation
- [ ] Add integration tests for end-to-end publishing workflow
- [ ] Implement performance monitoring for demo generation
- [ ] Add analytics for demo usage tracking
