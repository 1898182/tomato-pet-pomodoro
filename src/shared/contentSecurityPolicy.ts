const BASE_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'"
];

export function getRendererContentSecurityPolicy(development: boolean): string {
  const connectSources = ["'self'", "data:", "blob:"];
  if (development) {
    connectSources.push("http://127.0.0.1:*", "ws://127.0.0.1:*");
  }

  return [...BASE_DIRECTIVES, `connect-src ${connectSources.join(" ")}`].join("; ");
}
