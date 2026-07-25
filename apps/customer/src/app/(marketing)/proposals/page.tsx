"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Proposal } from '@paon/database/services/proposal-generation-service';
import { generateProposal as generateProposalApi } from '../api/proposals';
import { ProposalCard } from '../components/proposal-card';

export default function ProposalsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProposal = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Extract prospect ID from URL (e.g., /prospects/123/proposals)
        const segments = pathname.split('/');
        const prospectId = segments[segments.length - 2];
        
        if (!prospectId) {
          throw new Error('Prospect ID not found in URL');
        }
        
        // Generate proposal using the API endpoint
        const generatedProposal = await generateProposalApi({
          prospectId: prospectId,
          role: 'sales_manager'
        });
        
        setProposal(generatedProposal);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load proposal');
      } finally {
        setLoading(false);
      }
    };

    fetchProposal();
  }, [pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          <p className="mt-2 text-gray-600">Generating your personalized proposal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl text-red-600 font-semibold">Error</h2>
          <p className="mt-2 text-gray-600">{error}</p>
          <button
            onClick={() => router.push('/marketing')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Back to Marketing
          </button>
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl text-gray-600">No proposal found</h2>
          <p className="mt-2 text-gray-600">Please check the URL or try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Personalized Proposal</h1>
          
          <ProposalCard 
            proposal={proposal} 
            onView={(proposalId: string) => console.log('View clicked', proposalId)}
            onDownload={(proposalId: string) => console.log('Download clicked', proposalId)}
          />
        </div>
      </div>
    </div>
  );
}