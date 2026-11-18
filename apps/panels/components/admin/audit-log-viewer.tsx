'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AuditLog } from '@/types/content';
import { useAuditLogs } from '@/hooks/use-audit-logs';
import { Eye } from 'lucide-react';

interface AuditLogViewerProps {
  entityType: string;
  entityId: string;
}

const getActionBadgeVariant = (action: AuditLog['action']) => {
  switch (action) {
    case 'CREATE':
      return 'default';
    case 'UPDATE':
      return 'secondary';
    case 'DELETE':
      return 'destructive';
    case 'ROLLBACK':
      return 'outline';
    case 'PUBLISH':
      return 'default';
    case 'UNPUBLISH':
      return 'secondary';
    default:
      return 'outline';
  }
};

export function AuditLogViewer({ entityType, entityId }: AuditLogViewerProps) {
  const { data: auditLogs, isLoading } = useAuditLogs(entityType, entityId);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!auditLogs || auditLogs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500 py-8">No audit logs found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Logs</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Changes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>
                  {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm')}
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{log.adminEmail}</div>
                    <div className="text-sm text-gray-500">{log.adminRole}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getActionBadgeVariant(log.action)}>
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedLog(selectedLog === log.id ? null : log.id)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {selectedLog && (
          <div className="mt-4">
            <Accordion type="single" collapsible>
              <AccordionItem value={selectedLog}>
                <AccordionTrigger>Change Details</AccordionTrigger>
                <AccordionContent>
                  {(() => {
                    const log = auditLogs.find(l => l.id === selectedLog);
                    if (!log?.changes) return <p className="text-sm text-gray-500">No change details available</p>;
                    
                    const changes = log.changes;
                    const changeEntries = Object.entries(changes);
                    
                    if (changeEntries.length === 0) {
                      return <p className="text-sm text-gray-500">No changes recorded</p>;
                    }
                    
                    return (
                      <div className="space-y-2">
                        {changeEntries.map(([field, value]) => (
                          <div key={field} className="bg-gray-50 p-3 rounded">
                            <div className="font-medium text-sm text-gray-700 mb-1">{field}</div>
                            <div className="text-sm font-mono bg-white p-2 rounded border overflow-auto">
                              {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </CardContent>
    </Card>
  );
}