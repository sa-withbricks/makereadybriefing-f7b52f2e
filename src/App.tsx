import { useState, useEffect } from 'react';
import { ReportGenerator } from './components/ReportGenerator';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from './components/ui/alert';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://crrksywyxdpylndkgrnp.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNycmtzeXd5eGRweWxuZGtncm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NzczOTcsImV4cCI6MjA4MzQ1MzM5N30.VV45bA7qYxDhMGsaWbWhaLw9gRjF6u_t8hMSmZyPtzk';

interface ApiResponse {
  data: any[];
  [key: string]: any;
}

function App() {
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
    }, 3000);

    return () => clearInterval(interval);
  }, [loading, loadingMessages.length]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setLoadingMessageIndex(0);
    setUsingCachedData(false);
    
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/equips-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();

      if (responseData?.error) {
        throw new Error(responseData.error);
      }

      const transformedData: ApiResponse = {
        data: Array.isArray(responseData?.data) ? responseData.data : [],
      };

      console.log('Fetched data:', transformedData);

      // Cache successful data
      try {
        const now = new Date().toISOString();
        localStorage.setItem('makeready_data_cache', JSON.stringify(transformedData));
        localStorage.setItem('makeready_data_cache_time', now);
      } catch (cacheErr) {
        console.warn('Failed to cache data:', cacheErr);
      }

      setData(transformedData);
      setUsingCachedData(false);
      setCacheTimestamp(null);
      
    } catch (err) {
      console.error('Fetch error:', err);
      
      // Try cache fallback
      const cachedData = localStorage.getItem('makeready_data_cache');
      const cachedTime = localStorage.getItem('makeready_data_cache_time');
      
      if (cachedData && cachedTime) {
        const parsedData = JSON.parse(cachedData);
        setData(parsedData);
        setUsingCachedData(true);
        setCacheTimestamp(cachedTime);
        setError(
          `Unable to reach the API — showing cached data from ${new Date(cachedTime).toLocaleString()}.\n\n` +
          `Error: ${err instanceof Error ? err.message : 'Unknown error'}\n\n` +
          `The cached data may be outdated. Click "Try Again" to retry.`
        );
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
        setData(null);
      }
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

export default App;
