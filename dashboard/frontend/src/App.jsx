import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ScoreCard from './components/ScoreCard';
import SeverityDistribution from './components/SeverityDistribution';
import ScannerStatus from './components/ScannerStatus';
import FindingsTable from './components/FindingsTable';
import FindingModal from './components/FindingModal';
import ScanHistory from './components/ScanHistory';
import CodeAnalyzer from './components/CodeAnalyzer';
import {
  fetchHealth,
  fetchDashboardSummary,
  fetchSeverityDistribution,
  fetchScannerStatus,
  fetchFindings,
  fetchScans,
} from './api';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialTab = urlParams?.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [backendConnected, setBackendConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data states
  const [summary, setSummary] = useState(null);
  const [distribution, setDistribution] = useState(null);
  const [scanners, setScanners] = useState({});
  const [scans, setScans] = useState([]);
  
  // Findings state
  const [findings, setFindings] = useState([]);
  const [recentFindings, setRecentFindings] = useState([]);
  const [findingsTotal, setFindingsTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Filters state
  const [filters, setFilters] = useState({
    search: '',
    severity: '',
    scanner: '',
    priority: '',
    scanId: null,
  });

  // Modal state
  const [selectedFinding, setSelectedFinding] = useState(null);

  // Load all overview metrics
  const loadDashboardData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);

      // Verify health check
      const health = await fetchHealth();
      setBackendConnected(health.status === 'ok');

      // Fetch parallel summary data
      const [sumData, distData, scData, scansData] = await Promise.all([
        fetchDashboardSummary(),
        fetchSeverityDistribution(),
        fetchScannerStatus(),
        fetchScans(0, 50),
      ]);

      setSummary(sumData);
      setDistribution(distData);
      setScanners(scData.scanners || {});
      setScans(scansData.scans || []);

      const latestId = sumData?.latest_scan?.id;
      if (latestId) {
        const recent = await fetchFindings({ skip: 0, limit: 5, scanId: latestId });
        setRecentFindings(recent.findings || []);
      } else {
        setRecentFindings([]);
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
      setBackendConnected(false);
      setError('Cannot connect to FastAPI backend at http://127.0.0.1:8000. Ensure uvicorn is running.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Load findings table with filters and pagination
  const loadFindingsData = useCallback(async () => {
    try {
      const skip = (page - 1) * pageSize;
      const data = await fetchFindings({
        skip,
        limit: pageSize,
        scanId: filters.scanId,
        severity: filters.severity || null,
        scanner: filters.scanner || null,
        search: filters.search || null,
        priority: filters.priority || null,
      });
      setFindings(data.findings || []);
      setFindingsTotal(data.total || 0);
      if (urlParams?.get('modal') && data.findings?.length > 0) {
        setSelectedFinding(data.findings[0]);
      }
    } catch (err) {
      console.error('Failed to fetch findings:', err);
    }
  }, [page, filters]);

  // Initial mount
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Automatic periodic refresh every 10 seconds (silent background poll)
  useEffect(() => {
    const intervalId = setInterval(() => {
      loadDashboardData(true);
      loadFindingsData();
    }, 10000);

    return () => clearInterval(intervalId);
  }, [loadDashboardData, loadFindingsData]);

  // When filters or page changes, re-fetch findings
  useEffect(() => {
    loadFindingsData();
  }, [loadFindingsData]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleSelectScanForFilter = (scanId) => {
    setFilters((prev) => ({ ...prev, scanId }));
    setPage(1);
    setActiveTab('vulnerabilities');
  };

  const clearScanFilter = () => {
    setFilters((prev) => ({ ...prev, scanId: null }));
    setPage(1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0f1d] text-slate-100">
      {/* Top Navigation */}
      <Header
        backendConnected={backendConnected}
        onRefresh={() => {
          loadDashboardData();
          loadFindingsData();
        }}
        loading={loading}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          counts={{
            totalFindings: summary?.total_findings || 0,
            totalScans: summary?.total_scans || 0,
          }}
        />

        {/* Content Area */}
        <main className="flex-1 p-5 md:p-8 overflow-y-auto space-y-6 max-w-7xl">
          {/* Error Banner */}
          {error && (
            <div className="bg-rose-950/80 border border-rose-500/50 rounded-xl p-4 flex items-center justify-between text-rose-300 text-xs font-medium">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={loadDashboardData}
                className="bg-rose-900/60 hover:bg-rose-800 px-3 py-1.5 rounded-lg border border-rose-700 font-semibold transition"
              >
                Retry
              </button>
            </div>
          )}

          {/* Active scan filter badge */}
          {filters.scanId && (
            <div className="bg-sky-950/40 border border-sky-500/40 rounded-lg px-4 py-2 flex items-center justify-between text-xs text-sky-300">
              <span>Filtering findings to specific Scan <strong>#{filters.scanId}</strong></span>
              <button
                onClick={clearScanFilter}
                className="underline hover:text-white font-medium"
              >
                Clear Scan Filter
              </button>
            </div>
          )}

          {/* Tab 1: Overview Dashboard */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <ScoreCard summary={summary} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SeverityDistribution distribution={distribution} />
                <ScannerStatus scanners={scanners} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Latest Scan Findings</h3>
                    <p className="text-xs text-slate-400">Prioritized findings from the most recent pipeline run</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('vulnerabilities')}
                    className="text-xs text-sky-400 hover:underline font-semibold"
                  >
                    View All &rarr;
                  </button>
                </div>
                <FindingsTable
                  findings={recentFindings}
                  total={recentFindings.length}
                  page={1}
                  pageSize={5}
                  onPageChange={() => setActiveTab('vulnerabilities')}
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  onSelectFinding={setSelectedFinding}
                  showFilters={false}
                />
              </div>
            </div>
          )}

          {/* Tab 2: Full Vulnerabilities Table */}
          {activeTab === 'vulnerabilities' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Security Findings Explorer</h2>
                <p className="text-xs text-slate-400">Filter, search, and inspect vulnerability remediation details</p>
              </div>
              <FindingsTable
                findings={findings}
                total={findingsTotal}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                filters={filters}
                onFilterChange={handleFilterChange}
                onSelectFinding={setSelectedFinding}
              />
            </div>
          )}

          {/* Tab 3: Scanner Status */}
          {activeTab === 'scanners' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Scanner Infrastructure</h2>
                <p className="text-xs text-slate-400">Execution diagnostics across the 5 integrated open-source scanners</p>
              </div>
              <ScannerStatus scanners={scanners} />
            </div>
          )}

          {/* Tab 4: Scan History */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">CI/CD Pipeline Scan History</h2>
                <p className="text-xs text-slate-400">Historical record of automated security pipeline runs</p>
              </div>
              <ScanHistory
                scans={scans}
                onSelectScan={handleSelectScanForFilter}
              />
            </div>
          )}

          {/* Tab 5: Code Analyzer */}
          {activeTab === 'analyzer' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Code Analyzer & AI Recommendations</h2>
                <p className="text-xs text-slate-400">Submit code for security analysis, vulnerability detection, and improvement suggestions</p>
              </div>
              <CodeAnalyzer />
            </div>
          )}
        </main>
      </div>

      {/* Vulnerability Detail Modal */}
      {selectedFinding && (
        <FindingModal
          finding={selectedFinding}
          onClose={() => setSelectedFinding(null)}
        />
      )}
    </div>
  );
}
