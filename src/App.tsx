import { useState, useEffect } from 'react';
import { ReportGenerator } from './components/ReportGenerator';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from './components/ui/alert';

interface ApiResponse {
  data: any[];
  [key: string]: any;
}

// Fetch with timeout support
const fetchWithTimeout = async (url: string, timeoutMs: number = 15000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
};

// Retry logic with exponential backoff
const fetchWithRetry = async (
  fetchFn: () => Promise<any>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<any> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.log(`Attempt ${attempt + 1} failed:`, lastError.message);
      
      // Don't retry on the last attempt
      if (attempt < maxRetries - 1) {
        const delay = initialDelayMs * Math.pow(2, attempt);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

export default function App() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(null);

  const loadingMessages = [
    "Politely asking the data to hurry up… it's being very polite back.",
    "Convincing the system it's had enough coffee.",
    "Tidying up behind the scenes—just a quick straighten.",
    "Almost there… the ducks are lining up nicely.",
    "Taking measurements… twice, just to be sure.",
    "Tightening a few virtual screws…",
    "Rolling out fresh digital carpet—watch your step!",
    "Checking the punch list for loose pixels…",
    "Doing a little walk-through—everything's looking good.",
    "Asking the data to pick up the pace before lunch.",
    "Polishing the fixtures… they're glowing now.",
    "Straightening the picture frames—symmetry matters.",
    "Reviewing the renovation plan with a tiny hard hat on.",
    "Unpacking the moving boxes… we labeled them this time.",
    "Sweeping out the corners—data dust gets everywhere.",
    "Calling in a friendly maintenance cart for assistance…",
    "Hunting down one last missing measurement tape.",
    "Knocking on the unit door… just making sure someone's home.",
    "Warming up the tools and checking batteries—almost ready.",
    "Setting out a welcome mat for your results."
  ];

  // Rotate loading messages
  useEffect(() => {
    if (!loading) return;
    
    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 3000); // Change message every 3 seconds

    return () => clearInterval(interval);
  }, [loading, loadingMessages.length]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setLoadingMessageIndex(0); // Reset to first message
    setUsingCachedData(false);
    
    try {
      const targetUrl = 'http://metabase.app.equips.com/public/question/70a65d26-283f-44db-96b3-e1d1b657401b.json';
      
      let proxyData = null;
      let lastError: Error | null = null;
      let successfulProxy = '';
      
      // Define proxy strategies - ordered by reliability
      const proxyStrategies = [
        {
          name: 'allorigins (raw mode)',
          fetch: async () => {
            const response = await fetchWithTimeout(
              `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
              20000
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
          }
        },
        {
          name: 'allorigins (json mode)',
          fetch: async () => {
            const response = await fetchWithTimeout(
              `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
              20000
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            return JSON.parse(data.contents);
          }
        },
        {
          name: 'corsproxy.io',
          fetch: async () => {
            const response = await fetchWithTimeout(
              `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
              20000
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
          }
        },
        {
          name: 'cors.eu.org',
          fetch: async () => {
            const response = await fetchWithTimeout(
              `https://cors.eu.org/?${encodeURIComponent(targetUrl)}`,
              20000
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
          }
        },
        {
          name: 'thingproxy',
          fetch: async () => {
            const response = await fetchWithTimeout(
              `https://thingproxy.freeboard.io/fetch/${targetUrl}`,
              20000
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
          }
        }
      ];
      
      // Try each proxy strategy
      for (const strategy of proxyStrategies) {
        try {
          console.log(`Trying ${strategy.name}...`);
          proxyData = await strategy.fetch();
          successfulProxy = strategy.name;
          console.log(`✓ ${strategy.name} succeeded!`);
          break;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error('Unknown error');
          console.log(`✗ ${strategy.name} failed:`, lastError.message);
        }
      }
      
      if (!proxyData) {
        // All proxies failed - try to load from cache
        console.log('All proxies failed, checking cache...');
        const cachedData = localStorage.getItem('makeready_data_cache');
        const cachedTime = localStorage.getItem('makeready_data_cache_time');
        
        if (cachedData && cachedTime) {
          console.log('Loading from cache');
          const parsedData = JSON.parse(cachedData);
          setData(parsedData);
          setUsingCachedData(true);
          setCacheTimestamp(cachedTime);
          setError(
            `Unable to reach the API - showing cached data from ${new Date(cachedTime).toLocaleString()}.\n\n` +
            `Network issue: ${lastError?.message || 'All proxy services failed'}\n\n` +
            `The cached data may be outdated. Click "Try Again" to retry loading fresh data.`
          );
          setLoading(false);
          return;
        }
        
        throw new Error(
          `Unable to load data from the API.\\n\\n` +
          `All proxy services failed. Last error: ${lastError?.message || 'Unknown error'}\\n\\n` +
          `This could mean:\\n` +
          `• The API server is temporarily down\\n` +
          `• Proxy services are experiencing issues\\n` +
          `• Network connectivity problems\\n\\n` +
          `No cached data is available. Please try again in a moment.`
        );
      }
      
      console.log(`Successfully loaded data via ${successfulProxy}`);
      console.log('Raw fetched data:', proxyData);
      
      // Transform the data to match our expected format
      let transformedData;
      if (Array.isArray(proxyData)) {
        // If it's an array, assume it's the data array
        transformedData = { data: proxyData };
      } else if (proxyData.data && Array.isArray(proxyData.data)) {
        // If it has a data property that's an array, use it
        transformedData = proxyData;
      } else if (proxyData.rows && Array.isArray(proxyData.rows)) {
        // Metabase often returns data in a "rows" array
        transformedData = { data: proxyData.rows, columns: proxyData.cols };
      } else {
        // Otherwise, wrap it in our expected format
        transformedData = { data: [proxyData] };
      }
      
      console.log('Transformed data:', transformedData);
      
      // Cache the successful data
      try {
        const now = new Date().toISOString();
        localStorage.setItem('makeready_data_cache', JSON.stringify(transformedData));
        localStorage.setItem('makeready_data_cache_time', now);
        console.log('Data cached successfully');
      } catch (cacheErr) {
        console.warn('Failed to cache data:', cacheErr);
        // Non-critical error, continue
      }
      
      setData(transformedData);
      setUsingCachedData(false);
      setCacheTimestamp(null);
      
    } catch (err) {
      console.error('Fetch error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      setData(null);
      
    } finally {
      setLoading(false);
      setLoadingMessageIndex(0);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6 print:p-2 print:bg-white">
      <div className="max-w-4xl mx-auto print:max-w-none print:mx-0">
        <div className="mb-6 print:mb-3 flex items-center justify-between print:block">
          <h1 className="text-2xl font-semibold text-gray-900 print:text-lg">Make Ready Briefing</h1>
          <Button 
            onClick={fetchData} 
            disabled={loading}
            variant="outline"
            size="sm"
            className="print:hidden"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <Alert className={`mb-6 print:hidden ${usingCachedData ? 'border-amber-300 bg-amber-50' : ''}`}>
            <AlertCircle className={`h-4 w-4 ${usingCachedData ? 'text-amber-600' : ''}`} />
            <AlertDescription>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {usingCachedData && (
                    <p className="font-medium text-amber-800 mb-2">⚠️ Showing Cached Data</p>
                  )}
                  <p className="mb-2">{error}</p>
                  <p className="text-sm text-gray-600">
                    {usingCachedData 
                      ? 'You can still view and print the report below, but it may not include the latest updates.'
                      : 'Tips: Try refreshing the page, or wait a moment if the server is busy.'
                    }
                  </p>
                </div>
                <Button 
                  onClick={fetchData} 
                  size="sm"
                  variant="default"
                >
                  Try Again
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <Card className="p-8 text-center">
            <div className="flex flex-col items-center justify-center gap-4">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
              <div className="relative h-16 flex items-center justify-center">
                <p 
                  key={loadingMessageIndex}
                  className="text-gray-700 max-w-md animate-fade-in"
                >
                  {loadingMessages[loadingMessageIndex]}
                </p>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Hang tight—this usually takes just a moment...
              </p>
            </div>
          </Card>
        ) : data ? (
          <ReportGenerator data={data} />
        ) : (
          <Card className="p-8 text-center text-gray-500">
            No data available
          </Card>
        )}
      </div>
    </div>
  );
}