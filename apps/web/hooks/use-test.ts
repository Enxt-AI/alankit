"use client";

import { useEffect, useState } from "react";
import { authApi } from "../lib/api-client";
import axios from "axios";

interface TestApiState {
  data: any;
  error: string | null;
  loading: boolean;
}

export function useTestApi() {
  const [state, setState] = useState<TestApiState>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    // Track if component is still mounted
    let mounted = true;
    
    // Create abort controller for request cancellation
    const abortController = new AbortController();

    const testAuthService = async () => {
      try {
        console.log("Testing auth-service connection...");
        // Try to make a simple request - even if it fails, we can check if the service is reachable
        // We expect this to return 401 or 400 (not 404), which means the service is running
        const response = await authApi.post("/auth/otp", {}, {
          signal: abortController.signal,
        });
        
        // Success path - if we actually get a 2xx response
        if (mounted) {
          console.log(" Auth-service responded successfully");
          setState({
            data: {
              status: "connected",
              message: "Auth-service is running",
              statusCode: response.status || 200,
            },
            error: null,
            loading: false,
          });
        }
      } catch (err: any) {
        // Don't update state if request was aborted or component unmounted
        if (axios.isCancel(err) || err.name === 'CanceledError' || err.code === 'ERR_CANCELED' || !mounted) {
          console.log("Request cancelled or component unmounted");
          return;
        }

        console.log("Auth-service test response:", err.response?.status);
        
        // Extract better error message
        const errorMessage = axios.isAxiosError(err)
          ? err.response?.data?.message || err.message
          : err.message;
        
        // If we get 400 or 401, the service is running and responding
        if (err.response?.status === 400 || err.response?.status === 401) {
          console.log(" Auth-service is running and responding");
          if (mounted) {
            setState({
              data: { 
                status: "connected", 
                message: "Auth-service is running",
                statusCode: err.response.status 
              },
              error: null,
              loading: false,
            });
          }
        } else if (err.code === "ERR_NETWORK" || err.message.includes("Network Error")) {
          // Network error means service is not running
          if (mounted) {
            setState({
              data: null,
              error: "Cannot connect - is auth-service running on port 3002?",
              loading: false,
            });
          }
        } else {
          // Other errors
          if (mounted) {
            setState({
              data: null,
              error: `Unexpected error: ${errorMessage}`,
              loading: false,
            });
          }
        }
      }
    };

    testAuthService();

    // Cleanup function - abort request and prevent state updates after unmount
    return () => {
      mounted = false;
      abortController.abort();
    };
  }, []);

  return state;
}
