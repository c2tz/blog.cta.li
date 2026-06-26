const robotsTxt = `
User-agent: *
Disallow: /
`.trim();

export const GET = () => {
  return new Response(robotsTxt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
