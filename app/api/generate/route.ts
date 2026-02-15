import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const prompt = `
You are a professional Luxembourg real estate copywriter.

Write a listing in ${body.language || "EN"}.

Property:
Type: ${body.propertyType}
Location: ${body.location}
Size: ${body.sizeSqm} sqm
Bedrooms: ${body.bedrooms}
Bathrooms: ${body.bathrooms}
Condition: ${body.condition}
Price: ${body.price}
Features: ${body.features}

Return:
1) Headline
2) Description
3) Bullet points
4) Call to action
`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 800,
        temperature: 0.7,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    const text = data?.content?.[0]?.text;

    return NextResponse.json({ result: text });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
