// lib/search/embeddings.ts
export type EmbeddingResult = {
  vector: number[]; // 1536
  model: string;
};

function normalize(input: string) {
  return input.replace(/\s+/g, " ").trim().slice(0, 12000);
}

export async function embedText(input: string): Promise<EmbeddingResult> {
  const text = normalize(input);
  if (!text) return { vector: new Array(1536).fill(0), model: "empty" };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small", // 1536-dim
      input: text,
    }),
  });

  if (!resp.ok) {
    const msg = await resp.text();
    throw new Error(`OpenAI embeddings error ${resp.status}: ${msg}`);
  }

  const data = await resp.json();
  const vector = data?.data?.[0]?.embedding as number[] | undefined;
  if (!vector || vector.length !== 1536) {
    throw new Error(`Unexpected embedding length: ${vector?.length}`);
  }

  return { vector, model: "text-embedding-3-small" };
}
