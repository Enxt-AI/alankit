'use client';

/**
 * PublicFaqAccordion Component
 * * Theme: Black Background / White Text
 * * Feature: "Show More" button if > 5 questions
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, HelpCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { usePublicFaqs } from '@/hooks/use-faqs';
import { FaqCategory, Faq } from '@/types/faq';
import { cn } from '@/lib/utils';

const categoryLabels: Record<FaqCategory, string> = {
  Investing: 'Investing',
  Support: 'Support',
  General: 'General',
};

const categoryColors: Record<FaqCategory, string> = {
  Investing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  Support: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  General: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
};

const QUESTIONS_LIMIT = 5; // Configurable limit

export function FaqAccordion() {
  const { data: faqs = [], isLoading, error } = usePublicFaqs();

  // State to track if we are showing all questions
  const [showAll, setShowAll] = useState(false);

  // 1. Group FAQs
  const groupedFaqs = faqs.reduce((acc, faq) => {
    if (!acc[faq.category as FaqCategory]) {
      acc[faq.category as FaqCategory] = [];
    }
    acc[faq.category as FaqCategory].push(faq);
    return acc;
  }, {} as Record<FaqCategory, Faq[]>);

  // 2. Filter categories
  const categoryOrder: FaqCategory[] = ['General', 'Investing', 'Support'];
  
  const availableCategories = categoryOrder.filter(category => {
    const categoryFaqs = groupedFaqs[category];
    return categoryFaqs && categoryFaqs.some(faq => faq.isActive !== false);
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 bg-transparent ">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
        <span className="ml-2 text-white">Loading FAQs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="bg-red-900 border-red-800 ">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load FAQs.</AlertDescription>
      </Alert>
    );
  }

  if (faqs.length === 0 || availableCategories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-400 ">
        <HelpCircle className="h-12 w-12 text-zinc-500 mb-4" />
        <h3 className="text-lg font-semibold mb-2">No FAQs Available</h3>
      </div>
    );
  }

  return (
    <div className="w-full bg-transparent px-0 py-4 rounded-lg">
      <Tabs 
        defaultValue={availableCategories[0]} 
        className="w-full"
        // IMPORTANT: Reset the "show all" state when user switches tabs
        onValueChange={() => setShowAll(false)}
      >
        
        {/* TABS HEADER */}
        <TabsList className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] justify-start gap-2 h-auto bg-transparent p-0 mb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
          {availableCategories.map((category) => {
             const activeCount = groupedFaqs[category].filter(f => f.isActive !== false).length;
             
             return (
               <TabsTrigger 
                 key={category} 
                 value={category}
                 className={cn(
                   "group data-[state=active]:bg-green-600 data-[state=active]:text-white data-[state=active]:border-green-600",
                   "text-muted-foreground hover:text-foreground",
                   "border border-border",
                   "px-4 py-2 rounded-full text-sm font-medium transition-colors"
                 )}
               >
                 {categoryLabels[category]}
                 <Badge 
                   variant="secondary" 
                   className={cn(
                     "ml-2 text-xs",
                     categoryColors[category]
                   )}
                 >
                   {activeCount}
                 </Badge>
               </TabsTrigger>
             );
          })}
        </TabsList>

        {/* TABS CONTENT */}
        {availableCategories.map((category) => {
          // Get all active FAQs for this category
          const activeFaqs = groupedFaqs[category].filter(f => f.isActive !== false);
          
          // Logic for splicing the list
          const hasMore = activeFaqs.length > QUESTIONS_LIMIT;
          const displayedFaqs = showAll ? activeFaqs : activeFaqs.slice(0, QUESTIONS_LIMIT);

          return (
            <TabsContent key={category} value={category} className="mt-0 focus-visible:outline-none">
               <div className="rounded-md">
                
                <Accordion type="single" collapsible className="w-full">
                  {displayedFaqs.map((faq, index) => (
                    <AccordionItem 
                        key={faq.id || faq.title || `${category}-${index}`} 
                        value={`${category}-${index}`}
                        className="border-b border-zinc-200 dark:border-b-zinc-800"
                    >
                      <AccordionTrigger className="text-left px-1 sm:px-2 py-3.5 sm:py-4 text-sm sm:text-base font-semibold hover:no-underline text-zinc-900 dark:text-zinc-200">
                        {faq.title}
                      </AccordionTrigger>
                      <AccordionContent className="px-1 sm:px-2 pb-4">
                        <div className="prose prose-sm max-w-none text-left dark:prose-invert">
                          {faq.answer.split('\n').map((paragraph, i) => (
                            <p key={i} className="mb-2 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed last:mb-0">
                              {paragraph}
                            </p>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>

                {/* SHOW MORE BUTTON */}
                {hasMore && (
                  <div className="pt-4 flex justify-center border-t border-zinc-200 dark:border-zinc-800/50 mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAll(!showAll)}
                      className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs sm:text-sm"
                    >
                      {showAll ? (
                        <>
                          Show Less <ChevronUp className="ml-1.5 h-3.5 w-3.5 sm:ml-2 sm:h-4 sm:w-4" />
                        </>
                      ) : (
                        <>
                          Show {activeFaqs.length - QUESTIONS_LIMIT} More <ChevronDown className="ml-1.5 h-3.5 w-3.5 sm:ml-2 sm:h-4 sm:w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                )}

               </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}