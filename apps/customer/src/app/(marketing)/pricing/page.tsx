import React from 'react';

const PricingPage = () => {
  return (
    <div className="pricing-page"
      style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '2rem',
        boxSizing: 'border-box'
      }}>
      <h1>PAON Pricing Plans</h1>
      <section className="plan-comparison"
        style={{ 
          display: 'flex',
          flexWrap: 'wrap',
          gap: '2rem',
          margin: '2rem 0',
          justifyContent: 'center'
        }}>
        <div className="plan"
          style={{ 
            flex: 1,
            minWidth: '300px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            padding: '1.5rem',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: '#f9f9f9'
          }}>
          <h2>PAON Fused</h2>
          <p>Professional digital customer foundation</p>
          <ul style={{ 
            listStyle: 'none',
            padding: 0,
            margin: '1rem 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <li style={{ 
              margin: '0.5rem 0',
              fontSize: '1rem',
              color: '#333'
            }}>
              €349/month
            </li>
            <li style={{ 
              margin: '0.5rem 0',
              fontSize: '1rem',
              color: '#333'
            }}>
              €1,500 implementation fee
            </li>
            <li style={{ 
              margin: '0.5rem 0',
              fontSize: '1rem',
              color: '#333'
            }}>
              Core capabilities: Branded website, CRM, Catalogue, Appointments
            </li>
          </ul>
        </div>
        <div className="plan"
          style={{ 
            flex: 1,
            minWidth: '300px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            padding: '1.5rem',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: '#f9f9f9'
          }}>
          <h2>PAON Half Canvas</h2>
          <p>Customer growth and retention platform</p>
          <ul style={{ 
            listStyle: 'none',
            padding: 0,
            margin: '1rem 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <li style={{ 
              margin: '0.5rem 0',
              fontSize: '1rem',
              color: '#333'
            }}>
              €749/month
            </li>
            <li style={{ 
              margin: '0.5rem 0',
              fontSize: '1rem',
              color: '#333'
            }}>
              €3,500 implementation fee
            </li>
            <li style={{ 
              margin: '0.5rem 0',
              fontSize: '1rem',
              color: '#333'
            }}>
              Advanced capabilities: Ecommerce, Loyalty, Referrals, Events
            </li>
          </ul>
        </div>
        <div className="plan"
          style={{ 
            flex: 1,
            minWidth: '300px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            padding: '1.5rem',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: '#f9f9f9'
          }}>
          <h2>PAON Full Canvas</h2>
          <p>Complete managed growth platform</p>
          <ul style={{ 
            listStyle: 'none',
            padding: 0,
            margin: '1rem 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <li style={{ 
              margin: '0.5rem 0',
              fontSize: '1rem',
              color: '#333'
            }}>
              From €1,750/month
            </li>
            <li style={{ 
              margin: '0.5rem 0',
              fontSize: '1rem',
              color: '#333'
            }}>
              From €7,500 implementation fee
            </li>
            <li style={{ 
              margin: '0.5rem 0',
              fontSize: '1rem',
              color: '#333'
            }}>
              Bespoke implementation, AI personalization, Campaign support
            </li>
          </ul>
        </div>
      </section>
      <section className="cta-section"
        style={{ 
          margin: '2rem 0',
          textAlign: 'center',
          padding: '0 1rem'
        }}>
        <h2>Choose Your Plan</h2>
        <button
          style={{ 
            padding: '0.5rem 2rem',
            background: '#007bff',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '4px',
            fontSize: '1rem',
            marginTop: '1rem'
          }}
          onClick={() => window.location.href = '/demo-request'}
        >
          Request Consultation
        </button>
      </section>
    </div>
  );
};

export default PricingPage;
