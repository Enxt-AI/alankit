# PWA Components

This directory contains Progressive Web App (PWA) components for Unlisted Stox.

## Architecture Decision: Manual Service Worker

We use a **manual service worker** approach instead of `next-pwa` or `@ducanh2912/next-pwa` plugins.

### Why Manual?

1. **Next.js 16 Compatibility**: Next.js 16 uses Turbopack by default, but PWA plugins only work with webpack
2. **Full Control**: Direct control over caching strategies, update logic, and offline behavior
3. **Better Performance**: No plugin overhead or extra dependencies
4. **Framework Agnostic**: Works regardless of bundler (Turbopack, webpack, etc.)
5. **Industry Standard**: Used by major PWAs like Twitter, Instagram, Pinterest

### Files

- **`service-worker-register.tsx`**: Registers the service worker in the browser
- **`install-prompt.tsx`**: Prompts users to install the PWA (with 7-day dismissal cooldown)

### Service Worker Location

The actual service worker code is at: **`public/sw.js`**

### How It Works

1. `ServiceWorkerRegister` component is imported in `app/layout.tsx`
2. On page load (production only by default), it registers `/sw.js`
3. Service worker intercepts network requests
4. Caches responses for offline access
5. Shows offline page when network unavailable

### Testing

**Development (NO service worker by default):**
```bash
pnpm dev
# Service worker is DISABLED in dev mode by default
# To enable for testing, see "Enable SW in Development" below
# Visit http://localhost:3000
```

**Production:**
```bash
pnpm build
pnpm start
# Visit http://localhost:3000
# Check Chrome DevTools → Application → Service Workers
```

### Enable SW in Development (Optional)

To test service worker behavior in dev mode:

1. **Temporarily remove production check** in `service-worker-register.tsx`:
   ```tsx
   // Comment out this line:
   // && process.env.NODE_ENV === 'production'
   ```

2. **Restart dev server**: `pnpm dev`

3. **After testing, clear cache**:
   - Chrome: DevTools → Application → Clear storage → Clear site data
   - Firefox: DevTools → Storage → Clear All

4. **Re-enable production check** before committing

**Warning**: Dev mode caching can cause confusion during development. Only enable temporarily for SW testing.

### Verification

**Chrome DevTools:**
- Application → Service Workers → Should see "activated and running"
- Application → Cache Storage → Should see cached resources
- Network → Throttle to "Offline" → Navigate pages (should work)

**Firefox DevTools:**
- Storage → Service Workers → Should see registered worker
- Network → Throttle to "Offline" → Navigate pages (should work)

### Lighthouse PWA Audit

Run Lighthouse audit to verify PWA compliance:
- ✅ Registers a service worker
- ✅ Responds with 200 when offline
- ✅ Has a web app manifest
- ✅ Installable
- ✅ Themed app UI

## Reference

- [MDN Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Google PWA Documentation](https://web.dev/learn/pwa/)
- [Service Worker Cookbook](https://serviceworke.rs/)
