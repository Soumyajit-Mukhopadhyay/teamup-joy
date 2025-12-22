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
      description: "Search for hackathons in the database by name, region, or tags",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query for hackathon name or description" },
          region: { type: "string", description: "Filter by region" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for information about hackathons, technologies, or any topic the user asks about",
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
      description: "Send a friend request to another user. REQUIRES USER CONFIRMATION.",
      parameters: {
        type: "object",
        properties: {
          to_userid: { type: "string", description: "The unique userid (not UUID) of the person to send request to" },
        },
        required: ["to_userid"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_team",
      description: "Create a new team for a hackathon. REQUIRES USER CONFIRMATION.",
      parameters: {
        type: "object",
        properties: {
          team_name: { type: "string", description: "Name of the team" },
          hackathon_slug: { type: "string", description: "The slug/id of the hackathon" },
        },
        required: ["team_name", "hackathon_slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "invite_to_team",
      description: "Invite a user to join a team. REQUIRES USER CONFIRMATION.",
      parameters: {
        type: "object",
        properties: {
          team_id: { type: "string", description: "UUID of the team" },
          to_userid: { type: "string", description: "The unique userid of the person to invite" },
        },
        required: ["team_id", "to_userid"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_hackathon",
      description: "Submit a new hackathon for admin approval. REQUIRES USER CONFIRMATION.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the hackathon" },
          description: { type: "string", description: "Description of the hackathon" },
          start_date: { type: "string", description: "Start date in ISO format" },
          end_date: { type: "string", description: "End date in ISO format" },
          location: { type: "string", description: "Location (city or Online)" },
          region: { type: "string", description: "Region (e.g., North America, Europe, Asia, Global)" },
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
  pendingConfirmation: boolean
): Promise<{ result: any; needsConfirmation?: boolean; confirmationMessage?: string }> {
  
  // Check if action needs confirmation and hasn't been confirmed
  if (CONFIRMATION_REQUIRED_ACTIONS.includes(toolName) && !pendingConfirmation) {
    let message = "";
    switch (toolName) {
      case "send_friend_request":
        message = `I'll send a friend request to @${args.to_userid}. Should I proceed?`;
        break;
      case "create_team":
        message = `I'll create a team called "${args.team_name}" for the hackathon. Should I proceed?`;
        break;
      case "invite_to_team":
        message = `I'll send a team invitation to @${args.to_userid}. Should I proceed?`;
        break;
      case "submit_hackathon":
        message = `I'll submit "${args.name}" hackathon for admin approval. Should I proceed?`;
        break;
    }
    return { result: null, needsConfirmation: true, confirmationMessage: message };
  }

  switch (toolName) {
    case "search_hackathons": {
      let query = supabase.from("hackathons").select("*").eq("status", "approved");
      if (args.query) {
        query = query.or(`name.ilike.%${args.query}%,description.ilike.%${args.query}%`);
      }
      if (args.region) {
        query = query.ilike("region", `%${args.region}%`);
      }
      const { data, error } = await query.limit(10);
      if (error) return { result: { error: error.message } };
      return { result: data || [] };
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
              { role: "system", content: "Provide concise, factual information. Focus on hackathon-related topics when relevant." },
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
      } catch (e) {
        return { result: { error: "Web search failed" } };
      }
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
        .select("userid, username")
        .in("user_id", friendIds);
      
      return { result: profiles || [] };
    }

    case "send_friend_request": {
      // Find user by userid
      const { data: targetUser } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("userid", args.to_userid)
        .single();
      
      if (!targetUser) return { result: { error: `User @${args.to_userid} not found` } };
      
      if (targetUser.user_id === userId) {
        return { result: { error: "You cannot send a friend request to yourself" } };
      }
      
      // Check if already friends
      const { data: existing } = await supabase
        .from("friends")
        .select("id")
        .eq("user_id", userId)
        .eq("friend_id", targetUser.user_id)
        .maybeSingle();
      
      if (existing) return { result: { error: "You are already friends with this user" } };
      
      // Check for pending request
      const { data: pendingReq } = await supabase
        .from("friend_requests")
        .select("id")
        .eq("from_user_id", userId)
        .eq("to_user_id", targetUser.user_id)
        .eq("status", "pending")
        .maybeSingle();
      
      if (pendingReq) return { result: { error: "Friend request already pending" } };
      
      const { error } = await supabase
        .from("friend_requests")
        .insert({ from_user_id: userId, to_user_id: targetUser.user_id });
      
      if (error) return { result: { error: error.message } };
      return { result: { success: true, message: `Friend request sent to @${args.to_userid}` } };
    }

    case "create_team": {
      // Verify hackathon exists
      const { data: hackathon } = await supabase
        .from("hackathons")
        .select("id, slug, name")
        .or(`slug.eq.${args.hackathon_slug},id.eq.${args.hackathon_slug}`)
        .eq("status", "approved")
        .single();
      
      if (!hackathon) return { result: { error: "Hackathon not found" } };
      
      // Create team
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
      
      // Add creator as team leader
      await supabase.from("team_members").insert({
        team_id: team.id,
        user_id: userId,
        role: "leader",
        is_leader: true,
      });
      
      return { result: { success: true, message: `Team "${args.team_name}" created for ${hackathon.name}`, team_id: team.id } };
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
      
      // Find target user
      const { data: targetUser } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("userid", args.to_userid)
        .single();
      
      if (!targetUser) return { result: { error: `User @${args.to_userid} not found` } };
      
      // Send team request
      const { error } = await supabase.from("team_requests").insert({
        team_id: args.team_id,
        from_user_id: userId,
        to_user_id: targetUser.user_id,
      });
      
      if (error) return { result: { error: error.message } };
      return { result: { success: true, message: `Team invitation sent to @${args.to_userid}` } };
    }

    case "submit_hackathon": {
      const slug = `${args.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
      
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
      return { result: { success: true, message: `Hackathon "${args.name}" submitted for approval` } };
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
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message, conversationHistory, pendingConfirmation, confirmedAction } = await req.json();

    // Check guardrails
    const guardrailCheck = checkGuardrails(message);
    if (guardrailCheck.blocked) {
      return new Response(JSON.stringify({ 
        response: guardrailCheck.reason,
        blocked: true 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile for context
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, userid")
      .eq("user_id", user.id)
      .single();

    // Build system prompt
    const systemPrompt = `You are HackerBuddy, a helpful AI assistant for a hackathon community platform. 
Your role is to help users:
- Find and learn about hackathons
- Create and manage teams
- Connect with other hackers
- Submit new hackathons for approval

Current user: ${profile?.username || "User"} (@${profile?.userid || "unknown"})

IMPORTANT RULES:
1. Only perform actions for the current user. Never access or modify other users' private data.
2. For actions that modify data (create team, send friend request, etc.), always ask for confirmation first.
3. If you cannot find information or perform an action, clearly say so. Never make up data.
4. Be friendly, concise, and helpful.
5. When searching for hackathons or information, use the available tools.
6. For web searches, focus on hackathon-related information.

Available capabilities:
- Search hackathons in the database
- Search the web for hackathon information
- View user's teams and friends
- Send friend requests (with confirmation)
- Create teams for hackathons (with confirmation)
- Invite users to teams (with confirmation)
- Submit new hackathons (with confirmation)
- View pending requests`;

    // Build messages for AI
    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversationHistory || []).slice(-10),
      { role: "user", content: message },
    ];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // If this is a confirmation response, execute the pending action
    if (confirmedAction && pendingConfirmation) {
      const result = await executeToolCall(
        confirmedAction.name,
        confirmedAction.arguments,
        supabase,
        user.id,
        true
      );
      
      return new Response(JSON.stringify({
        response: result.result.success 
          ? `✅ ${result.result.message}` 
          : `❌ ${result.result.error || "Action failed"}`,
        toolResults: [result.result],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ 
          error: "I'm receiving too many requests right now. Please try again in a moment." 
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error("AI service error");
    }

    const aiData = await aiResponse.json();
    const choice = aiData.choices?.[0];

    if (!choice) {
      throw new Error("No response from AI");
    }

    // Handle tool calls
    if (choice.message?.tool_calls?.length > 0) {
      const toolResults = [];
      let pendingConfirmationAction = null;

      for (const toolCall of choice.message.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || "{}");
        
        console.log(`Executing tool: ${toolName}`, toolArgs);
        
        const result = await executeToolCall(toolName, toolArgs, supabase, user.id, false);
        
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
        return new Response(JSON.stringify({
          response: pendingConfirmationAction.message,
          pendingConfirmation: pendingConfirmationAction,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get AI to summarize tool results
      const summaryMessages = [
        ...messages,
        { role: "assistant", content: null, tool_calls: choice.message.tool_calls },
        ...toolResults.map((tr, i) => ({
          role: "tool",
          tool_call_id: choice.message.tool_calls[i].id,
          content: JSON.stringify(tr.result),
        })),
      ];

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
      const summaryContent = summaryData.choices?.[0]?.message?.content || "I completed the action.";

      return new Response(JSON.stringify({
        response: summaryContent,
        toolResults,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No tool calls, just return the response
    return new Response(JSON.stringify({
      response: choice.message?.content || "I'm not sure how to help with that.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("HackerBuddy error:", error);
    return new Response(JSON.stringify({ 
      error: "I encountered an error. Please try again.",
      details: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
