import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Cookie, Settings, Check } from 'lucide-react';

interface CookieConsentBannerProps {
  onAccept: (preferences: CookiePreferences) => void;
  onReject: () => void;
}

export interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
}

const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({ onAccept, onReject }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true, // Always true, cannot be disabled
    analytics: false,
    marketing: false,
    functional: false,
  });

  const handlePreferenceChange = (cookieType: keyof CookiePreferences) => {
    if (cookieType === 'necessary') return; // Cannot disable necessary cookies
    setPreferences(prev => ({
      ...prev,
      [cookieType]: !prev[cookieType]
    }));
  };

  const handleAcceptAll = () => {
    const allPreferences: CookiePreferences = {
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true,
    };
    onAccept(allPreferences);
  };

  const handleAcceptNecessary = () => {
    const necessaryOnly: CookiePreferences = {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false,
    };
    onAccept(necessaryOnly);
  };

  const handleSavePreferences = () => {
    onAccept(preferences);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-white/10 p-4"
      >
        <div className="max-w-6xl mx-auto">
          {!showDetails ? (
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Cookie className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold mb-1">Cookie Preferences</h3>
                  <p className="text-white/70 text-sm">
                    We use cookies to enhance your experience and analyze our traffic.
                    By continuing to use our site, you consent to our use of cookies.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <button
                  onClick={() => setShowDetails(true)}
                  className="secondary-button text-sm px-4 py-2 order-3 sm:order-1"
                >
                  <Settings className="w-4 h-4 mr-1" />
                  Customize
                </button>
                <button
                  onClick={onReject}
                  className="secondary-button text-sm px-4 py-2 order-2"
                >
                  Reject All
                </button>
                <button
                  onClick={handleAcceptAll}
                  className="primary-button text-sm px-4 py-2 order-1 sm:order-3"
                >
                  Accept All
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold text-lg">Cookie Settings</h3>
                <button
                  onClick={() => setShowDetails(false)}
                  className="glass-button p-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {/* Necessary Cookies */}
                <div className="glass-card p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="text-white font-medium mb-1">Necessary Cookies</h4>
                      <p className="text-white/70 text-sm">
                        These cookies are essential for the website to function and cannot be switched off.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-400" />
                      <span className="text-green-400 text-sm">Always Active</span>
                    </div>
                  </div>
                  <p className="text-white/60 text-xs">
                    Includes authentication, security, and basic functionality cookies.
                  </p>
                </div>

                {/* Analytics Cookies */}
                <div className="glass-card p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-white font-medium mb-1">Analytics Cookies</h4>
                      <p className="text-white/70 text-sm">
                        Help us understand how visitors interact with our website by collecting anonymous usage data.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        checked={preferences.analytics}
                        onChange={() => handlePreferenceChange('analytics')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-white/20 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/25 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                    </label>
                  </div>
                  <p className="text-white/60 text-xs">
                    Google Analytics, usage statistics, and performance monitoring.
                  </p>
                </div>

                {/* Functional Cookies */}
                <div className="glass-card p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-white font-medium mb-1">Functional Cookies</h4>
                      <p className="text-white/70 text-sm">
                        Enable enhanced functionality and personalization features.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        checked={preferences.functional}
                        onChange={() => handlePreferenceChange('functional')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-white/20 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/25 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                    </label>
                  </div>
                  <p className="text-white/60 text-xs">
                    Remember your preferences, theme settings, and language choices.
                  </p>
                </div>

                {/* Marketing Cookies */}
                <div className="glass-card p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-white font-medium mb-1">Marketing Cookies</h4>
                      <p className="text-white/70 text-sm">
                        Used to deliver personalized advertisements and marketing campaigns.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        checked={preferences.marketing}
                        onChange={() => handlePreferenceChange('marketing')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-white/20 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/25 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                    </label>
                  </div>
                  <p className="text-white/60 text-xs">
                    Targeted advertising, retargeting, and campaign tracking.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-white/10">
                <button
                  onClick={handleAcceptNecessary}
                  className="secondary-button text-sm px-4 py-2"
                >
                  Accept Necessary Only
                </button>
                <button
                  onClick={handleSavePreferences}
                  className="primary-button text-sm px-4 py-2"
                >
                  Save Preferences
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CookieConsentBanner;
