'use client';

import { useState } from 'react';
import { ChevronRight, Zap, Shield, Globe, Menu, X, Play, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const runExecutorTest = async () => {
    setIsTestRunning(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/test-executor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: 'Failed to call API: ' + (error as Error).message
      });
    } finally {
      setIsTestRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Navigation */}
      <nav className="relative z-50 bg-black/20 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="text-2xl font-bold text-white">
                🥁 <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Drums</span>
              </div>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-300 hover:text-white transition-colors">Features</a>
              <a href="#about" className="text-gray-300 hover:text-white transition-colors">About</a>
              <a href="#contact" className="text-gray-300 hover:text-white transition-colors">Contact</a>
              <button className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-full hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-105">
                Get Started
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-gray-300 hover:text-white p-2"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden bg-black/40 backdrop-blur-md border-t border-white/10">
            <div className="px-4 py-4 space-y-3">
              <a href="#features" className="block text-gray-300 hover:text-white transition-colors">Features</a>
              <a href="#about" className="block text-gray-300 hover:text-white transition-colors">About</a>
              <a href="#contact" className="block text-gray-300 hover:text-white transition-colors">Contact</a>
              <button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-full hover:from-purple-600 hover:to-pink-600 transition-all">
                Get Started
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <main className="relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              Build the{' '}
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 bg-clip-text text-transparent">
                Future
              </span>
              <br />
              with Modern Web Apps
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Experience the power of Next.js with TypeScript. Create lightning-fast, 
              scalable applications with beautiful UIs and exceptional developer experience.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <button className="group bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-4 rounded-full text-lg font-semibold hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-105 flex items-center justify-center">
                Start Building
                <ChevronRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
              </button>
              <button className="border border-white/20 text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-white/10 transition-all">
                View Demo
              </button>
            </div>
          </div>

          {/* Features Grid */}
          <div id="features" className="grid md:grid-cols-3 gap-8 mt-20">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-all">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mb-4">
                <Zap className="text-white" size={24} />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Lightning Fast</h3>
              <p className="text-gray-400">
                Built with Next.js 14 and optimized for performance with automatic code splitting and image optimization.
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-all">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center mb-4">
                <Shield className="text-white" size={24} />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Type Safe</h3>
              <p className="text-gray-400">
                Full TypeScript support with strict type checking for better code quality and developer experience.
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-all">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center mb-4">
                <Globe className="text-white" size={24} />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Global Ready</h3>
              <p className="text-gray-400">
                Deploy globally with Vercel's edge network and built-in internationalization support.
              </p>
            </div>
          </div>

          {/* Executor Test Section */}
          <div className="mt-32 mb-20">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-white mb-4">
                🤖 Test Browser Automation
              </h2>
              <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                Try our executor module with real browser automation. This will open a browser, 
                navigate to websites, extract data, and capture screenshots.
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 max-w-4xl mx-auto">
              <div className="text-center mb-8">
                <button
                  onClick={runExecutorTest}
                  disabled={isTestRunning}
                  className={`group relative overflow-hidden bg-gradient-to-r from-green-500 to-emerald-500 text-white px-12 py-6 rounded-full text-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mx-auto ${
                    isTestRunning ? 'animate-pulse' : 'hover:from-green-600 hover:to-emerald-600'
                  }`}
                >
                  {isTestRunning ? (
                    <>
                      <Clock className="mr-3 animate-spin" size={24} />
                      Running Browser Test...
                    </>
                  ) : (
                    <>
                      <Play className="mr-3 group-hover:translate-x-1 transition-transform" size={24} />
                      Start Executor Test
                    </>
                  )}
                </button>
                
                {isTestRunning && (
                  <p className="text-gray-400 mt-4">
                    ⏳ This will take 10-15 seconds to complete. A browser window will open briefly.
                  </p>
                )}
              </div>

              {/* Test Results */}
              {testResult && (
                <div className="mt-8 border-t border-white/10 pt-8">
                  <div className="flex items-center justify-center mb-6">
                    {testResult.success ? (
                      <div className="flex items-center text-green-400 text-xl font-semibold">
                        <CheckCircle className="mr-2" size={28} />
                        Test Completed Successfully!
                      </div>
                    ) : (
                      <div className="flex items-center text-red-400 text-xl font-semibold">
                        <XCircle className="mr-2" size={28} />
                        Test Failed
                      </div>
                    )}
                  </div>

                  {testResult.success ? (
                    <div className="space-y-4">
                      <div className="bg-black/20 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-white mb-3">📊 Test Summary</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-400">
                              {testResult.results?.steps?.length || 0}
                            </div>
                            <div className="text-gray-400">Steps Completed</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-400">
                              {testResult.results?.screenshots?.length || 0}
                            </div>
                            <div className="text-gray-400">Screenshots</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-400">
                              {testResult.results?.totalDuration || 0}ms
                            </div>
                            <div className="text-gray-400">Total Duration</div>
                          </div>
                        </div>
                      </div>

                      {testResult.results?.steps && (
                        <div className="bg-black/20 rounded-lg p-4">
                          <h4 className="text-lg font-semibold text-white mb-3">🔄 Execution Steps</h4>
                          <div className="space-y-2">
                            {testResult.results.steps.map((step: any, index: number) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-white/5 rounded">
                                <div className="flex items-center">
                                  <span className="w-6 h-6 bg-purple-500 text-white text-xs rounded-full flex items-center justify-center mr-3">
                                    {step.step}
                                  </span>
                                  <div>
                                    <div className="text-white font-medium">{step.action}</div>
                                    <div className="text-gray-400 text-sm">{step.description}</div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-green-400 text-sm">✓ {step.duration}ms</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {testResult.results?.variables && Object.keys(testResult.results.variables).length > 0 && (
                        <div className="bg-black/20 rounded-lg p-4">
                          <h4 className="text-lg font-semibold text-white mb-3">📝 Variables</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {Object.entries(testResult.results.variables).map(([key, value]: [string, any]) => (
                              <div key={key} className="p-2 bg-white/5 rounded text-sm">
                                <span className="text-purple-400 font-mono">{key}:</span>
                                <span className="text-gray-300 ml-2">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-4">
                      <h4 className="text-lg font-semibold text-red-400 mb-2">❌ Error Details</h4>
                      <p className="text-gray-300 font-mono text-sm">{testResult.error}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Background Elements */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-pink-500/20 rounded-full blur-3xl"></div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/20 backdrop-blur-md mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-400">
            <p>&copy; 2024 Drums App. Built with Next.js, TypeScript, and Tailwind CSS.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
