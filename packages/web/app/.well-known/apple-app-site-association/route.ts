const APPLE_APP_SITE_ASSOCIATION = {
  applinks: {
    apps: [],
    details: [
      {
        appID: "9L3HKPZBH3.com.boardsesh.app",
        paths: ["NOT /api/*", "NOT /_next/*", "NOT /monitoring", "NOT /.well-known/*", "/*"],
      },
    ],
  },
};

export function GET(): Response {
  return new Response(JSON.stringify(APPLE_APP_SITE_ASSOCIATION), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
