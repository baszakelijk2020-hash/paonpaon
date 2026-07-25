'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('orders');

  const tabs = [
    { id: 'orders', label: 'Orders' },
    { id: 'wishlist', label: 'Wishlist' },
    { id: 'profile', label: 'Profile' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex">
        {/* Sidebar Navigation */}
        <nav className="w-64 bg-white border-r py-6">
          <ul className="space-y-2">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <Link
                  href={`/#${tab.id}`}
                  className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 p-6">
          <div className="min-h-[60vh] bg-white rounded-lg p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Customer Dashboard</h1>
            
            <div className="space-y-4">
              <p className="text-gray-500">Welcome to your customer dashboard.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="rounded-lg bg-gray-50 p-4">
                  <h2 className="text-sm font-medium text-gray-700">Orders</h2>
                  <p className="text-gray-400">3 pending orders</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <h2 className="text-sm font-medium text-gray-700">Wishlist</h2>
                  <p className="text-gray-400">5 items saved</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <h2 className="text-sm font-medium text-gray-700">Profile</h2>
                  <p className="text-gray-400">John Doe</p>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t text-sm text-gray-500">
                © {new Date().getFullYear()} PAON. All rights reserved.
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}