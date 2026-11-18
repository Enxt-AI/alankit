'use client';

import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { generateDummyPriceData, formatCurrency } from '@/lib/format-utils';

interface StockPriceChartProps {
  basePrice?: number;
}

export function StockPriceChart({ basePrice = 1000 }: StockPriceChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'1M' | '3M' | '6M' | '1Y'>('1M');

  // Generate data based on selected period
  const periods = {
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '1Y': 365,
  };

  const data = useMemo(() => generateDummyPriceData(periods[selectedPeriod], basePrice), [selectedPeriod, basePrice]);

  // Format date for tooltip
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Stock Price History</span>
          <div className="flex gap-1">
            {(['1M', '3M', '6M', '1Y'] as const).map((period) => (
              <Button
                key={period}
                variant={selectedPeriod === period ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPeriod(period)}
                className="h-7 px-2 text-xs"
              >
                {period}
              </Button>
            ))}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(value) => formatCurrency(value)}
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                labelFormatter={(label) => `Date: ${formatDate(label)}`}
                formatter={(value: ValueType) => {
                  const raw = Array.isArray(value) ? value[0] : value;
                  const numericValue =
                    typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;

                  return [
                    Number.isFinite(numericValue) ? formatCurrency(numericValue) : '—',
                    'Price',
                  ];
                }}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#3b82f6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Historical price data coming soon
        </p>
      </CardContent>
    </Card>
  );
}