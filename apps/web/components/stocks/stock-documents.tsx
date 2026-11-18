import { useState, useEffect } from "react";
import { useFinancials } from "@/hooks/use-financials";
import { DocumentAttachmentsButton } from "./document-attachments-button";
import { Button } from "@/components/ui/button";
import { FileText, Download, AlertCircle, Filter, BookOpen, BarChart3 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DocumentDownloadProps {
  cin: string;
  docId: string;
  fileName: string;
}

function DocumentDownloadButton({ cin, docId, fileName }: DocumentDownloadProps) {
  const name = (fileName || "document.pdf").toLowerCase().endsWith(".pdf") ? (fileName || "document.pdf") : `${fileName}.pdf`;
  const href = `/api/stocks/company/${encodeURIComponent(cin)}/documents?docId=${encodeURIComponent(docId)}`;

  // Start navigation within the tap, without an asynchronous blob click.
  return (
    <Button asChild variant="outline" size="sm" className="w-full sm:w-auto gap-2">
      <a href={href} download={name} target="_blank" rel="noopener noreferrer">
        <Download className="w-4 h-4" />
        Download
      </a>
    </Button>
  );
}
function DocumentItem({ doc, cin }: { doc: any, cin: string }) {
  const isMGT = doc.type.includes("MGT-7");
  const isConsolidated = doc.nature === "consolidated";
  const iconBg = isMGT ? "bg-blue-50 text-blue-600" : isConsolidated ? "bg-purple-50 text-purple-600" : "bg-emerald-50 text-emerald-600";
  const pilledBg = isMGT ? "bg-blue-50 text-blue-700" : isConsolidated ? "bg-purple-50 text-purple-700" : "bg-emerald-50 text-emerald-700";
  
  // Format the file name for display by replacing underscores with spaces
  const displayName = doc.fileName ? doc.fileName.replace(/_/g, " ") : "";

  return (
    <div className="flex flex-col p-4 sm:p-5 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
      <div className="flex flex-col sm:flex-row sm:items-center w-full">
        <div className="flex items-start sm:items-center gap-3.5 flex-1">
          {/* Left: Icon Badge */}
          <div className={`p-2.5 rounded-xl ${iconBg} shrink-0`}>
            <FileText className="w-5 h-5 sm:w-5.5 sm:h-5.5" strokeWidth={2} />
          </div>
          
          {/* Middle: Info */}
          <div className="min-w-0 flex-1">
            <h4 className="text-[14px] sm:text-[15px] font-semibold text-gray-900 leading-snug break-words mb-1.5" title={doc.fileName}>
              {displayName}
            </h4>
            <div className="flex items-center gap-2 flex-wrap">
               <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold tracking-wide uppercase ${pilledBg}`}>
                 FY {doc.financialYear}
               </span>
               <span className="text-[11px] sm:text-[12px] text-gray-500 font-medium">{doc.type}</span>
            </div>
          </div>
        </div>
        
        {/* Bottom Actions Row */}
        <div className="flex items-center gap-2 mt-4 pt-3 sm:flex-row sm:mt-0 sm:pt-0 sm:ml-auto w-full sm:w-auto">
           <div className="flex-grow sm:flex-none">
              <DocumentDownloadButton cin={cin} docId={doc.docId} fileName={doc.fileName} />
           </div>
        </div>
      </div>
      
      {/* Inline Attachments List */}
      <DocumentAttachmentsButton cin={cin} docId={doc.docId} />
    </div>
  );
}

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);
  return isMobile;
}

export function StockDocuments({ cin }: { cin?: string | null }) {
  const { data, isLoading, isError } = useFinancials(cin);
  const [aocFilter, setAocFilter] = useState<string>("standalone");
  const isMobile = useIsMobile();

  if (!cin) {
    return (
      <div className={`w-full bg-white border border-gray-200 rounded-2xl mt-10 mb-10 ${isMobile ? "p-4" : "p-8"}`}>
        <h2 className={`font-bold text-gray-900 mb-6 ${isMobile ? "text-lg" : "text-2xl"}`}>
           Company Documents
        </h2>
        <div className="flex flex-col items-center justify-center py-16 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
           <div className="p-4 bg-white rounded-full shadow-sm mb-4">
              <FileText className="w-8 h-8 text-gray-300" />
           </div>
           <p className="text-gray-600 font-semibold">No documents available</p>
           <p className="text-gray-400 text-sm mt-1">There are no annual returns or filings currently available.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`w-full bg-white border border-gray-200 rounded-2xl mt-10 mb-10 ${isMobile ? "p-4" : "p-8"}`}>
        <h2 className={`font-bold text-gray-900 mb-8 ${isMobile ? "text-lg" : "text-2xl"}`}>
           Company Documents
        </h2>
        <div className="flex flex-col gap-4">
           <Skeleton className="h-24 rounded-xl" />
           <Skeleton className="h-24 rounded-xl" />
           <Skeleton className="h-24 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="w-full mt-10 mb-10">
        <Alert variant="destructive" className="bg-red-50 text-red-900 border-red-200 rounded-2xl p-5">
           <AlertCircle className="h-5 w-5 text-red-600" />
           <AlertTitle className="text-red-800 font-bold ml-2">Error Loading Documents</AlertTitle>
           <AlertDescription className="text-red-700 ml-2 mt-1">Failed to load financial summary for documents.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const summaries = data.shareholdingsSummary || [];
  const mgtDocs = summaries
    .filter((s: any) => s?.metadata?.doc_id)
    .map((s: any) => ({
      year: s.year,
      financialYear: s.financial_year,
      docId: s.metadata.doc_id,
      fileName: `Annual_Return_MGT_7_${s.year}`,
      type: "Annual Return (MGT-7)",
   }))
   .sort((a: any, b: any) => Number(b.year) - Number(a.year));
   
  const financials = data.financials || [];
  const allAocDocs = financials
    .filter((f: any) => f?.pnl?.metadata?.docId)
    .map((f: any) => {
      const isConsolidated = f?.nature === "CONSOLIDATED";
      const natureLabel = isConsolidated ? "Consolidated" : "Standalone";
      
      return {
        year: new Date(f.year).getFullYear().toString(),
        financialYear: f.year,
        docId: f.pnl.metadata.docId,
        fileName: `Financial_Statements_AOC_4_${natureLabel}_${new Date(f.year).getFullYear()}`,
        type: `Financial Statement - ${natureLabel} (AOC-4)`,
        nature: isConsolidated ? "consolidated" : "standalone"
      };
    })
    .sort((a: any, b: any) => Number(b.year) - Number(a.year));
    
  const filteredAocDocs = allAocDocs.filter((doc: any) => aocFilter === "all" || doc.nature === aocFilter);

  if (mgtDocs.length === 0 && allAocDocs.length === 0) {
    return (
      <div className={`w-full bg-white border border-gray-200 rounded-2xl ${isMobile ? "p-4" : "p-8"}`}>
        <h2 className={`font-bold text-gray-900 mb-6 ${isMobile ? "text-lg" : "text-2xl"}`}>
           Company Documents
        </h2>
        <div className="flex flex-col items-center justify-center py-16 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
           <div className="p-4 bg-white rounded-full shadow-sm mb-4">
              <FileText className="w-8 h-8 text-gray-300" />
           </div>
           <p className="text-gray-600 font-semibold">No documents available</p>
           <p className="text-gray-400 text-sm mt-1">There are no annual returns or filings currently available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full bg-white border border-gray-200 rounded-2xl ${isMobile ? "p-4" : "p-8"}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
         <h2 className={`font-bold text-gray-900 ${isMobile ? "text-lg" : "text-2xl"}`}>
            Company Documents
         </h2>
      </div>
      
      <div className="space-y-12">
         {/* MGT-7 Section */}
         {mgtDocs.length > 0 && (
             <div>
                 <h3 className="text-[16px] sm:text-[17px] font-semibold text-gray-800 mb-5 flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100/50">
                       <BookOpen size={16} className="sm:w-[18px] sm:h-[18px]" strokeWidth={2.5} />
                    </div>
                    Annual Returns (MGT-7)
                 </h3>
                 <div className="flex flex-col gap-3">
                    {mgtDocs.map((doc: any, index: number) => (
                       <DocumentItem key={`${doc.docId}-${index}`} doc={doc} cin={cin} />
                    ))}
                 </div>
             </div>
         )}
         
         {/* AOC-4 Section */}
         {allAocDocs.length > 0 && (
             <div>
                 <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center justify-between sm:gap-4 mb-5">
                     <h3 className="text-[16px] sm:text-[17px] font-semibold text-gray-800 flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100/50">
                           <BarChart3 size={16} className="sm:w-[18px] sm:h-[18px]" strokeWidth={2.5} />
                        </div>
                        Financial Statements (AOC-4)
                     </h3>
                     <Tabs value={aocFilter} onValueChange={setAocFilter} className="w-full sm:w-[260px]">
                        <TabsList className="grid w-full grid-cols-2 bg-gray-100/80 p-1 rounded-xl">
                          <TabsTrigger value="standalone" className="text-[13px] h-full font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm transition-all">Standalone</TabsTrigger>
                          <TabsTrigger value="consolidated" className="text-[13px] h-full font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm transition-all">Consolidated</TabsTrigger>
                        </TabsList>
                     </Tabs>
                 </div>
                 
                 {filteredAocDocs.length > 0 ? (
                     <div className="flex flex-col gap-3">
                        {filteredAocDocs.map((doc: any, index: number) => (
                           <DocumentItem key={`${doc.docId}-${index}`} doc={doc} cin={cin} />
                        ))}
                     </div>
                 ) : (
                     <div className="text-center py-16 px-4 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                       <div className="p-4 bg-white rounded-full shadow-sm w-fit mx-auto mb-4">
                           <Filter className="w-8 h-8 text-gray-300" />
                       </div>
                       <h3 className="text-base font-semibold text-gray-800">No statements found</h3>
                       <p className="mt-1.5 text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                          No {aocFilter === 'standalone' ? 'Standalone' : 'Consolidated'} AOC-4 documents are available for this company.
                       </p>
                       <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setAocFilter(aocFilter === "standalone" ? "consolidated" : "standalone")}
                          className="bg-white hover:bg-gray-50 font-semibold shadow-sm h-10 px-6 rounded-lg"
                       >
                          Switch to {aocFilter === "standalone" ? "Consolidated" : "Standalone"}
                       </Button>
                     </div>
                 )}
             </div>
         )}
      </div>
    </div>
  );
}
