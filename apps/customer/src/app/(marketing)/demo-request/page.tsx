import React from 'react';
import RoleDevicePreview from '../components/role-device-preview';

const DemoRequestPage = () => {
  return (
    <div className="demo-request-page"
      style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '2rem',
        boxSizing: 'border-box'
      }}>
      <h1>Request a Personalized Retailer Demo</h1>
      <p>Let us create a tailored demonstration of PAON for your business.</p>
      <div className="preview-section"
        style={{ 
          margin: '2rem 0',
          textAlign: 'center'
        }}>
        <RoleDevicePreview />
      </div>
      <form style={{ 
        maxWidth: '600px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        alignItems: 'center'
      }}>
        <div className="form-group"
          style={{ 
            marginBottom: '1rem'
          }}>
          <label
            htmlFor="retailerName"
            style={{ 
              fontWeight: 'bold',
              marginBottom: '0.5rem'
            }}
          >Retailer Name:</label>
          <input
            type="text"
            id="retailerName"
            name="retailerName"
            required
            style={{ 
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              width: '100%'
            }}
          />
        </div>
        <div className="form-group"
          style={{ 
            marginBottom: '1rem'
          }}>
          <label
            htmlFor="businessDescription"
            style={{ 
              fontWeight: 'bold',
              marginBottom: '0.5rem'
            }}
          >Business Description:</label>
          <textarea
            id="businessDescription"
            name="businessDescription"
            rows={4}
            required
            style={{ 
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              width: '100%'
            }}
          />
        </div>
        <div className="form-group"
          style={{ 
            marginBottom: '1.5rem'
          }}>
          <label
            htmlFor="preferredPlan"
            style={{ 
              fontWeight: 'bold',
              marginBottom: '0.5rem'
            }}
          >Preferred Plan:</label>
          <select
            id="preferredPlan"
            name="preferredPlan"
            style={{ 
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          >
            <option value="fused" style="margin-bottom: 0.5rem">PAON Fused</option>
            <option value="half-canvas" style="margin-bottom: 0.5rem">PAON Half Canvas</option>
            <option value="full-canvas" style="margin-bottom: 0.5rem">PAON Full Canvas</option>
          </select>
        </div>
        <button
          type="submit"
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
          onClick={() => window.location.href = '/commercial'}
        >
          Get Your Demo
        </button>
      </form>
      <div className="next-steps"
        style={{ 
          margin: '2rem 0',
          textAlign: 'center'
        }}>
        <p>After submitting, you'll receive a secure link to your personalized demo within 1 hour.</p>
        <a href="/commercial" style="margin-right: 1rem; text-decoration: none; color: #007bff">View Commercial Plans</a>
        <a href="/pricing" style="text-decoration: none; color: #007bff">See Pricing Details</a>
      </div>
    </div>
  );
};

export default DemoRequestPage;
