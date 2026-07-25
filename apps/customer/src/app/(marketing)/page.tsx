import React from 'react';

const MarketingPage = () => {
  return (
    <div className="marketing-page"
      style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <h1>PAON Commercial Solutions</h1>
      <nav className="marketing-nav"
        style={{ display: 'flex', justifyContent: 'space-between', margin: '1rem 0' }}>
        <a href="/commercial" style={{ marginRight: '1rem' }}>Commercial Plans</a>
        <a href="/pricing" style={{ marginRight: '1rem' }}>Pricing</a>
        <a href="/demo-request" style={{ marginRight: '1rem' }}>Request Demo</a>
      </nav>
      <div className="hero-section"
        style={{ textAlign: 'center', margin: '2rem 0' }}>
        <h2>Transform Your Retail Experience</h2>
        <p>Create compelling retailer demonstrations in under an hour with PAON's unified platform.</p>
        <button style={{
          padding: '0.5rem 1rem',
          background: '#007bff',
          color: 'white',
          border: 'none',
          cursor: 'pointer'
        }}
          onClick={() => window.location.href = '/demo-request'}>
          Start Your Free Demo
        </button>
      </div>
    </div>
  );
};

export default MarketingPage;
