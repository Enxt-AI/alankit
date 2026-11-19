const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function stripBasePath(pathname: string): string {
  if (!basePath) return pathname;
  if (pathname === basePath) return '/';
  return pathname.startsWith(`${basePath}/`)
    ? pathname.slice(basePath.length)
    : pathname;
}

export function withBasePath(path: string): string {
  if (!basePath) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (normalizedPath === basePath || normalizedPath.startsWith(`${basePath}/`)) {
    return normalizedPath;
  }
  return `${basePath}${normalizedPath}`;
}
