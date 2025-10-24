import { format, parse, subDays, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';

// Parse CSV date format: "10/21/2025 02:22" -> Date object
export function parseCSVDate(dateString: string): Date | null {
  if (!dateString) return null;
  
  try {
    // Extract just the date part (ignore time)
    const datePart = dateString.split(' ')[0]; // "10/21/2025"
    return parse(datePart, 'MM/dd/yyyy', new Date());
  } catch (error) {
    console.error('Error parsing date:', dateString, error);
    return null;
  }
}

// Format date for display: DD/MM/YYYY
export function formatDateDisplay(date: Date): string {
  return format(date, 'dd/MM/yyyy');
}

// Check if a date is within a range (inclusive)
export function isDateInRange(dateString: string, startDate: Date, endDate: Date): boolean {
  const date = parseCSVDate(dateString);
  if (!date) return false;
  
  const start = startOfDay(startDate);
  const end = endOfDay(endDate);
  
  return (isAfter(date, start) || date.getTime() === start.getTime()) &&
         (isBefore(date, end) || date.getTime() === end.getTime());
}

// Get date range based on filter
export function getDateRangeFromFilter(filter: 'last7days' | 'last30days' | 'alltime'): { start: Date; end: Date } | null {
  const today = new Date();
  
  if (filter === 'alltime') {
    return null; // No filtering
  }
  
  const days = filter === 'last7days' ? 7 : 30;
  return {
    start: subDays(today, days - 1), // -1 to include today
    end: today,
  };
}

// Check if task is overdue: incomplete AND due date < today
export function isTaskOverdue(task: { status: string | number; duedate: string | null }): boolean {
  // ✅ Handle both string and number status
  const isComplete = task.status === 1 || task.status === '1';
  if (isComplete) return false; // Completed tasks are not overdue
  if (!task.duedate) return false; // No due date = not overdue
  
  try {
    const dueDate = parse(task.duedate, 'yyyy-MM-dd', new Date());
    const today = startOfDay(new Date());
    return isBefore(dueDate, today);
  } catch {
    return false;
  }
}