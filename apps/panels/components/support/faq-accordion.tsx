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
      <div className="flex items-center justify-center py-12 bg-gray-400 ">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        <span className="ml-2 text-zinc-400">Loading FAQs...</span>
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
    <div className="w-full bg-transparent  p-4 sm:p-6 rounded-lg">
      <Tabs 
        defaultValue={availableCategories[0]} 
        className="w-full"
        // IMPORTANT: Reset the "show all" state when user switches tabs
        onValueChange={() => setShowAll(false)}
      >
        
        {/* TABS HEADER */}
        <TabsList className="flex flex-wrap justify-start gap-2 h-auto bg-transparent p-0 mb-6">
          {availableCategories.map((category) => {
             const activeCount = groupedFaqs[category].filter(f => f.isActive).length;
             
             return (
               <TabsTrigger 
                 key={category} 
                 value={category}
                 className="
                   border border-zinc-700 text-zinc-300 
                   data-[state=active]:bg-white data-[state=active]:text-black 
                   hover: px-4 py-2 rounded-full transition-all
                   flex items-center gap-2
                 "
               >
                 {categoryLabels[category]}
                 <Badge 
                    variant="secondary" 
                    className={cn(
                      "ml-1 text-xs px-1.5 py-0 h-5 rounded-full border-0",
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
          const categoryFaqs = groupedFaqs[category];
          const activeFaqs = categoryFaqs.filter(faq => faq.isActive);
          
          // Logic for splicing the list
          const hasMore = activeFaqs.length > QUESTIONS_LIMIT;
          const displayedFaqs = showAll ? activeFaqs : activeFaqs.slice(0, QUESTIONS_LIMIT);

          return (
            <TabsContent key={category} value={category} className="mt-0 focus-visible:outline-none">
               <div className="rounded-md p-1 md:p-4">
                
                <Accordion type="single" collapsible className="w-full">
                  {displayedFaqs.map((faq, index) => (
                    <AccordionItem 
                        key={faq.id} 
                        value={`${category}-${index}`}
                        className="border-b-zinc-800"
                    >
                      <AccordionTrigger className="text-left px-2 hover:no-underline">
                        {faq.title}
                      </AccordionTrigger>
                      <AccordionContent className="text-zinc-400 px-2 pb-4">
                        <div className="prose prose-sm max-w-none prose-invert">
                          {faq.answer.split('\n').map((paragraph, i) => (
                            <p key={i} className="mb-2 last:mb-0">
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
                  <div className="pt-4 flex justify-center border-t border-zinc-800/50 mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAll(!showAll)}
                      className="text-zinc-400 hover: hover:bg-zinc-800"
                    >
                      {showAll ? (
                        <>
                          Show Less <ChevronUp className="ml-2 h-4 w-4" />
                        </>
                      ) : (
                        <>
                          Show {activeFaqs.length - QUESTIONS_LIMIT} More <ChevronDown className="ml-2 h-4 w-4" />
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