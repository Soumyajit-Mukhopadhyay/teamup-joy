import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tool definitions for HackerBuddy
const tools = [
  {
    type: "function",
    function: {
      name: "search_hackathons",
      description:
        "Search approved hackathons in the database by partial name/description, region, or tags.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Partial name/description/tag query (case-insensitive)",
          },
          region: { type: "string", description: "Filter by region" },
          limit: { type: "number", description: "Max results (default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_hackathon_link",
      description:
        "Get the official website link for a hackathon from the database. Supports partial name. If multiple matches are found, return choices for the user to pick.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Hackathon name/slug/id (partial ok)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_users",
      description:
        "Search users by username, userid, or UUID (partial & case-insensitive). Returns matches for disambiguation.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "username, userid, or UUID (partial ok)" },
          limit: { type: "number", description: "Max results (default 5)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_current_participations",
      description:
        "Get the current user's current hackathon participations (and matching hackathon details when available).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_teams",
      description: "Get all teams the current user is a member of",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_friends",
      description: "Get the list of user's friends",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "send_friend_request",
      description:
        "Send a friend request to another user by username/userid/UUID. REQUIRES USER CONFIRMATION.",
      parameters: {
        type: "object",
        properties: {
          user_query: {
            type: "string",
            description: "username, userid, or UUID (partial ok)",
          },
        },
        required: ["user_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_team",
      description:
        "Create a new team for a hackathon. Hackathon can be provided as slug/id/name (partial ok). REQUIRES USER CONFIRMATION.",
      parameters: {
        type: "object",
        properties: {
          team_name: { type: "string", description: "Name of the team" },
          hackathon_query: {
            type: "string",
            description:
              "Hackathon slug/id/name (partial ok). If omitted, use the currently-open hackathon page if available.",
          },
        },
        required: ["team_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "invite_to_team",
      description:
        "Invite a user to join a team by username/userid/UUID. REQUIRES USER CONFIRMATION.",
      parameters: {
        type: "object",
        properties: {
          team_id: { type: "string", description: "UUID of the team" },
          user_query: {
            type: "string",
            description: "username, userid, or UUID (partial ok)",
          },
        },
        required: ["team_id", "user_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for information about hackathons, technologies, or any topic the user asks about",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_hackathon",
      description:
        "Submit a new hackathon for admin approval. REQUIRES USER CONFIRMATION.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the hackathon" },
          description: { type: "string", description: "Description of the hackathon" },
          start_date: { type: "string", description: "Start date in ISO format" },
          end_date: { type: "string", description: "End date in ISO format" },
          location: { type: "string", description: "Location (city or Online)" },
          region: {
            type: "string",
            description: "Region (e.g., North America, Europe, Asia, Global)",
          },
          url: { type: "string", description: "Website URL" },
          organizer: { type: "string", description: "Organizer name" },
        },
        required: ["name", "start_date", "end_date", "location", "region"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pending_requests",
      description: "Get pending friend requests and team invitations for the user",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

// Guardrails - actions that require confirmation
const CONFIRMATION_REQUIRED_ACTIONS = [
  "send_friend_request",
  "create_team",
  "invite_to_team",
  "submit_hackathon",
];

// Blocked/dangerous actions
const BLOCKED_PATTERNS = [
  /delete.*database/i,
  /drop.*table/i,
  /delete.*all/i,
  /remove.*all.*hackathon/i,
  /hack.*system/i,
  /inject.*sql/i,
  /bypass.*security/i,
  /access.*other.*user/i,
  /steal.*data/i,
  /expose.*password/i,
];

function checkGuardrails(userMessage: string): { blocked: boolean; reason?: string } {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(userMessage)) {
      return {
        blocked: true,
        reason: "I cannot perform actions that could harm the system or other users' data. If you need help with something specific, please ask in a different way.",
      };
    }
  }
  return { blocked: false };
}

async function executeToolCall(
  toolName: string,
  args: Record<string, any>,
  supabase: any,
  userId: string,
  pendingConfirmation: boolean,
  context: { currentHackathonId?: string } = {}
): Promise<{ result: any; needsConfirmation?: boolean; confirmationMessage?: string }> {
  const isUuid = (v: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

  const cleanQuery = (v: unknown) =>
    String(v ?? "")
      .trim()
      .replace(/^@/, "");

  const resolveHackathon = async (queryRaw: string) => {
    const query = cleanQuery(queryRaw);
    if (!query) return { type: "none" as const, matches: [] as any[] };

    // 1) Exact by slug or id
    const exact = await supabase
      .from("hackathons")
      .select("id, slug, name, region, start_date, end_date, url")
      .or(`slug.eq.${query},id.eq.${query}`)
      .eq("status", "approved")
      .maybeSingle();

    if (exact.data) return { type: "single" as const, match: exact.data };

    // 2) Partial name match
    const { data: partial, error } = await supabase
      .from("hackathons")
      .select("id, slug, name, region, start_date, end_date, url")
      .eq("status", "approved")
      .ilike("name", `%${query}%`)
      .order("start_date", { ascending: true })
      .limit(5);

    if (error) return { type: "error" as const, error: error.message };
    if (!partial?.length) return { type: "none" as const, matches: [] as any[] };
    if (partial.length === 1) return { type: "single" as const, match: partial[0] };

    return { type: "many" as const, matches: partial };
  };

  const resolveUser = async (queryRaw: string) => {
    const query = cleanQuery(queryRaw);
    if (!query) return { type: "none" as const, matches: [] as any[] };

    const limit = Math.min(Math.max(Number(args?.limit ?? 5) || 5, 1), 10);

    // Build a permissive OR filter: exact UUID match OR partial userid/username
    const orParts: string[] = [];
    if (isUuid(query)) orParts.push(`user_id.eq.${query}`);
    orParts.push(`userid.ilike.%${query}%`);
    orParts.push(`username.ilike.%${query}%`);

    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, userid, username")
      .or(orParts.join(","))
      .limit(limit);

    if (error) return { type: "error" as const, error: error.message };
    if (!data?.length) return { type: "none" as const, matches: [] as any[] };
    if (data.length === 1) return { type: "single" as const, match: data[0] };

    return { type: "many" as const, matches: data };
  };

  switch (toolName) {
    case "search_hackathons": {
      let query = supabase.from("hackathons").select("*").eq("status", "approved");
      if (args.query) {
        const q = cleanQuery(args.query);
        query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
      }
      if (args.region) {
        query = query.ilike("region", `%${cleanQuery(args.region)}%`);
      }
      const limit = Math.min(Math.max(Number(args.limit ?? 10) || 10, 1), 25);
      const { data, error } = await query.limit(limit);
      if (error) return { result: { error: error.message } };
      return { result: data || [] };
    }

    case "get_hackathon_link": {
      const res = await resolveHackathon(args.query);
      if (res.type === "error") return { result: { error: res.error } };
      if (res.type === "none") return { result: { error: "Hackathon not found" } };
      if (res.type === "many") {
        return {
          result: {
            needs_selection: true,
            message: "I found multiple hackathons. Which one do you mean?",
            matches: res.matches.map((h: any) => ({
              name: h.name,
              slug: h.slug,
              region: h.region,
              start_date: h.start_date,
              end_date: h.end_date,
              url: h.url,
            })),
          },
        };
      }

      return {
        result: {
          name: res.match.name,
          slug: res.match.slug,
          url: res.match.url || null,
          message: res.match.url
            ? `Official link for ${res.match.name}`
            : `I don't have an official link saved for ${res.match.name}.`,
        },
      };
    }

    case "search_users": {
      const res = await resolveUser(args.query);
      if (res.type === "error") return { result: { error: res.error } };
      if (res.type === "none") return { result: [] };
      if (res.type === "many") return { result: res.matches };
      return { result: [res.match] };
    }

    case "get_current_participations": {
      const { data: parts, error } = await supabase
        .from("hackathon_participations")
        .select("hackathon_id, status, created_at")
        .eq("user_id", userId)
        .eq("status", "current")
        .order("created_at", { ascending: false })
        .limit(25);

      if (error) return { result: { error: error.message } };
      const ids = (parts || []).map((p: any) => p.hackathon_id);

      // Try match hackathon rows by slug and by UUID id
      const uuidIds = ids.filter((v: string) => isUuid(String(v)));
      const { data: bySlug } = ids.length
        ? await supabase
            .from("hackathons")
            .select("id, slug, name, start_date, end_date, region, url")
            .in("slug", ids)
            .eq("status", "approved")
        : { data: [] };
      const { data: byId } = uuidIds.length
        ? await supabase
            .from("hackathons")
            .select("id, slug, name, start_date, end_date, region, url")
            .in("id", uuidIds)
            .eq("status", "approved")
        : { data: [] };

      const map = new Map<string, any>();
      (bySlug || []).forEach((h: any) => map.set(h.slug, h));
      (byId || []).forEach((h: any) => map.set(h.id, h));

      return {
        result: (parts || []).map((p: any) => ({
          hackathon_id: p.hackathon_id,
          status: p.status,
          joined_at: p.created_at,
          hackathon: map.get(p.hackathon_id) || null,
        })),
      };
    }

    case "get_user_teams": {
      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("team_id, role, is_leader")
        .eq("user_id", userId);

      if (!teamMembers?.length) return { result: [] };

      const teamIds = teamMembers.map((tm: any) => tm.team_id);
      const { data: teams } = await supabase
        .from("teams")
        .select("id, name, hackathon_id")
        .in("id", teamIds);

      return { result: teams || [] };
    }

    case "get_user_friends": {
      const { data: friends } = await supabase
        .from("friends")
        .select("friend_id")
        .eq("user_id", userId);

      if (!friends?.length) return { result: [] };

      const friendIds = friends.map((f: any) => f.friend_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("userid, username, user_id")
        .in("user_id", friendIds);

      return { result: profiles || [] };
    }

    case "send_friend_request": {
      const who = await resolveUser(args.user_query);
      if (who.type === "error") return { result: { error: who.error } };
      if (who.type === "none") return { result: { error: "User not found" } };
      if (who.type === "many") {
        return {
          result: {
            needs_selection: true,
            message: "I found multiple users. Which one should I send a friend request to?",
            matches: who.matches,
          },
        };
      }

      const target = who.match;

      if (target.user_id === userId) {
        return { result: { error: "You cannot send a friend request to yourself" } };
      }

      if (!pendingConfirmation) {
        return {
          result: null,
          needsConfirmation: true,
          confirmationMessage: `I'll send a friend request to ${target.username} (@${target.userid}). Should I proceed?`,
        };
      }

      // Check if already friends
      const { data: existing } = await supabase
        .from("friends")
        .select("id")
        .eq("user_id", userId)
        .eq("friend_id", target.user_id)
        .maybeSingle();

      if (existing) return { result: { error: "You are already friends with this user" } };

      // Check for pending request
      const { data: pendingReq } = await supabase
        .from("friend_requests")
        .select("id")
        .eq("from_user_id", userId)
        .eq("to_user_id", target.user_id)
        .eq("status", "pending")
        .maybeSingle();

      if (pendingReq) return { result: { error: "Friend request already pending" } };

      const { error } = await supabase
        .from("friend_requests")
        .insert({ from_user_id: userId, to_user_id: target.user_id });

      if (error) return { result: { error: error.message } };
      return {
        result: {
          success: true,
          message: `Friend request sent to ${target.username} (@${target.userid})`,
        },
      };
    }

    case "create_team": {
      const hackathonQuery = cleanQuery(args.hackathon_query || "") ||
        cleanQuery(context.currentHackathonId || "");

      const resolved = await resolveHackathon(hackathonQuery);
      if (resolved.type === "error") return { result: { error: resolved.error } };
      if (resolved.type === "none") return { result: { error: "Hackathon not found" } };
      if (resolved.type === "many") {
        return {
          result: {
            needs_selection: true,
            message: "I found multiple hackathons. Which one should I use?",
            matches: resolved.matches.map((h: any) => ({
              name: h.name,
              slug: h.slug,
              region: h.region,
              start_date: h.start_date,
              end_date: h.end_date,
              url: h.url,
            })),
          },
        };
      }

      const hackathon = resolved.match;

      if (!pendingConfirmation) {
        return {
          result: null,
          needsConfirmation: true,
          confirmationMessage: `I'll create a team called "${args.team_name}" for "${hackathon.name}". Should I proceed?`,
        };
      }

      const { data: team, error: teamError } = await supabase
        .from("teams")
        .insert({
          name: args.team_name,
          hackathon_id: hackathon.slug,
          created_by: userId,
        })
        .select()
        .single();

      if (teamError) return { result: { error: teamError.message } };

      await supabase.from("team_members").insert({
        team_id: team.id,
        user_id: userId,
        role: "leader",
        is_leader: true,
      });

      return {
        result: {
          success: true,
          message: `Team "${args.team_name}" created for ${hackathon.name}`,
          team_id: team.id,
          hackathon_slug: hackathon.slug,
        },
      };
    }

    case "invite_to_team": {
      // Verify user is team leader
      const { data: membership } = await supabase
        .from("team_members")
        .select("is_leader, role")
        .eq("team_id", args.team_id)
        .eq("user_id", userId)
        .single();

      if (!membership || (!membership.is_leader && membership.role !== "leader")) {
        return { result: { error: "You must be a team leader to invite members" } };
      }

      const who = await resolveUser(args.user_query);
      if (who.type === "error") return { result: { error: who.error } };
      if (who.type === "none") return { result: { error: "User not found" } };
      if (who.type === "many") {
        return {
          result: {
            needs_selection: true,
            message: "I found multiple users. Which one should I invite?",
            matches: who.matches,
          },
        };
      }

      const target = who.match;

      if (!pendingConfirmation) {
        return {
          result: null,
          needsConfirmation: true,
          confirmationMessage: `I'll send a team invitation to ${target.username} (@${target.userid}). Should I proceed?`,
        };
      }

      const { error } = await supabase.from("team_requests").insert({
        team_id: args.team_id,
        from_user_id: userId,
        to_user_id: target.user_id,
      });

      if (error) return { result: { error: error.message } };
      return {
        result: {
          success: true,
          message: `Team invitation sent to ${target.username} (@${target.userid})`,
        },
      };
    }

    case "web_search": {
      const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
      if (!perplexityKey) {
        return { result: { error: "Web search is not configured" } };
      }
      try {
        const response = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${perplexityKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "sonar",
            messages: [
              {
                role: "system",
                content:
                  "Provide concise, factual information. Focus on hackathon-related topics when relevant.",
              },
              { role: "user", content: args.query },
            ],
          }),
        });
        const data = await response.json();
        return {
          result: {
            answer: data.choices?.[0]?.message?.content || "No results found",
            citations: data.citations || [],
          },
        };
      } catch (_e) {
        return { result: { error: "Web search failed" } };
      }
    }

    case "submit_hackathon": {
      if (!pendingConfirmation) {
        return {
          result: null,
          needsConfirmation: true,
          confirmationMessage: `I'll submit "${args.name}" hackathon for admin approval. Should I proceed?`,
        };
      }

      const slug = `${String(args.name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

      const { error } = await supabase.from("hackathons").insert({
        name: args.name,
        description: args.description || "",
        start_date: args.start_date,
        end_date: args.end_date,
        location: args.location,
        region: args.region,
        url: args.url || null,
        organizer: args.organizer || null,
        slug,
        status: "pending",
        submitted_by: userId,
      });

      if (error) return { result: { error: error.message } };
      return {
        result: {
          success: true,
          message: `Hackathon "${args.name}" submitted for approval`,
        },
      };
    }

    case "get_pending_requests": {
      const [friendReqs, teamReqs] = await Promise.all([
        supabase
          .from("friend_requests")
          .select("id, from_user_id, status, created_at")
          .eq("to_user_id", userId)
          .eq("status", "pending"),
        supabase
          .from("team_requests")
          .select("id, team_id, from_user_id, status, created_at")
          .eq("to_user_id", userId)
          .eq("status", "pending"),
      ]);

      return {
        result: {
          friend_requests: friendReqs.data || [],
          team_requests: teamReqs.data || [],
        },
      };
    }

    default:
      return { result: { error: "Unknown action" } };
  }
}

// Helper: get or create conversation summary
async function getConversationSummary(
  supabase: any,
  userId: string
): Promise<{ summary: string; messageCount: number } | null> {
  const { data } = await supabase
    .from("ai_conversation_summaries")
    .select("summary, message_count")
    .eq("user_id", userId)
    .maybeSingle();

  return data ? { summary: data.summary, messageCount: data.message_count } : null;
}

// Helper: update conversation summary (called periodically)
async function updateConversationSummary(
  supabase: any,
  userId: string,
  messages: { role: string; content: string }[],
  apiKey: string
): Promise<void> {
  if (messages.length < 10) return; // need enough context to summarize

  const existing = await getConversationSummary(supabase, userId);

  // Summarize last 20 messages into a rolling summary
  const toSummarize = messages.slice(-20);
  const prompt = existing
    ? `Previous summary:\n${existing.summary}\n\nNew messages:\n${toSummarize
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n")}\n\nCreate a concise, updated summary (max 400 words) of the full conversation so far, focusing on key facts, user preferences, and context needed for future assistance.`
    : `Summarize this conversation (max 400 words), focusing on key facts, user preferences, and context needed for future assistance:\n${toSummarize
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n")}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!resp.ok) return;

    const data = await resp.json();
    const summary = data.choices?.[0]?.message?.content || "";

    if (!summary) return;

    const newCount = (existing?.messageCount || 0) + toSummarize.length;

    await supabase.from("ai_conversation_summaries").upsert(
      {
        user_id: userId,
        summary,
        message_count: newCount,
        last_summarized_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    console.log("Conversation summary updated for user", userId);
  } catch (e) {
    console.error("Failed to update summary:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth token
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      message,
      conversationHistory,
      pendingConfirmation,
      confirmedAction,
      currentHackathonId,
      stream,
    } = await req.json();

    // Check guardrails
    const guardrailCheck = checkGuardrails(message);
    if (guardrailCheck.blocked) {
      return new Response(
        JSON.stringify({ response: guardrailCheck.reason, blocked: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profile for context
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, userid")
      .eq("user_id", user.id)
      .single();

    // Get existing summary for long-term context
    const existingSummary = await getConversationSummary(supabase, user.id);

    // Build system prompt with summary context
    let systemPrompt = `You are HackerBuddy, a helpful AI assistant for a hackathon community platform.

Current user: ${profile?.username || "User"} (@${profile?.userid || "unknown"})

IMPORTANT RULES:
1. Use the database as the source of truth for hackathons, teams, friends, and participations.
2. If a tool returns {needs_selection: true}, show the options and ask the user to choose ONE (usually by slug or userid).
3. For any data-changing action, always ask for confirmation first.
4. Never invent links or hackathons. If a hackathon's url is missing, say it's missing.
5. Be concise and action-oriented.

Available capabilities:
- Search hackathons in the database (partial name supported)
- Get official hackathon links from the database
- View current participations
- Create teams and send requests (with confirmation)
- Search users by username/userid/UUID (partial supported)
- Web search (when needed)`;

    if (existingSummary?.summary) {
      systemPrompt += `\n\nPrevious conversation summary:\n${existingSummary.summary}`;
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build messages for AI (last 20)
    const recentHistory = (conversationHistory || []).slice(-20);
    const messages = [
      { role: "system", content: systemPrompt },
      ...recentHistory,
      { role: "user", content: message },
    ];

    // Periodically update summary (every 20 messages since last summary)
    const totalMessages = (existingSummary?.messageCount || 0) + recentHistory.length + 1;
    const shouldUpdateSummary =
      totalMessages >= 20 && totalMessages % 20 < 5;

    // If this is a confirmation response, execute the pending action
    if (confirmedAction && pendingConfirmation) {
      const result = await executeToolCall(
        confirmedAction.name,
        confirmedAction.arguments,
        supabase,
        user.id,
        true,
        { currentHackathonId }
      );

      // Update summary in background
      if (shouldUpdateSummary) {
        updateConversationSummary(supabase, user.id, recentHistory, LOVABLE_API_KEY);
      }

      return new Response(
        JSON.stringify({
          response: result.result?.success
            ? `✅ ${result.result.message}`
            : `❌ ${result.result?.error || "Action failed"}`,
          toolResults: [result.result],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call AI with tools
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools,
        tool_choice: "auto",
        stream: false, // First call is non-streaming to handle tool calls
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({
            error: "I'm receiving too many requests right now. Please try again in a moment.",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error("AI service error");
    }

    const aiData = await aiResponse.json();
    const choice = aiData.choices?.[0];

    if (!choice) {
      throw new Error("No response from AI");
    }

    // Handle tool calls (non-streaming)
    if (choice.message?.tool_calls?.length > 0) {
      const toolResults = [];
      let pendingConfirmationAction = null;

      for (const toolCall of choice.message.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || "{}");

        console.log(`Executing tool: ${toolName}`, toolArgs);

        const result = await executeToolCall(toolName, toolArgs, supabase, user.id, false, {
          currentHackathonId,
        });

        if (result.needsConfirmation) {
          pendingConfirmationAction = {
            name: toolName,
            arguments: toolArgs,
            message: result.confirmationMessage,
          };
          break;
        }

        toolResults.push({ tool: toolName, result: result.result });
      }

      // If there's a pending confirmation, return it
      if (pendingConfirmationAction) {
        return new Response(
          JSON.stringify({
            response: pendingConfirmationAction.message,
            pendingConfirmation: pendingConfirmationAction,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get AI to summarize tool results - with streaming if requested
      const summaryMessages = [
        ...messages,
        { role: "assistant", content: null, tool_calls: choice.message.tool_calls },
        ...toolResults.map((tr, i) => ({
          role: "tool",
          tool_call_id: choice.message.tool_calls[i].id,
          content: JSON.stringify(tr.result),
        })),
      ];

      if (stream) {
        // SSE streaming for tool result summary
        const summaryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: summaryMessages,
            stream: true,
          }),
        });

        if (!summaryResponse.ok || !summaryResponse.body) {
          throw new Error("Streaming failed");
        }

        // Update summary in background
        if (shouldUpdateSummary) {
          updateConversationSummary(supabase, user.id, recentHistory, LOVABLE_API_KEY);
        }

        return new Response(summaryResponse.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      const summaryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: summaryMessages,
        }),
      });

      const summaryData = await summaryResponse.json();
      const summaryContent =
        summaryData.choices?.[0]?.message?.content || "I completed the action.";

      // Update summary in background
      if (shouldUpdateSummary) {
        updateConversationSummary(supabase, user.id, recentHistory, LOVABLE_API_KEY);
      }

      return new Response(
        JSON.stringify({ response: summaryContent, toolResults }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No tool calls - stream or return directly
    if (stream) {
      // Make a new streaming request
      const streamResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          stream: true,
        }),
      });

      if (!streamResponse.ok || !streamResponse.body) {
        throw new Error("Streaming failed");
      }

      // Update summary in background
      if (shouldUpdateSummary) {
        updateConversationSummary(supabase, user.id, recentHistory, LOVABLE_API_KEY);
      }

      return new Response(streamResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Update summary in background
    if (shouldUpdateSummary) {
      updateConversationSummary(supabase, user.id, recentHistory, LOVABLE_API_KEY);
    }

    // Non-streaming response
    return new Response(
      JSON.stringify({
        response: choice.message?.content || "I'm not sure how to help with that.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("HackerBuddy error:", error);
    return new Response(
      JSON.stringify({
        error: "I encountered an error. Please try again.",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
