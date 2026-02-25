// app/api/debug-openai-embed/route.ts
export const runtime = "nodejs";

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY;

  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: "2 bedroom apartment in Kirchberg under 900k",
    }),
  });

  const data = await resp.json().catch(() => null);

  return Response.json({
    ok: resp.ok,
    status: resp.status,
    length: data?.data?.[0]?.embedding?.length ?? null,
    error: data?.error ?? null,
  });
}
