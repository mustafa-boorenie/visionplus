'use client';

import { useState } from 'react';
import { User, CreditCard, Mail, Phone, MapPin, Shield, Bell, Save } from 'lucide-react';

interface ProfileSettingsProps {
  // In a real app, this would come from auth context or API
  user?: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    plan?: 'free' | 'pro' | 'enterprise';
  };
}

export function ProfileSettings({ user }: ProfileSettingsProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'billing' | 'notifications' | 'security'>('profile');
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });
  
  const [billingData, setBillingData] = useState({
    cardNumber: '**** **** **** 4242',
    cardHolder: user?.name || '',
    expiryDate: '12/25',
    plan: user?.plan || 'free',
  });
  
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    smsAlerts: false,
    sequenceComplete: true,
    errorAlerts: true,
    weeklyReport: true,
  });

  const handleProfileSave = () => {
    // In a real app, this would call an API
    alert('Profile updated successfully!');
  };

  const handleBillingSave = () => {
    // In a real app, this would call an API
    alert('Billing information updated successfully!');
  };

  const handleNotificationsSave = () => {
    // In a real app, this would call an API
    alert('Notification preferences updated successfully!');
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Profile
            </div>
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'billing'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Billing
            </div>
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'notifications'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notifications
            </div>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'security'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Security
            </div>
          </button>
        </nav>
      </div>

      <div className="p-6">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profile Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <User className="w-4 h-4 inline mr-1" />
                  Full Name
                </label>
                <input
                  type="text"
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Address
                </label>
                <input
                  type="text"
                  value={profileData.address}
                  onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                  placeholder="123 Main St, City, State 12345"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <button
              onClick={handleProfileSave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Billing Information</h3>
            
            {/* Current Plan */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-6">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Current Plan</h4>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white capitalize">{billingData.plan} Plan</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    {billingData.plan === 'free' && 'Basic features, 100 commands/month'}
                    {billingData.plan === 'pro' && 'Advanced features, 10,000 commands/month'}
                    {billingData.plan === 'enterprise' && 'Unlimited features and commands'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {billingData.plan === 'free' && '$0'}
                    {billingData.plan === 'pro' && '$49'}
                    {billingData.plan === 'enterprise' && '$299'}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">per month</p>
                </div>
              </div>
              <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                {billingData.plan === 'free' ? 'Upgrade Plan' : 'Change Plan'}
              </button>
            </div>

            {/* Payment Method */}
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Payment Method</h4>
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-8 h-8 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{billingData.cardNumber}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Expires {billingData.expiryDate}</p>
                    </div>
                  </div>
                  <button className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                    Update
                  </button>
                </div>
              </div>
            </div>

            {/* Billing History */}
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Billing History</h4>
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Date</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Description</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Amount</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                    <tr>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">Jan 1, 2025</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">Pro Plan - Monthly</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">$49.00</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Paid
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">Dec 1, 2024</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">Pro Plan - Monthly</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">$49.00</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Paid
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notification Preferences</h3>
            
            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Email Alerts</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Receive email notifications for important events</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.emailAlerts}
                  onChange={(e) => setNotifications({ ...notifications, emailAlerts: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>
              
              <label className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">SMS Alerts</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Get text messages for critical alerts</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.smsAlerts}
                  onChange={(e) => setNotifications({ ...notifications, smsAlerts: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>
              
              <label className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Sequence Complete</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Notify when automation sequences finish</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.sequenceComplete}
                  onChange={(e) => setNotifications({ ...notifications, sequenceComplete: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>
              
              <label className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Error Alerts</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Get notified when errors occur</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.errorAlerts}
                  onChange={(e) => setNotifications({ ...notifications, errorAlerts: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>
              
              <label className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Weekly Report</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Receive weekly usage and performance reports</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.weeklyReport}
                  onChange={(e) => setNotifications({ ...notifications, weeklyReport: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>
            </div>
            
            <button
              onClick={handleNotificationsSave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Save className="w-4 h-4" />
              Save Preferences
            </button>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Security Settings</h3>
            
            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">Change Password</h4>
                <div className="space-y-4 max-w-md">
                  <input
                    type="password"
                    placeholder="Current Password"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="password"
                    placeholder="New Password"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="password"
                    placeholder="Confirm New Password"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Update Password
                  </button>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">Two-Factor Authentication</h4>
                <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-900 dark:text-white">Two-factor authentication is currently <span className="font-semibold text-red-600">disabled</span></p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Add an extra layer of security to your account</p>
                    </div>
                    <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                      Enable 2FA
                    </button>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">Active Sessions</h4>
                <div className="space-y-3">
                  <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Current Session</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Chrome on macOS • 192.168.1.1</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Active now</p>
                      </div>
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Active
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 