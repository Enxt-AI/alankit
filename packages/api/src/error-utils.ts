/**
 * Central utility to parse, clean, and map technical exceptions / raw API errors
 * into high-quality, user-friendly strings.
 *
 * Prevents displaying raw status codes (500, 502, 503, 504), connection errors
 * (ECONNREFUSED), or raw object mappings like "[object Object]".
 */
export function sanitizeErrorMessage(
  error: any,
  fallback: string = "Something went wrong. Please try again."
): string {
  if (!error) return fallback;

  // Resolve service name if possible from URL or configuration
  const config = error?.config || error?.response?.config;
  const url = String(config?.url || config?.baseURL || "");
  const isLogin = typeof window !== "undefined" && window.location.pathname.includes("/login");

  let serviceName = "";
  if (url.includes("auth") || url.includes("3002")) {
    serviceName = "Authentication Service";
  } else if (url.includes("tickets") || url.includes("3001")) {
    serviceName = "Ticketing Service";
  } else if (url.includes("stocks") || url.includes("3003")) {
    serviceName = "Stocks Service";
  } else if (url.includes("payments") || url.includes("3004")) {
    serviceName = "Payments Service";
  } else if (url.includes("storage") || url.includes("3005")) {
    serviceName = "Storage Service";
  } else if (isLogin) {
    serviceName = "Authentication Service";
  }

  let message = "";

  // 1. Extract message string
  if (typeof error === "string") {
    message = error;
  } else if (error instanceof Error) {
    message = error.message || "";
  } else if (typeof error === "object") {
    // Check if it is an Axios-like error response
    const backendMessage = error?.response?.data?.message || error?.data?.message;
    if (backendMessage) {
      if (Array.isArray(backendMessage)) {
        message = backendMessage
          .map((item) => {
            if (item && typeof item === "object") {
              if (item.constraints) {
                return Object.values(item.constraints).join(", ");
              }
              return JSON.stringify(item);
            }
            return String(item);
          })
          .join(", ");
      } else if (typeof backendMessage === "object" && backendMessage !== null) {
        if (backendMessage.constraints) {
          message = Object.values(backendMessage.constraints).join(", ");
        } else {
          // If the message is a nested object, check if it has a string message field
          const nestedMsg = backendMessage.message || backendMessage.error;
          if (nestedMsg && typeof nestedMsg === "string") {
            message = nestedMsg;
          } else {
            const values = Object.values(backendMessage);
            const isStrings = values.every((v) => typeof v === "string");
            if (isStrings && values.length > 0) {
              message = values.join(", ");
            } else {
              message = JSON.stringify(backendMessage);
            }
          }
        }
      } else {
        message = String(backendMessage);
      }
    } else if (error.message) {
      message = String(error.message);
    } else {
      try {
        message = error.error || JSON.stringify(error);
      } catch (e) {
        message = fallback;
      }
    }
  } else {
    message = String(error);
  }

  // Double check to prevent "[object Object]" or nested objects returning
  if (!message || message === "[object Object]" || typeof message === "object") {
    return fallback;
  }

  const messageUpper = message.toUpperCase();

  // 2. Map and translate technical codes/network exceptions into human-friendly explanations
  if (
    messageUpper.includes("502") ||
    messageUpper.includes("BAD GATEWAY")
  ) {
    return `${serviceName || "The backend service"} is temporarily offline or unreachable. Please try again.`;
  }

  if (
    messageUpper.includes("503") ||
    messageUpper.includes("SERVICE UNAVAILABLE")
  ) {
    return `${serviceName || "The server"} is undergoing maintenance or is temporarily unavailable. Please try again later.`;
  }

  if (
    messageUpper.includes("504") ||
    messageUpper.includes("GATEWAY TIMEOUT")
  ) {
    return `${serviceName || "The server"} request timed out. Please try again.`;
  }

  if (
    messageUpper.includes("500") ||
    messageUpper === "INTERNAL SERVER ERROR" ||
    messageUpper.includes("ECONNREFUSED") ||
    messageUpper.includes("ERR_NETWORK") ||
    messageUpper.includes("NETWORK ERROR") ||
    messageUpper.includes("CANNOT CONNECT") ||
    messageUpper.includes("FAILED TO FETCH")
  ) {
    if (messageUpper.includes("ECONNREFUSED") || messageUpper.includes("NETWORK") || messageUpper.includes("FETCH")) {
      return `Unable to connect to the ${serviceName || "server"}. Please check if the service is running.`;
    }
    // If the message was exactly "Internal Server Error" or "500", show cleaner text. Otherwise pass the specific backend message.
    if (messageUpper === "INTERNAL SERVER ERROR" || messageUpper === "500" || messageUpper.includes("STATUS CODE 500")) {
      return `An internal error occurred in the ${serviceName || "server"}. Please check the service status.`;
    }
  }

  if (
    messageUpper.includes("THROTTLEREXCEPTION") ||
    messageUpper.includes("TOO MANY REQUESTS") ||
    messageUpper.includes("429")
  ) {
    return "Too many requests. Please try again later.";
  }

  // Handle OTP & verification code errors explicitly so they are NEVER masked by session expiration
  if (
    messageUpper.includes("OTP") ||
    messageUpper.includes("VERIFICATION CODE") ||
    messageUpper.includes("SECURITY CODE")
  ) {
    if (
      messageUpper.includes("EXPIRED") ||
      messageUpper.includes("NOT SENT") ||
      messageUpper.includes("NO OTP")
    ) {
      return "The OTP has expired or was not found. Please request a new OTP.";
    }
    if (messageUpper.includes("INVALID") || messageUpper.includes("INCORRECT")) {
      return message;
    }
    return message;
  }

  // Session / Auth Token expiration (strictly for JWT/auth tokens and active sessions)
  if (
    messageUpper.includes("SESSION EXPIRED") ||
    messageUpper.includes("SESSION HAS EXPIRED") ||
    messageUpper.includes("JWT EXPIRED") ||
    messageUpper.includes("TOKEN EXPIRED") ||
    messageUpper.includes("REFRESH TOKEN EXPIRED") ||
    messageUpper.includes("ACCESS TOKEN EXPIRED") ||
    messageUpper.includes("INVALID_TOKEN") ||
    messageUpper.includes("INVALID TOKEN") ||
    messageUpper.includes("TOKEN INVALID") ||
    messageUpper.includes("SESSION_EXPIRED") ||
    messageUpper === "UNAUTHORIZED" ||
    messageUpper.includes("STATUS CODE 401") ||
    messageUpper.includes("TOKEN IS INVALID OR EXPIRED")
  ) {
    return "Your session has expired. Please log in again to continue.";
  }

  if (messageUpper.includes("FORBIDDEN") || messageUpper.includes("403")) {
    return "You do not have permission to perform this action.";
  }

  // Final check for status codes or general failure messages that got through
  if (/\b(502)\b/.test(message) || /status\s+code\s+502/i.test(message)) {
    return `${serviceName || "The backend service"} is temporarily offline or unreachable. Please try again.`;
  }
  if (/\b(503)\b/.test(message) || /status\s+code\s+503/i.test(message)) {
    return `${serviceName || "The server"} is undergoing maintenance or is temporarily unavailable. Please try again later.`;
  }
  if (/\b(504)\b/.test(message) || /status\s+code\s+504/i.test(message)) {
    return `${serviceName || "The server"} request timed out. Please try again.`;
  }
  if (/\b(500)\b/.test(message) || /status\s+code\s+500/i.test(message)) {
    return `An internal error occurred in the ${serviceName || "server"}. Please check the service status.`;
  }
  // Prevent Axios's generic "Request failed with status code 400" from leaking to UI
  if (/status\s+code\s+400/i.test(message) || /\brequest\s+failed\b.*\b400\b/i.test(message)) {
    return fallback;
  }

  return message;
}
