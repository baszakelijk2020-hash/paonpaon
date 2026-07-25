"use client";

import type { Proposal } from '@paon/database/services/proposal-generation-service';

interface ProposalCardProps {
  proposal: Proposal;
  onView?: (proposalId: string) => void;
  onDownload?: (proposalId: string) => void;
}

export function ProposalCard({ proposal, onView, onDownload }: ProposalCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (stage: string) => {
    switch (stage) {
      case 'demo_ready':
        return 'bg-green-100 text-green-800';
      case 'proposal':
        return 'bg-blue-100 text-blue-800';
      case 'pilot':
        return 'bg-purple-100 text-purple-800';
      case 'converted':
        return 'bg-emerald-100 text-emerald-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {proposal.prospect.companyName}
          </h3>
          <p className="text-sm text-gray-600">
            Contact: {proposal.prospect.primaryContactName}
          </p>
        </div>
        <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(proposal.prospect.stage)}`}>          {proposal.prospect.stage}
        </span>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex items-center text-sm text-gray-600">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4 0h1m-5-4h.01M9 11h.01M12 16h.01M16 16h.01M9 16h.01M7 14a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
          {proposal.prospect.companyName}
        </div>
        
        <div className="flex items-center text-sm text-gray-600">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          {proposal.prospect.primaryContactEmail}
        </div>

        <div className="flex items-center text-sm text-gray-600">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Generated: {formatDate(proposal.generatedAt)}
        </div>

        <div className="flex items-center text-sm text-gray-600">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
          </svg>
          {proposal.pricingSummary.planName} - {proposal.pricingSummary.monthlyPrice}/month
        </div>
      </div>

      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Cover Letter Summary:</h4>
        <p className="text-sm text-gray-600 line-clamp-2">
          {proposal.coverLetter.substring(0, 150)}...
        </p>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-xs text-gray-500">
          {proposal.syntheticData.personas.length} personas • {proposal.syntheticData.customers.length} customers
        </div>
        <div className="flex space-x-2">
          {onView && (
            <button
              onClick={() => onView(proposal.id)}
              className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
            >
              View Details
            </button>
          )}
          {onDownload && (
            <button
              onClick={() => onDownload(proposal.id)}
              className="px-3 py-1 text-sm bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors"
            >
              Download PDF
            </button>
          )}
        </div>
      </div>
    </div>
  );
}