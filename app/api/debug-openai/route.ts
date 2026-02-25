export async function GET() {
  return Response.json({
    keyLoaded: !!process.env.OPENAI_API_KEY,
    keyLength: process.env.OPENAI_API_KEY?.length ?? 0,
  });
}
