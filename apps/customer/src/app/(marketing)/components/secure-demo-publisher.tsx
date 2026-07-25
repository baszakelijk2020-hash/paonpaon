import React, { useState } from 'react';
import { generateDemo, validatePublicationAccess, logPublication } from '../api/demos';
import type { DemoSyntheticData, DemoProductMix } from '@paon/domain';

interface SecureDemoPublisherProps {
  prospectId: string;
  onPublishSuccess?: (data: DemoSyntheticData) => void;
  onPublishError?: (error: Error) => void;
}

const SecureDemoPublisher = ({ prospectId, onPublishSuccess, onPublishError }: SecureDemoPublisherProps) => {
  const [role, setRole] = useState('sales_manager');
  const [device, setDevice] = useState('desktop');
  const [productMix, setProductMix] = useState<DemoProductMix[]>([]);
  const [demoData, setDemoData] = useState<DemoSyntheticData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  const availableProductMix: DemoProductMix[] = [
    'tailoring', 'formalwear', 'ready_to_wear', 'accessories',
    'bridal', 'made_to_measure'
  ];

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => setRole(e.target.value);
  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => setDevice(e.target.value);

  const handleProductMixChange = (product: DemoProductMix, checked: boolean) => {
    setProductMix(prev => checked
      ? [...prev, product]
      : prev.filter(p => p !== product)
    );
  };

  const handleGeneratePreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await generateDemo({ 
        role, 
        device, 
        config: { productMix } 
      });
      setDemoData(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Preview generation failed';
      setError(errorMessage);
      onPublishError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!demoData) {
      setError('No demo data to publish. Generate a preview first.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Validate access before publishing
      validatePublicationAccess(role);
      
      // Log the publication
      logPublication({ role, device, config: { productMix } });
      
      // In a real implementation, this would call a secure RPC function
      // to publish the demo configuration to the prospect
      const publishResponse = await fetch('/api/demos/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospectId,
          role,
          device,
          productMix,
          demoData
        })
      });

      if (!publishResponse.ok) {
        throw new Error('Failed to publish demo');
      }

      setPublished(true);
      onPublishSuccess?.(demoData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Publication failed';
      setError(errorMessage);
      onPublishError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="secure-demo-publisher">
      <h2>Secure Demo Publisher</h2>
      
      <div className="publisher-controls">
        <div className="control-group">
          <label htmlFor="role">Role:</label>
          <select id="role" value={role} onChange={handleRoleChange}>
            <option value="sales_manager">Sales Manager</option>
            <option value="fashion_designer">Fashion Designer</option>
            <option value="generic">Generic Retailer</option>
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="device">Device:</label>
          <select id="device" value={device} onChange={handleDeviceChange}>
            <option value="desktop">Desktop</option>
            <option value="mobile">Mobile</option>
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="product-mix-group">Product Mix:</label>
          <div id="product-mix-group" className="product-mix-options" role="group">
            {availableProductMix.map(product => (
              <label key={product} className="product-mix-option">
                <input
                  type="checkbox"
                  checked={productMix.includes(product)}
                  onChange={(e) => handleProductMixChange(product, e.target.checked)}
                />
                {product.replace('_', ' ')}
              </label>
            ))}
          </div>
        </div>

        <div className="action-buttons">
          <button 
            onClick={handleGeneratePreview} 
            disabled={loading}
            className="btn-preview"
          >
            {loading ? 'Generating...' : 'Generate Preview'}
          </button>
          
          <button 
            onClick={handlePublish} 
            disabled={loading || !demoData || published}
            className="btn-publish"
          >
            {published ? 'Published' : loading ? 'Publishing...' : 'Publish Demo'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {published && (
        <div className="success-message" role="status">
          Demo published successfully for prospect {prospectId}
        </div>
      )}

      {demoData && (
        <div className="preview-content">
          <h3>Preview</h3>
          <div className="preview-section">
            <h4>Personas:</h4>
            <ul>{demoData.personas.map((p) => <li key={p.key}>{p.label}</li>)}</ul>
          </div>
          <div className="preview-section">
            <h4>Customers:</h4>
            <ul>{demoData.customers.map((c) => <li key={c.name}>{c.name} ({c.tier})</li>)}</ul>
          </div>
          <div className="preview-section">
            <h4>Products:</h4>
            <ul>{demoData.products.map((p) => <li key={p.name}>{p.name} - {p.price}</li>)}</ul>
          </div>
          <div className="preview-section">
            <h4>Appointments:</h4>
            <ul>{demoData.appointments.map((a, i) => <li key={i}>{a.time} - {a.customer} - {a.purpose}</li>)}</ul>
          </div>
          <div className="preview-section">
            <h4>Alterations:</h4>
            <ul>{demoData.alterations.map((a, i) => <li key={i}>{a.garment} - {a.customer} - {a.status}</li>)}</ul>
          </div>
          <div className="preview-section">
            <h4>Metrics:</h4>
            <ul>
              <li>Relationship Value: {demoData.metrics.relationshipValue}</li>
              <li>Appointments Today: {demoData.metrics.appointmentsToday}</li>
              <li>Garments in Motion: {demoData.metrics.garmentsInMotion}</li>
              <li>Return Rate: {demoData.metrics.returnRate}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecureDemoPublisher;