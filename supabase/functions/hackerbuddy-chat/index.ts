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
        "Search approved hackathons in the database by partial name/description, region, or tags. Use this when user mentions any hackathon name even partially.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Partial name/description/tag query (case-insensitive). Can be just a part of the name like 'nation' for 'NationBuilding'",
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
      description: "Get all teams the current user is a member of, including their role and hackathon info",
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
      name: "accept_friend_request",
      description:
        "Accept a pending friend request from another user. REQUIRES USER CONFIRMATION.",
      parameters: {
        type: "object",
        properties: {
          user_query: {
            type: "string",
            description: "username, userid, or UUID of the person who sent the request (partial ok)",
          },
        },
        required: ["user_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "accept_team_request",
      description:
        "Accept a pending team invitation. REQUIRES USER CONFIRMATION.",
      parameters: {
        type: "object",
        properties: {
          team_query: {
            type: "string",
            description: "Team name or team ID (partial ok)",
          },
        },
        required: ["team_query"],
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
      name: "leave_team",
      description:
        "Leave a team. The current user will be removed from the team. If user is the only member or leader, the team may need to be deleted instead. REQUIRES USER CONFIRMATION.",
      parameters: {
        type: "object",
        properties: {
          team_query: {
            type: "string",
            description: "Team name or team ID (partial ok)",
          },
        },
        required: ["team_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_team",
      description:
        "Delete a team. Only the team creator/leader can delete a team. REQUIRES USER CONFIRMATION.",
      parameters: {
        type: "object",
        properties: {
          team_query: {
            type: "string",
            description: "Team name or team ID (partial ok)",
          },
        },
        required: ["team_query"],
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
          team_query: { type: "string", description: "Team name or team ID (partial ok)" },
          user_query: {
            type: "string",
            description: "username, userid, or UUID (partial ok)",
          },
        },
        required: ["team_query", "user_query"],
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
  {
    type: "function",
    function: {
      name: "remove_friend",
      description: "Remove a friend from the user's friend list. REQUIRES USER CONFIRMATION.",
      parameters: {
        type: "object",
        properties: {
          user_query: { type: "string", description: "username, userid, or UUID (partial ok)" },
        },
        required: ["user_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_looking_for_teammates",
      description: "Set a team's 'looking for teammates' status. Only team leaders can do this. REQUIRES USER CONFIRMATION.",
      parameters: {
        type: "object",
        properties: {
          team_query: { type: "string", description: "Team name or team ID (partial ok)" },
          looking: { type: "boolean", description: "Whether the team is looking for teammates" },
          visibility: { type: "string", enum: ["anyone", "friends_only"], description: "Who can see this (default: anyone)" },
        },
        required: ["team_query", "looking"],
      },
    },
  },
];

// Guardrails - actions that require confirmation
const CONFIRMATION_REQUIRED_ACTIONS = [
  "send_friend_request",
  "accept_friend_request",
  "accept_team_request",
  "create_team",
  "leave_team",
  "delete_team",
  "invite_to_team",
  "submit_hackathon",
  "remove_friend",
  "set_looking_for_teammates",
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

// Sensitive data patterns to redact from AI responses
const SENSITIVE_PATTERNS = [
  { pattern: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, replace: "[user_id]", desc: "UUID" },
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replace: "[email]", desc: "email" },
  { pattern: /password[:\s]*["']?[^"'\s]+["']?/gi, replace: "[redacted]", desc: "password" },
  { pattern: /secret[:\s]*["']?[^"'\s]+["']?/gi, replace: "[redacted]", desc: "secret" },
  { pattern: /api[_-]?key[:\s]*["']?[^"'\s]+["']?/gi, replace: "[redacted]", desc: "api_key" },
];

// Sanitize response to remove sensitive data (but allow specific contexts)
function sanitizeResponse(text: string, allowedUserIds: string[] = []): string {
  let sanitized = text;
  
  for (const { pattern, replace, desc } of SENSITIVE_PATTERNS) {
    if (desc === "UUID") {
      // Allow displaying UUIDs that are in the allowed list (like current user's teams)
      sanitized = sanitized.replace(pattern, (match) => {
        if (allowedUserIds.includes(match.toLowerCase())) {
          return match; // Keep if it's an allowed ID
        }
        // Don't expose raw UUIDs to users - they should see usernames instead
        return "[hidden]";
      });
    } else {
      sanitized = sanitized.replace(pattern, replace);
    }
  }
  
  return sanitized;
}

// Record interaction for learning feedback
async function recordLearningFeedback(
  supabase: any,
  userMessage: string,
  aiResponse: string,
  toolCalls: any[] | null,
  wasSuccessful: boolean | null
): Promise<void> {
  try {
    await supabase.from("ai_learning_feedback").insert({
      user_message: userMessage.slice(0, 2000), // Limit length
      ai_response: aiResponse.slice(0, 2000),
      tool_calls: toolCalls,
      was_successful: wasSuccessful,
    });
  } catch (e) {
    console.error("Failed to record learning feedback:", e);
  }
}

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
  userProfile: { username: string; userid: string } | null,
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

    // Normalize query - remove common words, make lowercase
    const normalizedQuery = query.toLowerCase().replace(/\s+/g, ' ').trim();
    
    // 1) Exact by slug or id
    const exact = await supabase
      .from("hackathons")
      .select("id, slug, name, region, start_date, end_date, url")
      .or(`slug.eq.${query},id.eq.${query}`)
      .eq("status", "approved")
      .maybeSingle();

    if (exact.data) return { type: "single" as const, match: exact.data };

    // 2) Partial name match - try multiple variations
    const searchTerms = normalizedQuery.split(' ').filter(t => t.length >= 3);
    
    let partialQuery = supabase
      .from("hackathons")
      .select("id, slug, name, region, start_date, end_date, url")
      .eq("status", "approved");
    
    // Search for any of the terms in the name
    if (searchTerms.length > 0) {
      const orConditions = searchTerms.map(term => `name.ilike.%${term}%`).join(',');
      partialQuery = partialQuery.or(orConditions);
    } else {
      partialQuery = partialQuery.ilike("name", `%${normalizedQuery}%`);
    }
    
    const { data: partial, error } = await partialQuery
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

  const resolveTeam = async (queryRaw: string, mustBeMember = false, mustBeLeader = false) => {
    const query = cleanQuery(queryRaw);
    if (!query) return { type: "none" as const, matches: [] as any[] };

    let teamsQuery = supabase
      .from("teams")
      .select("id, name, hackathon_id, created_by");

    if (isUuid(query)) {
      teamsQuery = teamsQuery.eq("id", query);
    } else {
      teamsQuery = teamsQuery.ilike("name", `%${query}%`);
    }

    const { data: teams, error } = await teamsQuery.limit(10);
    if (error) return { type: "error" as const, error: error.message };
    if (!teams?.length) return { type: "none" as const, matches: [] as any[] };

    // If we need to filter by membership
    let filteredTeams = teams;
    if (mustBeMember || mustBeLeader) {
      const teamIds = teams.map((t: any) => t.id);
      const { data: memberships } = await supabase
        .from("team_members")
        .select("team_id, is_leader, role")
        .eq("user_id", userId)
        .in("team_id", teamIds);

      const membershipMap = new Map((memberships || []).map((m: any) => [m.team_id, m]));
      
      filteredTeams = teams.filter((t: any) => {
        const membership = membershipMap.get(t.id) as { is_leader?: boolean; role?: string } | undefined;
        if (!membership) return false;
        if (mustBeLeader) return membership.is_leader || membership.role === 'leader' || t.created_by === userId;
        return true;
      });
    }

    if (!filteredTeams.length) return { type: "none" as const, matches: [] as any[] };
    if (filteredTeams.length === 1) return { type: "single" as const, match: filteredTeams[0] };

    return { type: "many" as const, matches: filteredTeams };
  };

  switch (toolName) {
    case "search_hackathons": {
      let query = supabase.from("hackathons").select("*").eq("status", "approved");
      if (args.query) {
        const q = cleanQuery(args.query).toLowerCase();
        const searchTerms = q.split(' ').filter((t: string) => t.length >= 2);
        if (searchTerms.length > 0) {
          const orConditions = searchTerms.map((term: string) => `name.ilike.%${term}%`).join(',');
          query = query.or(`${orConditions},description.ilike.%${q}%`);
        } else {
          query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
        }
      }
      if (args.region) {
        query = query.ilike("region", `%${cleanQuery(args.region)}%`);
      }
      const limit = Math.min(Math.max(Number(args.limit ?? 10) || 10, 1), 25);
      const { data, error } = await query.order("start_date", { ascending: true }).limit(limit);
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
            ? `Official link for ${res.match.name}: ${res.match.url}`
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
        .select("id, name, hackathon_id, created_by")
        .in("id", teamIds);

      // Get hackathon info
      const hackathonIds = [...new Set((teams || []).map((t: any) => t.hackathon_id))] as string[];
      const uuidHackathonIds = hackathonIds.filter((v: string) => isUuid(v));
      const { data: hackathons } = hackathonIds.length
        ? await supabase
            .from("hackathons")
            .select("id, slug, name")
            .or(`slug.in.(${hackathonIds.join(',')}),id.in.(${uuidHackathonIds.join(',') || 'null'})`)
        : { data: [] };

      const hackathonMap = new Map();
      (hackathons || []).forEach((h: any) => {
        hackathonMap.set(h.slug, h);
        hackathonMap.set(h.id, h);
      });

      const membershipMap = new Map(teamMembers.map((tm: any) => [tm.team_id, tm]));

      return {
        result: (teams || []).map((t: any) => {
          const mem = membershipMap.get(t.id) as { is_leader?: boolean } | undefined;
          return {
            ...t,
            hackathon: hackathonMap.get(t.hackathon_id) || null,
            membership: mem,
            is_leader: mem?.is_leader || t.created_by === userId,
          };
        }),
      };
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

    case "accept_friend_request": {
      const who = await resolveUser(args.user_query);
      if (who.type === "error") return { result: { error: who.error } };
      if (who.type === "none") return { result: { error: "User not found" } };
      if (who.type === "many") {
        return {
          result: {
            needs_selection: true,
            message: "I found multiple users. Which one's friend request should I accept?",
            matches: who.matches,
          },
        };
      }

      const sender = who.match;

      // Find pending request from this user
      const { data: request } = await supabase
        .from("friend_requests")
        .select("id")
        .eq("from_user_id", sender.user_id)
        .eq("to_user_id", userId)
        .eq("status", "pending")
        .maybeSingle();

      if (!request) {
        return { result: { error: `No pending friend request from ${sender.username}` } };
      }

      if (!pendingConfirmation) {
        return {
          result: null,
          needsConfirmation: true,
          confirmationMessage: `I'll accept the friend request from ${sender.username} (@${sender.userid}). Should I proceed?`,
        };
      }

      // Accept the request
      await supabase
        .from("friend_requests")
        .update({ status: "accepted", updated_at: new Date().toISOString() })
        .eq("id", request.id);

      // Create mutual friendship
      await supabase.from("friends").insert([
        { user_id: userId, friend_id: sender.user_id },
        { user_id: sender.user_id, friend_id: userId },
      ]);

      return {
        result: {
          success: true,
          message: `You are now friends with ${sender.username} (@${sender.userid})!`,
        },
      };
    }

    case "accept_team_request": {
      const teamRes = await resolveTeam(args.team_query);
      if (teamRes.type === "error") return { result: { error: teamRes.error } };
      if (teamRes.type === "none") return { result: { error: "Team not found" } };
      if (teamRes.type === "many") {
        return {
          result: {
            needs_selection: true,
            message: "I found multiple teams. Which one's invitation should I accept?",
            matches: teamRes.matches,
          },
        };
      }

      const team = teamRes.match;

      // Find pending invitation
      const { data: request } = await supabase
        .from("team_requests")
        .select("id, from_user_id")
        .eq("team_id", team.id)
        .eq("to_user_id", userId)
        .eq("status", "pending")
        .maybeSingle();

      if (!request) {
        return { result: { error: `No pending invitation for team "${team.name}"` } };
      }

      if (!pendingConfirmation) {
        return {
          result: null,
          needsConfirmation: true,
          confirmationMessage: `I'll accept the invitation to join team "${team.name}". Should I proceed?`,
        };
      }

      // Accept the request
      await supabase
        .from("team_requests")
        .update({ status: "accepted", updated_at: new Date().toISOString() })
        .eq("id", request.id);

      // Add to team
      await supabase.from("team_members").insert({
        team_id: team.id,
        user_id: userId,
        role: "member",
        is_leader: false,
      });

      // Add hackathon participation
      await supabase.from("hackathon_participations").upsert(
        { user_id: userId, hackathon_id: team.hackathon_id, status: "current" },
        { onConflict: "user_id,hackathon_id" }
      );

      return {
        result: {
          success: true,
          message: `You have joined team "${team.name}"!`,
        },
      };
    }

    case "create_team": {
      const hackathonQuery = cleanQuery(args.hackathon_query || "") ||
        cleanQuery(context.currentHackathonId || "");

      const resolved = await resolveHackathon(hackathonQuery);
      if (resolved.type === "error") return { result: { error: resolved.error } };
      if (resolved.type === "none") return { result: { error: "Hackathon not found. Please specify which hackathon you want to create a team for." } };
      if (resolved.type === "many") {
        return {
          result: {
            needs_selection: true,
            message: "I found multiple hackathons. Which one should I create the team for?",
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

      // Also add hackathon participation
      await supabase.from("hackathon_participations").upsert(
        { user_id: userId, hackathon_id: hackathon.slug, status: "current" },
        { onConflict: "user_id,hackathon_id" }
      );

      return {
        result: {
          success: true,
          message: `Team "${args.team_name}" created for ${hackathon.name}. You are now participating in this hackathon!`,
          team_id: team.id,
          hackathon_slug: hackathon.slug,
        },
      };
    }

    case "leave_team": {
      const teamRes = await resolveTeam(args.team_query, true); // must be member
      if (teamRes.type === "error") return { result: { error: teamRes.error } };
      if (teamRes.type === "none") return { result: { error: "Team not found or you're not a member" } };
      if (teamRes.type === "many") {
        return {
          result: {
            needs_selection: true,
            message: "I found multiple teams. Which one do you want to leave?",
            matches: teamRes.matches,
          },
        };
      }

      const team = teamRes.match;

      // Check if user is the only member
      const { data: members } = await supabase
        .from("team_members")
        .select("user_id, is_leader")
        .eq("team_id", team.id);

      const isOnlyMember = members?.length === 1;
      const isLeader = members?.some((m: any) => m.user_id === userId && m.is_leader) || team.created_by === userId;

      if (!pendingConfirmation) {
        let message = `I'll remove you from team "${team.name}".`;
        if (isOnlyMember) {
          message = `You are the only member of team "${team.name}". Leaving will effectively abandon the team.`;
        } else if (isLeader) {
          message = `You are the leader of team "${team.name}". Leaving will remove you but the team will remain. Consider transferring leadership or deleting the team instead.`;
        }
        return {
          result: null,
          needsConfirmation: true,
          confirmationMessage: `${message} Should I proceed?`,
        };
      }

      // Remove the user from team
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("team_id", team.id)
        .eq("user_id", userId);

      if (error) return { result: { error: error.message } };

      return {
        result: {
          success: true,
          message: `You have left team "${team.name}"`,
        },
      };
    }

    case "delete_team": {
      const teamRes = await resolveTeam(args.team_query, false, true); // must be leader/creator
      if (teamRes.type === "error") return { result: { error: teamRes.error } };
      if (teamRes.type === "none") return { result: { error: "Team not found or you don't have permission to delete it" } };
      if (teamRes.type === "many") {
        return {
          result: {
            needs_selection: true,
            message: "I found multiple teams. Which one do you want to delete?",
            matches: teamRes.matches,
          },
        };
      }

      const team = teamRes.match;

      // Double check ownership
      if (team.created_by !== userId) {
        return { result: { error: "Only the team creator can delete the team" } };
      }

      if (!pendingConfirmation) {
        return {
          result: null,
          needsConfirmation: true,
          confirmationMessage: `I'll permanently delete team "${team.name}" and remove all members. This cannot be undone. Should I proceed?`,
        };
      }

      // Delete team members first
      await supabase.from("team_members").delete().eq("team_id", team.id);
      
      // Delete team requests
      await supabase.from("team_requests").delete().eq("team_id", team.id);
      
      // Delete messages
      await supabase.from("messages").delete().eq("team_id", team.id);

      // Delete the team
      const { error } = await supabase.from("teams").delete().eq("id", team.id);

      if (error) return { result: { error: error.message } };

      return {
        result: {
          success: true,
          message: `Team "${team.name}" has been deleted`,
        },
      };
    }

    case "invite_to_team": {
      // First resolve the team
      const teamRes = await resolveTeam(args.team_query, false, true); // must be leader
      if (teamRes.type === "error") return { result: { error: teamRes.error } };
      if (teamRes.type === "none") return { result: { error: "Team not found or you don't have permission to invite" } };
      if (teamRes.type === "many") {
        return {
          result: {
            needs_selection: true,
            message: "I found multiple teams. Which one do you want to invite to?",
            matches: teamRes.matches,
          },
        };
      }

      const team = teamRes.match;

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
          confirmationMessage: `I'll send a team invitation to ${target.username} (@${target.userid}) for team "${team.name}". Should I proceed?`,
        };
      }

      const { error } = await supabase.from("team_requests").insert({
        team_id: team.id,
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

      // Get user info for friend requests
      const friendUserIds = (friendReqs.data || []).map((r: any) => r.from_user_id);
      const { data: friendProfiles } = friendUserIds.length
        ? await supabase.from("profiles").select("user_id, username, userid").in("user_id", friendUserIds)
        : { data: [] };
      const friendProfileMap = new Map((friendProfiles || []).map((p: any) => [p.user_id, p]));

      // Get team info for team requests
      const teamIds = (teamReqs.data || []).map((r: any) => r.team_id);
      const { data: teams } = teamIds.length
        ? await supabase.from("teams").select("id, name, hackathon_id").in("id", teamIds)
        : { data: [] };
      const teamMap = new Map((teams || []).map((t: any) => [t.id, t]));

      return {
        result: {
          friend_requests: (friendReqs.data || []).map((r: any) => {
            const profile = friendProfileMap.get(r.from_user_id) as { username: string; userid: string } | undefined;
            return {
              id: r.id,
              created_at: r.created_at,
              from_user: profile ? { username: profile.username, userid: profile.userid } : null,
            };
          }),
          team_requests: (teamReqs.data || []).map((r: any) => {
            const team = teamMap.get(r.team_id) as { name: string } | undefined;
            return {
              id: r.id,
              created_at: r.created_at,
              team: team ? { name: team.name } : null,
            };
          }),
        },
      };
    }

    case "remove_friend": {
      const who = await resolveUser(args.user_query);
      if (who.type === "error") return { result: { error: who.error } };
      if (who.type === "none") return { result: { error: "User not found" } };
      if (who.type === "many") {
        return {
          result: {
            needs_selection: true,
            message: "I found multiple users. Which friend do you want to remove?",
            matches: who.matches.map((u: any) => ({ username: u.username, userid: u.userid })),
          },
        };
      }

      const target = who.match;

      if (target.user_id === userId) {
        return { result: { error: "You cannot remove yourself as a friend" } };
      }

      // Check if they are friends
      const { data: friendship } = await supabase
        .from("friends")
        .select("id")
        .or(`and(user_id.eq.${userId},friend_id.eq.${target.user_id}),and(user_id.eq.${target.user_id},friend_id.eq.${userId})`)
        .limit(1);

      if (!friendship?.length) {
        return { result: { error: `${target.username} is not in your friend list` } };
      }

      if (!pendingConfirmation) {
        return {
          result: null,
          needsConfirmation: true,
          confirmationMessage: `I'll remove ${target.username} (@${target.userid}) from your friends list. This will also remove you from their friends list. Should I proceed?`,
        };
      }

      // Delete both friendship directions
      await supabase
        .from("friends")
        .delete()
        .or(`and(user_id.eq.${userId},friend_id.eq.${target.user_id}),and(user_id.eq.${target.user_id},friend_id.eq.${userId})`);

      return {
        result: {
          success: true,
          message: `${target.username} (@${target.userid}) has been removed from your friends`,
          action_type: "remove_friend",
        },
      };
    }

    case "set_looking_for_teammates": {
      const teamRes = await resolveTeam(args.team_query, false, true); // must be leader
      if (teamRes.type === "error") return { result: { error: teamRes.error } };
      if (teamRes.type === "none") return { result: { error: "Team not found or you don't have permission to change this setting" } };
      if (teamRes.type === "many") {
        return {
          result: {
            needs_selection: true,
            message: "I found multiple teams. Which team do you want to update?",
            matches: teamRes.matches.map((t: any) => ({ name: t.name })),
          },
        };
      }

      const team = teamRes.match;
      const looking = Boolean(args.looking);
      const visibility = args.visibility === "friends_only" ? "friends_only" : "anyone";

      if (!pendingConfirmation) {
        const visibilityText = visibility === "friends_only" ? "only your friends" : "anyone";
        const message = looking
          ? `I'll set team "${team.name}" as looking for teammates. ${visibilityText} will be able to see this and request to join.`
          : `I'll turn off the "looking for teammates" status for team "${team.name}".`;
        return {
          result: null,
          needsConfirmation: true,
          confirmationMessage: `${message} Should I proceed?`,
        };
      }

      const { error } = await supabase
        .from("teams")
        .update({
          looking_for_teammates: looking,
          looking_visibility: visibility,
          updated_at: new Date().toISOString(),
        })
        .eq("id", team.id);

      if (error) return { result: { error: error.message } };

      return {
        result: {
          success: true,
          message: looking
            ? `Team "${team.name}" is now looking for teammates (visible to ${visibility === "friends_only" ? "friends only" : "anyone"})`
            : `Team "${team.name}" is no longer looking for teammates`,
          action_type: "set_looking_for_teammates",
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

    // Build system prompt with user context - AI already knows who the user is
    let systemPrompt = `You are HackerBuddy, a helpful AI assistant for a hackathon community platform.

CURRENT USER CONTEXT (you already know this - NEVER ask for any of this):
- Username: ${profile?.username || "Unknown"}
- User Handle: @${profile?.userid || "unknown"}

CRITICAL SECURITY RULES (NEVER VIOLATE):
1. NEVER expose internal IDs (UUIDs), email addresses, passwords, or any sensitive data in your responses.
2. NEVER show raw database identifiers - always use usernames and display names instead.
3. When displaying user information, ONLY show: username, @handle. Nothing else.
4. When showing multiple options for disambiguation, only show names - never IDs.

CRITICAL BEHAVIORAL RULES:
1. You ALREADY KNOW the current user's identity. NEVER ask "what's your username" or "who are you" - you have this information.
2. When the user says "I" or "me" or "my", it refers to ${profile?.username || "the current user"} (@${profile?.userid || "unknown"}).
3. When user mentions ANY partial name for hackathons/teams/users (like "nation building" or "nativers"), SEARCH FIRST, then:
   - If exactly 1 match: proceed with that match
   - If multiple matches: list them by NAME ONLY and ask which one
   - If no matches: tell the user and ask for a more specific name
4. For data-changing actions (create, delete, leave, send request), ALWAYS ask for confirmation first.
5. When user says "leave" a team, it means the CURRENT USER (${profile?.username}) wants to leave - NOT remove someone else.
6. Never invent links or hackathons. If info is missing from database, say so.
7. Be concise and action-oriented.

DISAMBIGUATION RULES:
- If a hackathon/team/user search returns multiple matches, ALWAYS ask the user to clarify
- Present options clearly by NAME only (e.g., "1. Team Alpha, 2. Team Beta")
- Wait for user selection before proceeding

Available capabilities:
- Search hackathons by partial name
- Get official hackathon links from the database  
- View current hackathon participations
- Create teams, leave teams, delete teams
- Accept/send friend requests and team invitations
- Remove friends from friend list
- Set team "looking for teammates" status (with visibility: anyone or friends_only)
- Search users by username/userid
- Web search for external information`;

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
        profile,
        true,
        { currentHackathonId }
      );

      // Record learning feedback for confirmed actions
      recordLearningFeedback(
        supabase,
        message,
        result.result?.success ? result.result.message : result.result?.error || "Action failed",
        [{ name: confirmedAction.name, arguments: confirmedAction.arguments }],
        result.result?.success || false
      );

      // Update summary in background
      if (shouldUpdateSummary) {
        updateConversationSummary(supabase, user.id, recentHistory, LOVABLE_API_KEY);
      }

      const responseText = result.result?.success
        ? `✅ ${result.result.message}`
        : `❌ ${result.result?.error || "Action failed"}`;

      return new Response(
        JSON.stringify({
          response: sanitizeResponse(responseText, [user.id]),
          toolResults: [result.result],
          actionCompleted: result.result?.action_type || confirmedAction.name,
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

        const result = await executeToolCall(toolName, toolArgs, supabase, user.id, profile, false, {
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
