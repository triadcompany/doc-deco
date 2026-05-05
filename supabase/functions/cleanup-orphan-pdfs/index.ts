import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Collect all storage paths still referenced by documents
    const referenced = new Set<string>();
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("documents")
        .select("storage_path")
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const r of data) if (r.storage_path) referenced.add(r.storage_path);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    // List all files in pdfs bucket and delete orphans
    const orphans: string[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await supabase.storage
        .from("pdfs")
        .list("", { limit: 1000, offset });
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const f of data) {
        if (f.name && !referenced.has(f.name)) orphans.push(f.name);
      }
      if (data.length < 1000) break;
      offset += 1000;
    }

    // Delete in chunks
    let deleted = 0;
    const chunkSize = 100;
    for (let i = 0; i < orphans.length; i += chunkSize) {
      const chunk = orphans.slice(i, i + chunkSize);
      const { error } = await supabase.storage.from("pdfs").remove(chunk);
      if (error) throw error;
      deleted += chunk.length;
    }

    return new Response(
      JSON.stringify({ referenced: referenced.size, orphans_found: orphans.length, deleted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
