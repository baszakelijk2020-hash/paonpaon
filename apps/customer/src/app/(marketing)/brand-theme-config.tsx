import React from 'react';
import { useState } from 'react';
import { save_retailer_brand_theme } from '../../../lib/supabase-admin';

const BrandThemeConfig = () => {
  const [theme, setTheme] = useState({
    accentColor: '#1a1a1a',
    surfaceColor: '#f5f3f0',
    inkColor: '#1a1a1a',
    displayFont: 'paon_editorial',
    bodyFont: 'quiet_sans',
    cornerStyle: 'soft',
    logoUrl: '',
    faviconUrl: '',
    heroImageUrl: ''
  });

  const handleChange = (e) => {
    setTheme({...theme, [e.target.name]: e.target.value});
  };

  const handleSubmit = async () => {
    try {
      const response = await save_retailer_brand_theme(
        'current_retailer_id', // Should be passed from parent context
        theme,
        'Updated brand theme'
      );
      alert('Theme saved successfully');
    } catch (error) {
      alert('Error saving theme: ' + error.message);
    }
  };

  return (
    <div className="brand-theme-config">
      <h1>Retailer Brand Theme Configuration</h1>
      <form onSubmit={handleSubmit}>
        <div className="theme-section">
          <label>Accent Color:</label>
          <input
            type="color"
            name="accentColor"
            value={theme.accentColor}
            onChange={handleChange}
          />
        </div>
        <div className="theme-section">
          <label>Surface Color:</label>
          <input
            type="color"
            name="surfaceColor"
            value={theme.surfaceColor}
            onChange={handleChange}
          />
        </div>
        <div className="theme-section">
          <label>Ink Color:</label>
          <input
            type="color"
            name="inkColor"
            value={theme.inkColor}
            onChange={handleChange}
          />
        </div>
        <div className="theme-section">
          <label>Display Font:</label>
          <select
            name="displayFont"
            value={theme.displayFont}
            onChange={handleChange}
          >
            <option value="paon_editorial">PAON Editorial</option>
            <option value="heritage">Heritage</option>
            <option value="modern">Modern</option>
          </select>
        </div>
        <div className="theme-section">
          <label>Body Font:</label>
          <select
            name="bodyFont"
            value={theme.bodyFont}
            onChange={handleChange}
          >
            <option value="quiet_sans">Quiet Sans</option>
            <option value="humanist">Humanist</option>
          </select>
        </div>
        <div className="theme-section">
          <label>Corner Style:</label>
          <select
            name="cornerStyle"
            value={theme.cornerStyle}
            onChange={handleChange}
          >
            <option value="tailored">Tailored</option>
            <option value="soft">Soft</option>
            <option value="architectural">Architectural</option>
          </select>
        </div>
        <div className="media-section">
          <label>Logo URL:</label>
          <input
            type="url"
            name="logoUrl"
            value={theme.logoUrl}
            onChange={handleChange}
          />
        </div>
        <div className="media-section">
          <label>Favicon URL:</label>
          <input
            type="url"
            name="faviconUrl"
            value={theme.faviconUrl}
            onChange={handleChange}
          />
        </div>
        <div className="media-section">
          <label>Hero Image URL:</label>
          <input
            type="url"
            name="heroImageUrl"
            value={theme.heroImageUrl}
            onChange={handleChange}
          />
        </div>
        <button type="submit">Save Theme</button>
      </form>
    </div>
  );
};
export default BrandThemeConfig;
