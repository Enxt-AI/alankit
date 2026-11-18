/**
 * Admin Table Skeleton Component
 * 
 * Reusable loading skeleton for admin tables.
 * Displays placeholder rows while data is being fetched.
 */

import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AdminTableSkeletonProps {
  /** Number of skeleton rows to display */
  rows?: number;
  
  /** Number of columns in the table */
  columns?: number;
  
  /** Whether to show actions column */
  showActions?: boolean;
}

/**
 * Renders a skeleton loading state for admin tables
 * 
 * @param rows - Number of rows to display (default: 5)
 * @param columns - Number of columns (default: 6)
 * @param showActions - Whether to include actions column (default: true)
 */
export function AdminTableSkeleton({ 
  rows = 5, 
  columns = 6, 
  showActions = true 
}: AdminTableSkeletonProps) {
  const actualColumns = showActions ? columns : columns - 1;
  
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: actualColumns }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-4 w-24" />
              </TableHead>
            ))}
            {showActions && (
              <TableHead className="text-right">
                <Skeleton className="h-4 w-16 ml-auto" />
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: actualColumns }).map((_, colIndex) => (
                <TableCell key={colIndex}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
              {showActions && (
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
