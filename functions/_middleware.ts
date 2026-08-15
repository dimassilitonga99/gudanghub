const LEGACY_PATHS = new Set([
  'login',
  'order',
  'dashboard',
  'ganti-password',
  'laporan',
  'notifikasi',
  'picker',
  'profil',
  'settings',
  'test',
  'cara',
]);

export const onRequest: PagesFunction<{ ASSETS: Fetcher }> = async (ctx) => {
  const path = new URL(ctx.request.url).pathname.split('/')[1];
  if (LEGACY_PATHS.has(path)) {
    const res = await ctx.env.ASSETS.fetch('/index.html');
    return new Response(res.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  }
  return ctx.next();
};
