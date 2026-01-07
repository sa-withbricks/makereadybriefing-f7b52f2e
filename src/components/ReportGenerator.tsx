import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Slider } from './ui/slider';
import { Calendar, RotateCcw, Printer } from 'lucide-react';

interface TaskEntry {
  date?: string;
  time?: string;
  status?: string;
  title?: string;
  description?: string;
  details?: string;
  cpWalkDate?: string;
  evs?: string;
  keyRelease?: string;
  hhg?: string;
  moveIn?: string;
  ntv?: string;
  vacate?: string;
  openWOs?: string;
  kti?: string;
  serviceRequestId?: string;
  [key: string]: any; // Allow additional properties from API
}

interface ApiResponse {
  data: any[];
  columns?: any[];
  [key: string]: any;
}

interface ReportGeneratorProps {
  data: ApiResponse;
}

export function ReportGenerator({ data }: ReportGeneratorProps) {
  // Debug: Log the raw data structure
  console.log('Raw API data:', data);
  console.log('Data array:', data.data);

  // State for date range slider
  const [dateRange, setDateRange] = useState<[number, number]>([0, 100]);
  
  // Handle Metabase format if columns are provided
  let processedData = data.data;
  
  if (data.columns && Array.isArray(data.columns) && Array.isArray(data.data)) {
    console.log('Metabase format detected, columns:', data.columns);
    
    // Convert Metabase rows format to objects
    processedData = data.data.map(row => {
      const obj: any = {};
      data.columns!.forEach((col, index) => {
        const columnName = col.display_name || col.name || `column_${index}`;
        obj[columnName] = row[index];
      });
      return obj;
    });
    
    console.log('Converted Metabase data:', processedData);
  }
  
  // Transform and normalize the data
  const normalizeEntry = (entry: any): TaskEntry => {
    // Try to map common field names to our expected format, prioritizing "Due Date: Day"
    const dueDate = entry['Due Date: Day'] || entry.due_date || entry.dueDate || entry.Due_Date || entry.DueDate || 
                   entry.date || entry.Date || entry.created_at || entry.createdAt || null;
    
    const time = entry.time || entry.Time || '';
    
    return {
      date: dueDate,
      time: time === 'All Day' ? '' : time, // Remove "All Day" labels
      status: entry['Status - StatusId → Name'] || entry.status || entry.Status || entry.state || entry.State || 'UNKNOWN',
      title: entry.title || entry.Title || entry.name || entry.Name || 'Untitled',
      description: entry.descriptionText2 || entry.description || entry.Description || entry.desc || entry.Desc || '',
      details: entry.details || entry.Details || entry.notes || entry.Notes || '',
      cpWalkDate: entry['CP Walk Date'] || entry.cpWalkDate || entry.cp_walk_date || '',
      evs: entry.EVS || entry.evs || entry.EVS_Date || '',
      keyRelease: entry['Key Release'] || entry.keyRelease || entry.key_release || '',
      hhg: entry.HHG || entry.hhg || entry.HHG_Date || '',
      moveIn: entry['Move In'] || entry.moveIn || entry.move_in || '',
      ntv: entry.NTV || entry.ntv || entry.NTV_Date || '',
      vacate: entry.Vacate || entry.vacate || entry.Vacate_Date || '',
      openWOs: entry['Make Readys - Location → Count Open'] || entry.openWOs || entry.open_wos || '',
      kti: entry.KTI || entry.kti || entry.KTI_Date || '',
      serviceRequestId: entry['Service Request Id'] || entry.serviceRequestId || entry.service_request_id || '',
      ...entry // Keep all original properties
    };
  };

  // Group data by due date
  const normalizedData = processedData.map(normalizeEntry);
  const groupedData = normalizedData.reduce((acc: Record<string, TaskEntry[]>, entry: TaskEntry) => {
    const date = entry.date || 'No Date';
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(entry);
    return acc;
  }, {});

  // Helper function to parse date string as local date (avoiding timezone issues)
  const parseLocalDate = (dateString: string | undefined) => {
    if (!dateString || dateString === 'No Date') return null;
    // Parse the date string manually to avoid timezone conversion
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // Month is 0-indexed
      const day = parseInt(parts[2]);
      return new Date(year, month, day);
    }
    // Fallback: append time to force local timezone interpretation
    return new Date(dateString + 'T12:00:00');
  };

  // Sort dates in ascending order, with "No Date" at the end
  const sortedDates = Object.keys(groupedData).sort((a, b) => {
    if (a === 'No Date') return 1;
    if (b === 'No Date') return -1;
    const dateA = parseLocalDate(a);
    const dateB = parseLocalDate(b);
    if (!dateA || !dateB) return 0;
    return dateA.getTime() - dateB.getTime();
  });

  // Format date for display
  const formatDate = (dateString: string) => {
    if (dateString === 'No Date') return 'No Date';
    const date = parseLocalDate(dateString);
    if (!date) return dateString;
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'short', 
      day: '2-digit' 
    };
    return date.toLocaleDateString('en-US', options);
  };

  // Group dates by month for navigation
  const getMonthGroups = () => {
    const monthGroups: Record<string, string[]> = {};
    
    sortedDates.forEach(date => {
      if (date === 'No Date') {
        monthGroups['No Date'] = ['No Date'];
      } else {
        const dateObj = parseLocalDate(date);
        if (!dateObj) return;
        const monthKey = dateObj.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short' 
        });
        
        if (!monthGroups[monthKey]) {
          monthGroups[monthKey] = [];
        }
        monthGroups[monthKey].push(date);
      }
    });
    
    // Sort month groups, with "No Date" at the end
    const sortedMonthKeys = Object.keys(monthGroups).sort((a, b) => {
      if (a === 'No Date') return 1;
      if (b === 'No Date') return -1;
      return new Date(a + ' 1').getTime() - new Date(b + ' 1').getTime();
    });
    
    return { monthGroups, sortedMonthKeys };
  };

  const { monthGroups, sortedMonthKeys } = getMonthGroups();

  // Create a timeline of months (excluding "No Date")
  const timelineMonths = sortedMonthKeys.filter(month => month !== 'No Date');
  const hasNoDateEntries = sortedMonthKeys.includes('No Date');

  // Initialize month range to show current month and forward
  useEffect(() => {
    if (timelineMonths.length > 0) {
      // Get current month in the same format as timeline months (e.g., "Nov 2025")
      const now = new Date();
      const currentMonthKey = now.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short' 
      });
      
      // Find the index of the current month (or the first future month if current isn't in the list)
      let startIndex = timelineMonths.findIndex(month => {
        const monthDate = new Date(month + ' 1');
        const currentDate = new Date(currentMonthKey + ' 1');
        return monthDate >= currentDate;
      });
      
      // If no current or future month found, default to the last month
      if (startIndex === -1) {
        startIndex = timelineMonths.length - 1;
      }
      
      // Set range from current month to the end
      setDateRange([startIndex, timelineMonths.length - 1]);
    } else {
      setDateRange([0, 0]);
    }
  }, [timelineMonths.length]);

  // Convert slider values to actual month indices and get all dates in selected months
  const getFilteredDates = () => {
    if (timelineMonths.length === 0) {
      return hasNoDateEntries ? ['No Date'] : [];
    }
    
    const [startIndex, endIndex] = dateRange;
    const validStartIndex = Math.max(0, Math.min(startIndex, timelineMonths.length - 1));
    const validEndIndex = Math.max(validStartIndex, Math.min(endIndex, timelineMonths.length - 1));
    
    // Get all dates from selected months
    const selectedMonths = timelineMonths.slice(validStartIndex, validEndIndex + 1);
    const selectedDates: string[] = [];
    
    selectedMonths.forEach(month => {
      selectedDates.push(...monthGroups[month]);
    });
    
    // Always include "No Date" entries if they exist
    if (hasNoDateEntries) {
      selectedDates.push('No Date');
    }
    
    return selectedDates;
  };

  const filteredDates = getFilteredDates();

  // Get month range text for display
  const getRangeText = () => {
    if (timelineMonths.length === 0) return 'No months available';
    
    const [startIndex, endIndex] = dateRange;
    const validStartIndex = Math.max(0, Math.min(startIndex, timelineMonths.length - 1));
    const validEndIndex = Math.max(validStartIndex, Math.min(endIndex, timelineMonths.length - 1));
    
    const startMonth = timelineMonths[validStartIndex];
    const endMonth = timelineMonths[validEndIndex];
    
    if (!startMonth || !endMonth) {
      return 'No months available';
    }
    
    if (validStartIndex === 0 && validEndIndex === timelineMonths.length - 1) {
      return 'All months';
    }
    
    if (startMonth === endMonth) {
      return startMonth;
    }
    
    return `${startMonth} – ${endMonth}`;
  };

  // Reset range to show all months
  const resetRange = () => {
    if (timelineMonths.length > 0) {
      setDateRange([0, timelineMonths.length - 1]);
    } else {
      setDateRange([0, 0]);
    }
  };

  // Get status colors
  const getStatusColors = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    
    if (normalizedStatus.includes('complete') || normalizedStatus === 'done') {
      return 'bg-green-100 text-green-800 border-green-200';
    } else if (normalizedStatus.includes('progress') || normalizedStatus.includes('active')) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    } else if (normalizedStatus.includes('pending') || normalizedStatus.includes('waiting')) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    } else if (normalizedStatus.includes('overdue') || normalizedStatus.includes('late')) {
      return 'bg-red-100 text-red-800 border-red-200';
    } else if (normalizedStatus.includes('cancelled') || normalizedStatus.includes('stopped')) {
      return 'bg-gray-100 text-gray-800 border-gray-200';
    } else {
      return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Print Button */}
      <div className="print:hidden flex justify-end">
        <Button
          onClick={handlePrint}
          className="flex items-center gap-2"
          variant="outline"
        >
          <Printer className="h-4 w-4" />
          Print Report
        </Button>
      </div>

      {/* Timeline Slicer */}
      <Card className="p-6 print:hidden">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Timeline Slicer
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                Drag to select month range: <span className="font-medium">{getRangeText()}</span>
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetRange}
              className="text-xs flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          </div>
          
          {timelineMonths.length > 0 && (
            <div className="space-y-4">
              {/* Integrated Timeline Bar */}
              <div className="relative px-4 py-6">
                {/* Labels above timeline */}
                <div className="absolute top-0 left-4 right-4 h-4">
                  {timelineMonths.map((month, index) => {
                    if (index % 2 !== 0) return null; // Only even indices (0, 2, 4...)
                    
                    // Calculate the exact center of each segment
                    const segmentWidth = 1 / timelineMonths.length;
                    const segmentCenter = (index + 0.5) / timelineMonths.length;
                    const centerPercentage = segmentCenter * 100;
                    
                    return (
                      <div
                        key={`${month}-above`}
                        className="absolute text-xs text-gray-600 transform -translate-x-1/2 bottom-0"
                        style={{ left: `${centerPercentage}%` }}
                      >
                        {month}
                      </div>
                    );
                  })}
                </div>
                
                {/* Combined Visual Timeline and Slider */}
                <div className="relative h-6 flex items-center mt-4 mb-4">
                  {/* Background timeline */}
                  <div className="absolute inset-0 h-4 bg-gray-200 rounded-lg top-1">
                    {/* Month segments with task density */}
                    {timelineMonths.map((month, index) => {
                      const monthDates = monthGroups[month];
                      const taskCount = monthDates.reduce((count, date) => count + (groupedData[date]?.length || 0), 0);
                      const maxTasks = Math.max(...timelineMonths.map(m => 
                        monthGroups[m].reduce((count, date) => count + (groupedData[date]?.length || 0), 0)
                      ));
                      const intensity = taskCount / Math.max(maxTasks, 1);
                      const segmentWidth = 100 / timelineMonths.length;
                      const segmentStart = (index / timelineMonths.length) * 100;
                      
                      return (
                        <div
                          key={month}
                          className="absolute top-0 h-full first:rounded-l-lg last:rounded-r-lg"
                          style={{
                            left: `${segmentStart}%`,
                            width: `${segmentWidth}%`,
                            backgroundColor: `rgba(59, 130, 246, ${0.2 + intensity * 0.6})`,
                          }}
                          title={`${month}: ${taskCount} tasks`}
                        />
                      );
                    })}
                    
                    {/* Clear segment dividers */}
                    {timelineMonths.length > 1 && timelineMonths.slice(0, -1).map((_, index) => {
                      const dividerPosition = ((index + 1) / timelineMonths.length) * 100;
                      return (
                        <div
                          key={`divider-${index}`}
                          className="absolute top-0 h-full w-px bg-gray-600 z-10 opacity-60"
                          style={{ left: `${dividerPosition}%` }}
                        />
                      );
                    })}
                    
                    {/* Selected range overlay */}
                    {timelineMonths.length > 1 && (
                      <div
                        className="absolute top-0 h-full bg-blue-600 opacity-40 z-20 first:rounded-l-lg last:rounded-r-lg"
                        style={{
                          left: `${(dateRange[0] / timelineMonths.length) * 100}%`,
                          width: `${((dateRange[1] - dateRange[0] + 1) / timelineMonths.length) * 100}%`,
                        }}
                      />
                    )}
                    {timelineMonths.length === 1 && (
                      <div className="absolute top-0 h-full w-full bg-blue-600 rounded-lg opacity-40 z-20" />
                    )}
                  </div>
                  
                  {/* Integrated slider */}
                  <Slider
                    value={dateRange}
                    onValueChange={(value) => setDateRange(value as [number, number])}
                    max={timelineMonths.length - 1}
                    min={0}
                    step={1}
                    className="w-full relative z-30"
                  />
                </div>
                
                {/* Labels below timeline */}
                <div className="absolute bottom-0 left-4 right-4 h-4">
                  {timelineMonths.map((month, index) => {
                    if (index % 2 === 0) return null; // Only odd indices (1, 3, 5...)
                    
                    // Calculate the exact center of each segment
                    const segmentCenter = (index + 0.5) / timelineMonths.length;
                    const centerPercentage = segmentCenter * 100;
                    
                    return (
                      <div
                        key={`${month}-below`}
                        className="absolute text-xs text-gray-600 transform -translate-x-1/2 top-0"
                        style={{ left: `${centerPercentage}%` }}
                      >
                        {month}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Selected range stats */}
              <div className="flex justify-between text-xs text-gray-600">
                <span>
                  {dateRange[1] - dateRange[0] + 1} of {timelineMonths.length} months selected
                </span>
                <span>
                  {filteredDates.reduce((total, date) => total + (groupedData[date]?.length || 0), 0)} total tasks
                </span>
              </div>
            </div>
          )}
          
          {timelineMonths.length === 0 && (
            <div className="text-center py-6 text-gray-500 text-sm">
              No months available for timeline
            </div>
          )}
        </div>
      </Card>

      {/* Report Content */}
      <div className="w-full">
          <Card className="p-6 bg-white print:p-2 print:shadow-none print:border-none">
            <div className="space-y-8 print:space-y-3">
              {filteredDates.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {sortedDates.length === 0 
                    ? "No tasks found in the data" 
                    : "No months selected. Use the timeline filter above to show tasks."}
                </div>
              )}
              
              {filteredDates.map((date) => (
              <div key={date} id={`date-section-${date}`} className="space-y-6 scroll-mt-6 print:space-y-2 print:break-inside-avoid">
                {/* Date Header */}
                <h2 className="text-lg font-medium text-gray-900 border-b border-gray-100 pb-2 print:text-sm print:pb-0.5 print:mb-1">
                  {formatDate(date)}
                </h2>

                {/* Tasks for this date */}
                <div className="space-y-4 print:space-y-1">
                  {groupedData[date].map((entry, index) => (
                    <div key={`${date}-${index}`} className="flex items-start justify-between p-4 bg-gray-50 rounded-lg print:py-1 print:px-2 print:bg-gray-25 print:rounded-md print:break-inside-avoid">
                      <div className="flex items-start space-x-4 flex-1 print:space-x-2">
                        {/* Time column - only show if time exists and is not empty */}
                        {entry.time && (
                          <div className="min-w-[60px] print:min-w-[40px]">
                            <p className="text-sm text-gray-500 print:text-xs">{entry.time}</p>
                          </div>
                        )}

                        {/* Status pill with appropriate colors */}
                        <div className="min-w-[80px] print:min-w-[60px]">
                          <Badge 
                            variant="secondary" 
                            className={`${getStatusColors(entry.status || '')} hover:${getStatusColors(entry.status || '')} rounded-full px-3 py-1 print:px-1 print:py-0 print:text-xs`}
                          >
                            {entry.status}
                          </Badge>
                        </div>

                        {/* Task title and description */}
                        <div className="flex-1">
                          {entry.serviceRequestId && String(entry.serviceRequestId).trim() ? (
                            <a 
                              href={`https://app.equips.com/service-requests/${entry.serviceRequestId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-gray-900 hover:text-gray-700 hover:underline cursor-pointer print:text-sm"
                            >
                              {entry.title}
                            </a>
                          ) : (
                            <p className="font-medium text-gray-900 print:text-sm">{entry.title}</p>
                          )}
                          {entry.description && (
                            <p className="text-sm text-gray-600 mt-1 print:text-xs print:mt-0">{entry.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Detail fields on the right */}
                      <div className="ml-6 text-right flex-shrink-0 max-w-xs print:ml-3 print:max-w-lg">
                        <div className="space-y-1 text-sm text-gray-600 print:space-y-0 print:text-xs">
                          {entry.cpWalkDate && String(entry.cpWalkDate).trim() && (
                            <div><span className="font-medium">CP Walk Date:</span> {entry.cpWalkDate}</div>
                          )}
                          {entry.evs && String(entry.evs).trim() && (
                            <div><span className="font-medium">EVS:</span> {entry.evs}</div>
                          )}
                          {entry.keyRelease && String(entry.keyRelease).trim() && (
                            <div><span className="font-medium">Key Release:</span> {entry.keyRelease}</div>
                          )}
                          {entry.hhg && String(entry.hhg).trim() && (
                            <div><span className="font-medium">HHG:</span> {entry.hhg}</div>
                          )}
                          {entry.moveIn && String(entry.moveIn).trim() && (
                            <div><span className="font-medium">Move In:</span> {entry.moveIn}</div>
                          )}
                          {entry.ntv && String(entry.ntv).trim() && (
                            <div><span className="font-medium">NTV:</span> {entry.ntv}</div>
                          )}
                          {entry.vacate && String(entry.vacate).trim() && (
                            <div><span className="font-medium">Vacate:</span> {entry.vacate}</div>
                          )}
                          {entry.openWOs && String(entry.openWOs).trim() && (
                            <div><span className="font-medium">Open WOs:</span> {entry.openWOs}</div>
                          )}
                          {entry.kti && String(entry.kti).trim() && (
                            <div><span className="font-medium">KTI:</span> {entry.kti}</div>
                          )}
                          {entry.details && String(entry.details).trim() && (
                            <div className="mt-2 pt-2 border-t border-gray-200 whitespace-pre-line print:mt-1 print:pt-1">
                              {entry.details}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            </div>
          </Card>
        </div>
    </div>
  );
}