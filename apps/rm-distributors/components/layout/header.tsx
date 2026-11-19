"use client";

import { LogOut, Search, User, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { stripBasePath, withBasePath } from "@/lib/base-path";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const router = useRouter();
  const [userType, setUserType] = useState<string | null>(null);

  useEffect(() => {
    setUserType(localStorage.getItem("userType"));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("userType");
    const currentPath = stripBasePath(window.location.pathname);
    let loginPath = "/login/rm";
    if (currentPath.startsWith("/branch")) loginPath = "/login/branch";
    if (currentPath.startsWith("/distributor")) loginPath = "/login/distributor";
    window.location.href = withBasePath(`${loginPath}?clear=true`);
  };

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-10 w-full">
      <div className="flex items-center gap-4 flex-1">
        <SidebarTrigger className="-ml-2" />
        
        {/* Search Bar */}
        <div className="relative w-full max-w-md hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50/80 border-none rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 transition-shadow"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-2 sm:gap-4">

        {/* Account Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 hover:bg-gray-50 p-1.5 rounded-md transition-colors outline-none">
            <div className="w-8 h-8 rounded-full bg-[#16a34a] flex items-center justify-center text-white shrink-0">
              <User className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium text-gray-700 hidden sm:block">Account</span>
            <ChevronDown className="w-4 h-4 text-gray-500 hidden sm:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => {
              const prefix = userType === "branch" ? "/branch" : (userType === "distributor" ? "/distributor" : "/rm");
              router.push(`${prefix}/profile`);
            }} className="cursor-pointer">
              <User className="w-4 h-4 mr-2" />
              My Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
