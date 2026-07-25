import React, { useState } from 'react';
import { generateDemo } from '../api/demos';
import type { DemoSyntheticData } from '@paon/domain';

const RoleDevicePreview = () => {
  const [role, setRole] = useState('sales_manager');
  const [device, setDevice] = useState('desktop');
  const [demoData, setDemoData] = useState<DemoSyntheticData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => setRole(e.target.value);
  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => setDevice(e.target.value);
  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await generateDemo({ role, device, config: {} });
      setDemoData(data);
    } catch (error) {
      console.error('Demo generation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="role-device-preview">
      <h2>Role/Device Preview</h2>
      <div className="controls">
        <label>Role:</label>
        <select value={role} onChange={handleRoleChange}>
          <option value="sales_manager">Sales Manager</option>
          <option value="fashion_designer">Fashion Designer</option>
          <option value="generic">Generic Retailer</option>
        </select>
        <label>Device:</label>
        <select value={device} onChange={handleDeviceChange}>
          <option value="desktop">Desktop</option>
          <option value="mobile">Mobile</option>
        </select>
        <button onClick={handleGenerate} disabled={!role || !device || loading}>Generate Demo</button>
      </div>
      {loading ? <p>Loading...</p> : (
        <div className="preview-content">
          {demoData && (
            <div>
              <h3>Personas:</h3>
              <ul>{demoData.personas.map((p) => <li key={p.key}>{p.label}</li>)}</ul>
              <h3>Customers:</h3>
              <ul>{demoData.customers.map((c) => <li key={c.name}>{c.name}</li>)}</ul>
              <h3>Products:</h3>
              <ul>{demoData.products.map((p) => <li key={p.name}>{p.name}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RoleDevicePreview;