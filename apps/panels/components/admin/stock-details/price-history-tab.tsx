"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  useAdminPriceHistory,
  useAddAdminPricePoint,
  useDeleteAdminPricePoint,
} from "@/hooks/use-admin-stock-details";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const formSchema = z.object({
  price: z.any(),
  date: z.any(),
});

type FormValues = {
  price: number;
  date: Date;
};

interface PriceHistoryTabProps {
  stockId: string;
}

export function PriceHistoryTab({ stockId }: PriceHistoryTabProps) {
  const { data: prices, isLoading } = useAdminPriceHistory(stockId);
  const addPricePoint = useAddAdminPricePoint();
  const deletePricePoint = useDeleteAdminPricePoint();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema as any),
    defaultValues: {
      price: 0,
      date: undefined as any,
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      if (!values.date) return;
      await addPricePoint.mutateAsync({
        stockId,
        dto: {
          price: Number(values.price),
          date: values.date.toISOString(),
        },
      });
      form.reset({ price: 0, date: undefined as any });
    } catch (error) {
      console.error("Failed to add price point:", error);
    }
  };

  const handleDelete = async (priceId: string) => {
    if (confirm("Are you sure you want to delete this price point?")) {
      await deletePricePoint.mutateAsync({ stockId, priceId });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add New Price Point</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit as any)}
              className="flex flex-wrap items-end gap-4"
            >
              {(FormField as any)({
                control: form.control,
                name: "date",
                render: ({ field }: any) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-[240px] pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                ),
              })}

              {(FormField as any)({
                control: form.control,
                name: "price",
                render: ({ field }: any) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                ),
              })}

              <Button
                type="submit"
                disabled={addPricePoint.isPending}
                className="mb-[2px]"
              >
                {addPricePoint.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Add Price
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Price History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : prices && prices.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prices
                    .slice()
                    .sort(
                      (a: any, b: any) =>
                        new Date(b.date).getTime() - new Date(a.date).getTime()
                    )
                    .map((price: any) => (
                      <TableRow key={price.id}>
                        <TableCell>{format(new Date(price.date), "PPP")}</TableCell>
                        <TableCell>₹{price.price.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(price.id)}
                            disabled={deletePricePoint.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No price history available.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
