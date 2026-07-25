import { auditLog } from '@paon/logging/audit';
 
const STAFF_ROLES = ['platform_staff', 'service_role', 'owner', 'admin', 'manager', 'sales_associate'];
 
const validateProductAccess = (role: string, action: 'read' | 'write') => {
  if (action === 'read') {
    // Public read access for active products
    return true;
  }
  
  if (action === 'write') {
    if (!STAFF_ROLES.includes(role)) {
      throw new Error('Unauthorized: Staff role required for product management');
    }
  }
};

const logProductAccess = (params: {
  action: string;
  role: string;
  productId?: string;
  retailerId?: string;
}) => {
  auditLog({
    action: params.action,
    role: params.role,
    productId: params.productId,
    retailerId: params.retailerId,
  });
};
 
interface ProductListParams {
  retailerId: string;
  role: string;
  status?: 'active' | 'draft' | 'archived';
  collectionId?: string;
  limit?: number;
  offset?: number;
}
 
interface ProductDetailParams {
  productId: string;
  retailerId: string;
  role: string;
}
 
interface CreateProductParams {
  retailerId: string;
  role: string;
  name: string;
  slug: string;
  description?: string;
  status?: 'draft' | 'active' | 'archived';
  isMadeToOrder?: boolean;
  isAlterable?: boolean;
  collectionIds?: string[];
  primaryImageUrl?: string;
  variants: Array<{
    sku: string;
    size?: string;
    color?: string;
    priceAmountMinorUnits: number;
    priceCurrency: string;
    compareAtPriceAmountMinorUnits?: number;
    inventoryQuantity?: number;
    leadTimeDays?: number;
  }>;
}
 
const listProductsWithAccessControl = async (params: ProductListParams) => {
  validateProductAccess(params.role, 'read');
  logProductAccess({ action: 'list_products', role: params.role, retailerId: params.retailerId });
  
  // Mock response for demo
  return {
    products: [],
    total: 0,
    limit: params.limit || 20,
    offset: params.offset || 0,
  };
};
 
const getProductWithAccessControl = async (params: ProductDetailParams) => {
  validateProductAccess(params.role, 'read');
  logProductAccess({ action: 'get_product', role: params.role, productId: params.productId, retailerId: params.retailerId });
  
  // Mock response for demo
  return {
    id: params.productId,
    retailerId: params.retailerId,
    name: 'Sample Product',
    slug: 'sample-product',
    description: 'A sample product for demonstration',
    status: 'active' as const,
    isMadeToOrder: true,
    isAlterable: true,
    collectionIds: [],
    primaryImageUrl: undefined,
    variants: [],
    collections: [],
  };
};
 
const createProductWithAccessControl = async (params: CreateProductParams) => {
  validateProductAccess(params.role, 'write');
  logProductAccess({ action: 'create_product', role: params.role, retailerId: params.retailerId });
  
  // Mock response for demo
  return {
    id: 'new-product-id',
    retailerId: params.retailerId,
    name: params.name,
    slug: params.slug,
    description: params.description || '',
    status: params.status || 'draft',
    isMadeToOrder: params.isMadeToOrder || false,
    isAlterable: params.isAlterable || false,
    collectionIds: params.collectionIds || [],
    primaryImageUrl: params.primaryImageUrl,
    variants: params.variants.map((v, i) => ({
      id: `variant-${i}`,
      productId: 'new-product-id',
      ...v,
    })),
  };
};
 
// Export the secured functions
export {
  listProductsWithAccessControl as listProducts,
  getProductWithAccessControl as getProduct,
  createProductWithAccessControl as createProduct,
  validateProductAccess,
  logProductAccess,
};