import { desc } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { responses } from "../../../db/schema";

async function ready() {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS responses (id TEXT PRIMARY KEY, name TEXT NOT NULL, selfie TEXT, answers TEXT NOT NULL, created_at INTEGER NOT NULL)").run();
}

export async function GET() {
  try { await ready(); const data = await getDb().select().from(responses).orderBy(desc(responses.createdAt)).limit(500); return Response.json({ responses: data.map(r => ({...r, answers: JSON.parse(r.answers)})) }); }
  catch { return Response.json({error:"Responses unavailable"},{status:500}); }
}

export async function POST(request: Request) {
  try { const body = await request.json() as {name?:string;selfie?:string|null;answers?:Record<string,number>}; const name=body.name?.trim().slice(0,30); if(!name||!body.answers) return Response.json({error:"Invalid response"},{status:400}); if(body.selfie && body.selfie.length>120000) return Response.json({error:"Photo is too large"},{status:413}); await ready(); await getDb().insert(responses).values({id:crypto.randomUUID(),name,selfie:body.selfie||null,answers:JSON.stringify(body.answers),createdAt:Date.now()}); return Response.json({ok:true},{status:201}); }
  catch { return Response.json({error:"Could not save response"},{status:500}); }
}

export async function DELETE() {
  try { await ready(); await env.DB.prepare("DELETE FROM responses").run(); return Response.json({ok:true}); }
  catch { return Response.json({error:"Could not clear responses"},{status:500}); }
}
