const DEFAULT_CERT_FINGERPRINTS: string[] = [
  '54:4A:D4:37:19:27:8F:D2:35:BB:21:49:B2:EC:DA:19:AA:68:EF:99:82:AC:91:75:19:52:9A:D7:8D:12:7E:4D',
  'F4:CC:2A:4D:4B:88:02:75:B0:B8:E1:7E:77:E6:C3:6E:23:DB:80:F1:98:1F:1C:42:4E:F8:8C:D5:E0:33:7D:65',
];

function getCertFingerprints(): string[] {
  const configuredFingerprints = process.env.ANDROID_APP_LINK_CERT_FINGERPRINTS;

  if (!configuredFingerprints) {
    return DEFAULT_CERT_FINGERPRINTS;
  }

  return configuredFingerprints
    .split(',')
    .map((fingerprint) => fingerprint.trim())
    .filter(Boolean);
}

export function GET(): Response {
  const assetLinks = [
    {
      relation: ['delegate_permission/common.handle_all_urls', 'delegate_permission/common.get_login_creds'],
      target: {
        namespace: 'android_app',
        package_name: 'com.boardsesh.app',
        sha256_cert_fingerprints: getCertFingerprints(),
      },
    },
  ];

  return new Response(JSON.stringify(assetLinks), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
