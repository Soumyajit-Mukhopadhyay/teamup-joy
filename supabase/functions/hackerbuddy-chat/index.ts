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
        "Create a new team for a hackathon. Hackathon can be provided as slug/id/name (partial ok). Ask user about 'looking for teammates' option. REQUIRES USER CONFIRMATION.",
      parameters: {
        type: "object",
        properties: {
          team_name: { type: "string", description: "Name of the team" },
          hackathon_query: {
            type: "string",
            description:
              "Hackathon slug/id/name (partial ok). If omitted, use the currently-open hackathon page if available.",
          },
          looking_for_teammates: {
            type: "boolean",
            description: "Whether the team is looking for teammates. Ask user if they want this option.",
          },
          looking_visibility: {
            type: "string",
            enum: ["anyone", "friends_only"],
            description: "Who can see the team is looking for teammates. 'anyone' = visible to all, 'friends_only' = only friends (and notifies friends).",
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
      name: "leave_all_teams_for_hackathon",
      description:
        "Leave ALL teams the current user is a member of for a given hackathon (by name/slug/id). REQUIRES USER CONFIRMATION.",
      parameters: {
        type: "object",
        properties: {
          hackathon_query: {
            type: "string",
            description: "Hackathon name/slug/id (partial ok)",
          },
        },
        required: ["hackathon_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "leave_all_teams_globally",
      description:
        "Leave ALL teams from ALL hackathons. First lists all teams the user is in, then asks for confirmation before leaving each one. Use this when user says 'leave all my teams' without specifying a hackathon. REQUIRES USER CONFIRMATION.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
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
      name: "request_to_join_team",
      description:
        "Send a request to join a team that is looking for teammates. REQUIRES USER CONFIRMATION.",
      parameters: {
        type: "object",
        properties: {
          team_query: { type: "string", description: "Team name or team ID (partial ok)" },
          hackathon_query: { type: "string", description: "Hackathon name/slug (partial ok) to narrow down team search" },
        },
        required: ["team_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_teams_looking_for_teammates",
      description:
        "Get all teams that are looking for teammates for a specific hackathon. Shows teams with 'anyone' visibility and teams with 'friends_only' visibility if the user is friends with the leader.",
      parameters: {
        type: "object",
        properties: {
          hackathon_query: { type: "string", description: "Hackathon name/slug/id (partial ok)" },
        },
        required: ["hackathon_query"],
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
  {
    type: "function",
    function: {
      name: "remove_team_member",
      description: "Remove a member from a team. Only team leaders can remove members (not themselves). REQUIRES USER CONFIRMATION.",
      parameters: {
        type: "object",
        properties: {
          team_query: { type: "string", description: "Team name or team ID (partial ok)" },
          user_query: { type: "string", description: "Username or userid of the member to remove (partial ok)" },
        },
        required: ["team_query", "user_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_current_datetime",
      description: "Get the current date and time. Use this when user asks about the current time or date.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get current weather information for a location",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name or location (e.g., 'New York', 'London', 'Tokyo')" },
        },
        required: ["location"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_hackathon_calendar_link",
      description: "Generate a Google Calendar link to add a hackathon to the user's calendar",
      parameters: {
        type: "object",
        properties: {
          hackathon_query: { type: "string", description: "Hackathon name/slug/id (partial ok)" },
        },
        required: ["hackathon_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_hackathon_share_link",
      description: "Generate a shareable link for a hackathon",
      parameters: {
        type: "object",
        properties: {
          hackathon_query: { type: "string", description: "Hackathon name/slug/id (partial ok)" },
        },
        required: ["hackathon_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "visit_hackathon_website",
      description: "Get the official website URL for a hackathon. If no URL is available, inform the user it's updating soon.",
      parameters: {
        type: "object",
        properties: {
          hackathon_query: { type: "string", description: "Hackathon name/slug/id (partial ok)" },
        },
        required: ["hackathon_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate_to_page",
      description: "Navigate the user to a specific page in the app. Use this when guiding users to find features.",
      parameters: {
        type: "object",
        properties: {
          path: { 
            type: "string", 
            description: "The page path to navigate to (e.g., '/friends', '/teams', '/profile', '/notifications', '/hackathon/slug-name')" 
          },
          description: {
            type: "string",
            description: "Brief description of what's on this page"
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "admin_train_ai",
      description: "ADMIN ONLY: Add a training example to teach the AI new patterns. Only admins can use this. Format: example request → expected tool sequence.",
      parameters: {
        type: "object",
        properties: {
          example_request: { 
            type: "string", 
            description: "The example user request/message" 
          },
          tool_sequence: {
            type: "array",
            items: { type: "string" },
            description: "The sequence of tools that should be called for this request"
          },
          expected_response: {
            type: "string",
            description: "Optional: The expected AI response summary"
          },
        },
        required: ["example_request", "tool_sequence"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_ai_learning_stats",
      description: "ADMIN ONLY: Get statistics about AI learning patterns and success rates.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_ai_pattern",
      description: "ADMIN ONLY: Delete a learned pattern by its hash or description.",
      parameters: {
        type: "object",
        properties: {
          pattern_query: { 
            type: "string", 
            description: "Pattern hash or part of the example request to find and delete" 
          },
        },
        required: ["pattern_query"],
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
  "leave_all_teams_for_hackathon",
  "leave_all_teams_globally",
  "delete_team",
  "invite_to_team",
  "submit_hackathon",
  "remove_friend",
  "set_looking_for_teammates",
  "remove_team_member",
  "request_to_join_team",
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
  { pattern: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, replace: "", desc: "UUID" },
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replace: "[email hidden]", desc: "email" },
  { pattern: /password[:\s]*["']?[^"'\s]+["']?/gi, replace: "[redacted]", desc: "password" },
  { pattern: /secret[:\s]*["']?[^"'\s]+["']?/gi, replace: "[redacted]", desc: "secret" },
  { pattern: /api[_-]?key[:\s]*["']?[^"'\s]+["']?/gi, replace: "[redacted]", desc: "api_key" },
];

// Sanitize response to remove ALL UUIDs - never show them to users
function sanitizeResponse(text: string): string {
  let sanitized = text;
  
  for (const { pattern, replace, desc } of SENSITIVE_PATTERNS) {
    if (desc === "UUID") {
      // Remove ALL UUIDs - they should never be shown to users
      // Also clean up surrounding artifacts like backticks, parentheses
      sanitized = sanitized.replace(new RegExp(`\\(\`?${pattern.source}\`?\\)`, 'gi'), '');
      sanitized = sanitized.replace(new RegExp(`\`${pattern.source}\``, 'gi'), '');
      sanitized = sanitized.replace(pattern, replace);
    } else {
      sanitized = sanitized.replace(pattern, replace);
    }
  }
  
  // Clean up double spaces and orphaned punctuation
  sanitized = sanitized.replace(/\s{2,}/g, ' ');
  sanitized = sanitized.replace(/\(\s*\)/g, '');
  
  return sanitized.trim();
}

// Generate a pattern hash from user message for pattern matching
function generatePatternHash(message: string): string {
  // Normalize the message: lowercase, remove specific names/numbers, keep action words
  const normalized = message
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/\b\d+\b/g, 'NUM')
    .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, 'UUID')
    .replace(/@\w+/g, '@USER')
    .replace(/\b(team\d+|team\s*\d+)\b/gi, 'TEAMNAME')
    .trim();
  
  // Extract action keywords
  const actionWords = ['create', 'add', 'remove', 'delete', 'leave', 'join', 'send', 'accept', 'invite', 'search', 'find', 'open', 'share', 'calendar'];
  const foundActions = actionWords.filter(word => normalized.includes(word)).sort().join('_');
  
  // Simple hash based on action pattern
  return foundActions || 'general';
}

// Classify request type for pattern learning
function classifyRequestType(toolCalls: any[]): string {
  if (!toolCalls?.length) return 'conversation';
  
  const toolNames = toolCalls.map(t => t.name || t.function?.name).filter(Boolean);
  
  if (toolNames.length > 2) return 'multi_task_complex';
  if (toolNames.length === 2) return 'multi_task_simple';
  
  if (toolNames.some(n => n?.includes('team'))) return 'team_management';
  if (toolNames.some(n => n?.includes('friend'))) return 'friend_management';
  if (toolNames.some(n => n?.includes('hackathon'))) return 'hackathon_action';
  if (toolNames.some(n => n?.includes('navigate'))) return 'navigation';
  
  return 'single_task';
}

// Check if a task is complex enough to learn from
function isComplexTask(
  toolCalls: any[] | null,
  userMessage: string,
  conversationTurnCount: number = 1
): boolean {
  const toolCount = toolCalls?.length || 0;
  
  // RULE 1: Multi-task (3+ tools) is always worth learning
  if (toolCount >= 3) return true;
  
  // RULE 2: Multi-turn conversations (user had to clarify/correct AI)
  if (conversationTurnCount >= 3) return true;
  
  // RULE 3: Long, detailed user requests (100+ chars with multiple action words)
  const actionWords = ['create', 'add', 'remove', 'delete', 'leave', 'join', 'send', 'accept', 
                       'invite', 'search', 'find', 'open', 'share', 'navigate', 'and', 'then', 'also'];
  const foundActions = actionWords.filter(word => userMessage.toLowerCase().includes(word));
  if (userMessage.length >= 100 && foundActions.length >= 3) return true;
  
  // RULE 4: Compound requests with "and", "then", "also"
  const compoundWords = ['and then', 'and also', 'then also', 'after that'];
  if (compoundWords.some(w => userMessage.toLowerCase().includes(w))) return true;
  
  // Simple single-task requests are NOT worth learning (avoid noise)
  return false;
}

// Record interaction for learning feedback with enhanced pattern tracking
// ONLY learns from complex multi-task or multi-turn conversations
async function recordLearningFeedback(
  supabase: any,
  userMessage: string,
  aiResponse: string,
  toolCalls: any[] | null,
  wasSuccessful: boolean | null,
  executionTimeMs?: number,
  isMultiTask: boolean = false,
  conversationTurnCount: number = 1,
  userFeedback?: string
): Promise<void> {
  try {
    const toolSequence = toolCalls?.map(t => t.name || t.function?.name).filter(Boolean) || [];
    const patternHash = generatePatternHash(userMessage);
    const requestType = classifyRequestType(toolCalls || []);
    
    // Quality check: only record if we have meaningful data
    if (!userMessage.trim() || (toolCalls && toolCalls.length === 0)) {
      return;
    }
    
    // COMPLEXITY CHECK: Only store feedback for complex tasks
    const isComplex = isComplexTask(toolCalls, userMessage, conversationTurnCount);
    
    // Always record feedback for tracking (but won't learn from simple tasks)
    await supabase.from("ai_learning_feedback").insert({
      user_message: userMessage.slice(0, 2000),
      ai_response: aiResponse.slice(0, 2000),
      tool_calls: toolCalls,
      was_successful: wasSuccessful,
      tool_sequence: toolSequence,
      request_type: isComplex ? requestType : 'simple_ignored',
      multi_task_count: toolSequence.length,
      execution_time_ms: executionTimeMs,
      pattern_hash: patternHash,
      feedback_notes: userFeedback || null,
    });
    
    // ONLY learn patterns from complex successful tasks
    if (wasSuccessful && toolSequence.length > 0 && isComplex) {
      console.log(`Learning from complex task: ${toolSequence.length} tools, ${conversationTurnCount} turns`);
      await updateLearnedPattern(
        supabase, 
        patternHash, 
        userMessage, 
        aiResponse, 
        toolSequence,
        isMultiTask
      );
    } else if (!isComplex && toolSequence.length > 0) {
      console.log(`Skipping simple task learning: "${userMessage.slice(0, 50)}..."`);
    }
  } catch (e) {
    console.error("Failed to record learning feedback:", e);
  }
}

// Update or create a learned pattern based on successful interaction
// With quality controls to prevent bad patterns
async function updateLearnedPattern(
  supabase: any,
  patternHash: string,
  userMessage: string,
  aiResponse: string,
  toolSequence: string[],
  isMultiTask: boolean = false
): Promise<void> {
  try {
    // QUALITY CONTROLS:
    // 1. Don't learn from very short messages (could be noise)
    if (userMessage.trim().length < 10) {
      console.log("Skipping pattern: message too short");
      return;
    }
    
    // 2. Don't learn from messages with blocked patterns
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(userMessage)) {
        console.log("Skipping pattern: contains blocked content");
        return;
      }
    }
    
    // 3. Multi-task patterns get priority (they're more valuable)
    const successIncrement = isMultiTask ? 2 : 1;
    
    // Try to find existing pattern
    const { data: existing } = await supabase
      .from("ai_learned_patterns")
      .select("id, success_count, failure_count, tool_sequence")
      .eq("pattern_hash", patternHash)
      .maybeSingle();
    
    if (existing) {
      // 4. If new tool sequence is different but success rate is high, don't overwrite
      const currentRate = existing.success_count / (existing.success_count + existing.failure_count + 1);
      const sequenceChanged = JSON.stringify(existing.tool_sequence) !== JSON.stringify(toolSequence);
      
      if (sequenceChanged && currentRate > 0.8 && existing.success_count > 5) {
        // Only increment, don't change sequence for well-established patterns
        await supabase
          .from("ai_learned_patterns")
          .update({
            success_count: existing.success_count + successIncrement,
            last_used_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        console.log("Pattern success incremented (sequence preserved):", patternHash);
      } else {
        // Update with new sequence
        await supabase
          .from("ai_learned_patterns")
          .update({
            success_count: existing.success_count + successIncrement,
            last_used_at: new Date().toISOString(),
            tool_sequence: toolSequence,
            example_request: userMessage.slice(0, 500),
            example_response: aiResponse.slice(0, 500),
          })
          .eq("id", existing.id);
        console.log("Pattern updated:", patternHash);
      }
    } else {
      // Create new pattern
      await supabase.from("ai_learned_patterns").insert({
        pattern_hash: patternHash,
        request_pattern: patternHash,
        tool_sequence: toolSequence,
        example_request: userMessage.slice(0, 500),
        example_response: aiResponse.slice(0, 500),
        success_count: successIncrement,
        failure_count: 0,
      });
      console.log("New pattern created:", patternHash);
    }
  } catch (e) {
    console.error("Failed to update learned pattern:", e);
  }
}

// Record a failed pattern and cleanup bad patterns
async function recordPatternFailure(supabase: any, patternHash: string): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from("ai_learned_patterns")
      .select("id, failure_count, success_count")
      .eq("pattern_hash", patternHash)
      .maybeSingle();
    
    if (existing) {
      const newFailureCount = existing.failure_count + 1;
      const total = existing.success_count + newFailureCount;
      const successRate = total > 0 ? existing.success_count / total : 0;
      
      // QUALITY CONTROL: Delete patterns with high failure rate
      if (total >= 5 && successRate < 0.3) {
        console.log(`Deleting low-quality pattern: ${patternHash} (rate: ${Math.round(successRate * 100)}%)`);
        await supabase
          .from("ai_learned_patterns")
          .delete()
          .eq("id", existing.id);
      } else {
        await supabase
          .from("ai_learned_patterns")
          .update({ failure_count: newFailureCount })
          .eq("id", existing.id);
      }
    }
  } catch (e) {
    console.error("Failed to record pattern failure:", e);
  }
}

// Cleanup stale or low-quality patterns (called periodically)
async function cleanupBadPatterns(supabase: any): Promise<void> {
  try {
    // Delete patterns that are old (>30 days) and have low success rate
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: oldPatterns } = await supabase
      .from("ai_learned_patterns")
      .select("id, success_count, failure_count, last_used_at")
      .lt("last_used_at", thirtyDaysAgo.toISOString());
    
    if (!oldPatterns?.length) return;
    
    const toDelete = oldPatterns.filter((p: any) => {
      const total = p.success_count + p.failure_count;
      const successRate = total > 0 ? p.success_count / total : 0;
      // Delete if low usage AND low success rate
      return total < 10 || successRate < 0.5;
    });
    
    if (toDelete.length > 0) {
      const idsToDelete = toDelete.map((p: any) => p.id);
      await supabase
        .from("ai_learned_patterns")
        .delete()
        .in("id", idsToDelete);
      console.log(`Cleaned up ${toDelete.length} stale patterns`);
    }
  } catch (e) {
    console.error("Failed to cleanup patterns:", e);
  }
}

// Get relevant learned patterns to inject into system prompt
async function getLearnedPatterns(supabase: any, limit = 5): Promise<string> {
  try {
    const { data: patterns } = await supabase
      .from("ai_learned_patterns")
      .select("request_pattern, tool_sequence, example_request, success_count, failure_count")
      .order("success_count", { ascending: false })
      .limit(limit);
    
    if (!patterns?.length) return "";
    
    // Filter to patterns with good success rate
    const goodPatterns = patterns.filter((p: any) => {
      const total = p.success_count + p.failure_count;
      const successRate = total > 0 ? p.success_count / total : 0;
      return successRate >= 0.7 && p.success_count >= 2;
    });
    
    if (!goodPatterns.length) return "";
    
    const examples = goodPatterns.map((p: any) => {
      const tools = p.tool_sequence.join(" → ");
      return `• "${p.example_request?.slice(0, 100)}..." → ${tools} (${p.success_count} successes)`;
    }).join("\n");
    
    return `\n═══════════════════════════════════════════════════════════════
LEARNED PATTERNS (from successful past interactions)
═══════════════════════════════════════════════════════════════
${examples}

Use these as guidance for similar requests.\n`;
  } catch (e) {
    console.error("Failed to get learned patterns:", e);
    return "";
  }
}

// Get recent successful tool sequences for similar request types
async function getSimilarSuccessfulPatterns(supabase: any, requestType: string): Promise<string> {
  try {
    const { data: recentSuccess } = await supabase
      .from("ai_learning_feedback")
      .select("user_message, tool_sequence")
      .eq("request_type", requestType)
      .eq("was_successful", true)
      .order("created_at", { ascending: false })
      .limit(3);
    
    if (!recentSuccess?.length) return "";
    
    const examples = recentSuccess
      .filter((r: any) => r.tool_sequence?.length > 0)
      .map((r: any) => `• "${r.user_message?.slice(0, 80)}..." → [${r.tool_sequence.join(", ")}]`)
      .join("\n");
    
    if (!examples) return "";
    
    return `\nRecent successful ${requestType} patterns:\n${examples}\n`;
  } catch (e) {
    return "";
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

    // Normalize query - lowercase and clean
    const normalizedQuery = query.toLowerCase().replace(/\s+/g, ' ').trim();
    
    // 1) Exact by slug or id
    const exact = await supabase
      .from("hackathons")
      .select("id, slug, name, region, start_date, end_date, url, location, description")
      .or(`slug.eq.${query},id.eq.${query}`)
      .eq("status", "approved")
      .maybeSingle();

    if (exact.data) return { type: "single" as const, match: exact.data };

    // 2) EXACT NAME MATCH FIRST (case-insensitive) - prevents hallucination
    const { data: exactNameMatch } = await supabase
      .from("hackathons")
      .select("id, slug, name, region, start_date, end_date, url, location, description")
      .eq("status", "approved")
      .ilike("name", normalizedQuery);

    if (exactNameMatch?.length === 1) {
      return { type: "single" as const, match: exactNameMatch[0] };
    }

    // 3) If multiple exact matches, return them for selection
    if (exactNameMatch && exactNameMatch.length > 1) {
      return { type: "many" as const, matches: exactNameMatch };
    }

    // 4) Fuzzy search - only search for the actual query, not random terms
    // Use a scoring system: prioritize matches where ALL words appear
    const { data: allHackathons, error } = await supabase
      .from("hackathons")
      .select("id, slug, name, region, start_date, end_date, url, location, description")
      .eq("status", "approved")
      .order("start_date", { ascending: true });

    if (error) return { type: "error" as const, error: error.message };
    if (!allHackathons?.length) return { type: "none" as const, matches: [] as any[] };

    // Score each hackathon based on how well it matches the query
    const searchTerms = normalizedQuery.split(' ').filter(t => t.length >= 2);
    
    const scoredMatches = allHackathons
      .map((h: any) => {
        const nameLower = h.name.toLowerCase();
        let score = 0;
        
        // Exact name contains full query = highest score
        if (nameLower.includes(normalizedQuery)) {
          score += 100;
        }
        
        // Count how many search terms appear in the name
        let matchedTerms = 0;
        for (const term of searchTerms) {
          if (nameLower.includes(term)) {
            matchedTerms++;
            score += 10;
          }
        }
        
        // Bonus if ALL terms match
        if (searchTerms.length > 0 && matchedTerms === searchTerms.length) {
          score += 50;
        }
        
        // Name starts with query = bonus
        if (nameLower.startsWith(normalizedQuery)) {
          score += 30;
        }
        
        return { ...h, score };
      })
      .filter((h: any) => h.score > 0)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 5);

    if (!scoredMatches.length) return { type: "none" as const, matches: [] as any[] };
    
    // If top match has significantly higher score than others, use it
    if (scoredMatches.length === 1 || 
        (scoredMatches.length > 1 && scoredMatches[0].score >= 100 && scoredMatches[0].score > scoredMatches[1].score * 2)) {
      return { type: "single" as const, match: scoredMatches[0] };
    }

    // Otherwise return top matches for selection
    return { type: "many" as const, matches: scoredMatches };
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

      const detailsPage = `https://hackerbuddy.lovable.app/hackathon/${res.match.slug}`;

      return {
        result: {
          name: res.match.name,
          slug: res.match.slug,
          url: res.match.url || null,
          message: res.match.url
            ? `Official link for ${res.match.name}: ${res.match.url}`
            : `I don't have an official link saved for ${res.match.name}. Opening the hackathon page instead.`,
          action: {
            type: "open_link",
            url: res.match.url || detailsPage,
          },
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

      // Check for ANY existing request (any status) - not just pending
      const { data: existingReq } = await supabase
        .from("friend_requests")
        .select("id, status")
        .eq("from_user_id", userId)
        .eq("to_user_id", target.user_id)
        .maybeSingle();

      if (existingReq) {
        if (existingReq.status === "pending") {
          return { result: { error: "Friend request already pending" } };
        }
        // Update existing row back to pending instead of inserting (fixes duplicate key error)
        const { error } = await supabase
          .from("friend_requests")
          .update({ status: "pending", updated_at: new Date().toISOString() })
          .eq("id", existingReq.id);

        if (error) return { result: { error: error.message } };
        return {
          result: {
            success: true,
            message: `Friend request sent to ${target.username} (@${target.userid})`,
            action_type: "send_friend_request",
          },
        };
      }

      // No existing row, insert new
      const { error } = await supabase
        .from("friend_requests")
        .insert({ from_user_id: userId, to_user_id: target.user_id });

      if (error) return { result: { error: error.message } };
      return {
        result: {
          success: true,
          message: `Friend request sent to ${target.username} (@${target.userid})`,
          action_type: "send_friend_request",
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
      const teamNameTrimmed = String(args.team_name || "").trim();

      // Check if team with same name already exists for this hackathon
      const { data: existingTeam } = await supabase
        .from("teams")
        .select("id, name")
        .eq("hackathon_id", hackathon.slug)
        .ilike("name", teamNameTrimmed)
        .maybeSingle();

      if (existingTeam) {
        return { result: { error: `A team named "${teamNameTrimmed}" already exists for "${hackathon.name}". Please choose a different name.` } };
      }

      const lookingForTeammates = args.looking_for_teammates || false;
      const lookingVisibility = args.looking_visibility || "anyone";

      if (!pendingConfirmation) {
        let confirmMsg = `I'll create a team called "${teamNameTrimmed}" for "${hackathon.name}"`;
        if (lookingForTeammates) {
          confirmMsg += ` with "Looking for Teammates" enabled (${lookingVisibility === 'friends_only' ? 'friends only' : 'anyone can see'})`;
        }
        confirmMsg += ". Should I proceed?";
        return {
          result: null,
          needsConfirmation: true,
          confirmationMessage: confirmMsg,
        };
      }

      const { data: team, error: teamError } = await supabase
        .from("teams")
        .insert({
          name: teamNameTrimmed,
          hackathon_id: hackathon.slug,
          created_by: userId,
          looking_for_teammates: lookingForTeammates,
          looking_visibility: lookingVisibility,
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

      // If looking_for_teammates with friends_only, notify friends
      if (lookingForTeammates && lookingVisibility === "friends_only") {
        // Get user's friends
        const { data: friendships } = await supabase
          .from("friends")
          .select("friend_id, user_id")
          .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

        if (friendships && friendships.length > 0) {
          const friendIds = friendships.map((f: { user_id: string; friend_id: string }) => 
            f.user_id === userId ? f.friend_id : f.user_id
          );
          
          // Get hackathon name for notification
          const notifMessage = `${userProfile?.username || 'A user'} is looking for teammates for "${teamNameTrimmed}" in ${hackathon.name}`;
          
          // Insert notifications for all friends
          const notifications = friendIds.map((friendId: string) => ({
            user_id: friendId,
            type: "looking_for_teammates",
            title: "Friend Looking for Teammates",
            message: notifMessage,
            reference_id: team.id,
            reference_type: "team",
          }));

          await supabase.from("notifications").insert(notifications);
        }
      }

      let successMsg = `Team "${teamNameTrimmed}" created for ${hackathon.name}. You are now participating in this hackathon!`;
      if (lookingForTeammates) {
        successMsg += lookingVisibility === "friends_only" 
          ? " Your friends have been notified."
          : " Others can now see your team is looking for members.";
      }

      return {
        result: {
          success: true,
          message: successMsg,
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

      // Check if user is the only member and get member details
      const { data: members } = await supabase
        .from("team_members")
        .select("id, user_id, is_leader, role, joined_at")
        .eq("team_id", team.id)
        .order("joined_at", { ascending: true });

      const isOnlyMember = members?.length === 1;
      const isLeader = members?.some((m: any) => m.user_id === userId && (m.is_leader || m.role === 'leader')) || team.created_by === userId;
      const otherMembers = (members || []).filter((m: any) => m.user_id !== userId);

      if (!pendingConfirmation) {
        let message = `I'll remove you from team "${team.name}".`;
        if (isOnlyMember) {
          message = `You are the only member of team "${team.name}". Leaving will effectively abandon the team.`;
        } else if (isLeader && otherMembers.length > 0) {
          message = `You are the leader of team "${team.name}". Leadership will be transferred to the next member who joined first.`;
        }
        return {
          result: null,
          needsConfirmation: true,
          confirmationMessage: `${message} Should I proceed?`,
        };
      }

      // If leader and there are other members, transfer leadership
      if (isLeader && otherMembers.length > 0) {
        const newLeader = otherMembers[0]; // First member who joined (already sorted)
        await supabase
          .from("team_members")
          .update({ is_leader: true, role: "leader" })
          .eq("id", newLeader.id);
      }

      // Remove the user from team
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("team_id", team.id)
        .eq("user_id", userId);

      if (error) return { result: { error: error.message } };

      let successMessage = `You have left team "${team.name}"`;
      if (isLeader && otherMembers.length > 0) {
        successMessage += ". Leadership has been transferred to another member.";
      }

      return {
        result: {
          success: true,
          message: successMessage,
        },
      };
    }

    case "leave_all_teams_for_hackathon": {
      const resolved = await resolveHackathon(args.hackathon_query);
      if (resolved.type === "error") return { result: { error: resolved.error } };
      if (resolved.type === "none") return { result: { error: "Hackathon not found" } };
      if (resolved.type === "many") {
        return {
          result: {
            needs_selection: true,
            message: "I found multiple hackathons. Which one do you want to leave all teams for?",
            matches: resolved.matches.map((h: any) => ({ name: h.name, slug: h.slug })),
          },
        };
      }

      const h = resolved.match;

      if (!pendingConfirmation) {
        return {
          result: null,
          needsConfirmation: true,
          confirmationMessage: `I'll remove you from ALL of your teams in "${h.name}". Should I proceed?`,
        };
      }

      const { data: memberships, error: memErr } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", userId);

      if (memErr) return { result: { error: memErr.message } };

      const teamIds = Array.from(new Set((memberships || []).map((m: any) => m.team_id)));
      if (teamIds.length === 0) {
        return {
          result: {
            success: true,
            action_type: "leave_all_teams_for_hackathon",
            message: "You are not currently a member of any teams.",
            left_teams: [],
          },
        };
      }

      const { data: teams, error: teamsErr } = await supabase
        .from("teams")
        .select("id, name, hackathon_id")
        .in("id", teamIds);

      if (teamsErr) return { result: { error: teamsErr.message } };

      const hackathonIds = [h.slug, h.id].filter(Boolean);
      const matching = (teams || []).filter((t: any) => hackathonIds.includes(t.hackathon_id));

      if (matching.length === 0) {
        return {
          result: {
            success: true,
            action_type: "leave_all_teams_for_hackathon",
            message: `You're not a member of any teams for "${h.name}".`,
            left_teams: [],
          },
        };
      }

      const { error: leaveErr } = await supabase
        .from("team_members")
        .delete()
        .eq("user_id", userId)
        .in(
          "team_id",
          matching.map((t: any) => t.id)
        );

      if (leaveErr) return { result: { error: leaveErr.message } };

      return {
        result: {
          success: true,
          action_type: "leave_all_teams_for_hackathon",
          message: `You have left ${matching.length} team(s) in "${h.name}": ${matching
            .map((t: any) => t.name)
            .join(", ")}`,
          left_teams: matching.map((t: any) => ({ name: t.name })),
        },
      };
    }

    case "leave_all_teams_globally": {
      // Get all teams user is a member of
      const { data: memberships, error: memErr } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", userId);

      if (memErr) return { result: { error: memErr.message } };
      if (!memberships?.length) {
        return { result: { message: "You are not a member of any teams." } };
      }

      const teamIds = memberships.map((m: any) => m.team_id);

      // Get team details with hackathon info
      const { data: teams } = await supabase
        .from("teams")
        .select("id, name, hackathon_id, created_by")
        .in("id", teamIds);

      if (!teams?.length) {
        return { result: { message: "You are not a member of any teams." } };
      }

      // Get hackathon names for better display
      const hackathonSlugs = [...new Set(teams.map((t: any) => t.hackathon_id as string))];
      const { data: hackathons } = await supabase
        .from("hackathons")
        .select("slug, name")
        .in("slug", hackathonSlugs);

      const hackathonMap = new Map((hackathons || []).map((h: any) => [h.slug, h.name]));

      // Build detailed team list
      const teamList = teams.map((t: any) => ({
        name: t.name,
        hackathon: hackathonMap.get(t.hackathon_id) || t.hackathon_id,
        isLeader: t.created_by === userId,
      }));

      if (!pendingConfirmation) {
        const teamListStr = teamList
          .map((t: any) => `• "${t.name}" in ${t.hackathon}${t.isLeader ? " (you're the leader)" : ""}`)
          .join("\n");
        
        return {
          result: null,
          needsConfirmation: true,
          confirmationMessage: `You are about to leave ALL ${teams.length} team(s) across all hackathons:\n\n${teamListStr}\n\nThis action cannot be undone. Are you sure you want to leave ALL these teams?`,
        };
      }

      // Leave all teams - handle leader transfer or team deletion
      const leftTeams: string[] = [];
      const errors: string[] = [];

      for (const team of teams) {
        if (team.created_by === userId) {
          // User is the creator - check if there are other members
          const { data: otherMembers } = await supabase
            .from("team_members")
            .select("user_id")
            .eq("team_id", team.id)
            .neq("user_id", userId)
            .limit(1);

          if (otherMembers?.length) {
            // Transfer leadership to first other member
            const newLeaderId = otherMembers[0].user_id;
            await supabase.from("teams").update({ created_by: newLeaderId }).eq("id", team.id);
            await supabase.from("team_members").update({ is_leader: true, role: 'leader' }).eq("team_id", team.id).eq("user_id", newLeaderId);
          }
        }

        // Remove user from team
        const { error: leaveErr } = await supabase
          .from("team_members")
          .delete()
          .eq("team_id", team.id)
          .eq("user_id", userId);

        if (leaveErr) {
          errors.push(`Failed to leave "${team.name}": ${leaveErr.message}`);
        } else {
          leftTeams.push(team.name);
        }

        // Clean up participation if no teams left for this hackathon
        const { data: remainingTeams } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", userId);

        if (remainingTeams) {
          const remainingTeamIds = remainingTeams.map((r: any) => r.team_id);
          const { data: teamsInHackathon } = await supabase
            .from("teams")
            .select("id")
            .eq("hackathon_id", team.hackathon_id)
            .in("id", remainingTeamIds);

          if (!teamsInHackathon?.length) {
            await supabase
              .from("hackathon_participations")
              .delete()
              .eq("user_id", userId)
              .eq("hackathon_id", team.hackathon_id);
          }
        }
      }

      return {
        result: {
          success: true,
          action_type: "leave_all_teams_globally",
          message: errors.length
            ? `Left ${leftTeams.length} team(s). Errors: ${errors.join("; ")}`
            : `Successfully left all ${leftTeams.length} team(s): ${leftTeams.join(", ")}`,
          left_teams: leftTeams,
          errors: errors.length ? errors : undefined,
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

      // Check if request already exists for this user and team
      const { data: existingRequest } = await supabase
        .from("team_requests")
        .select("id, status")
        .eq("team_id", team.id)
        .eq("to_user_id", target.user_id)
        .maybeSingle();

      if (existingRequest) {
        if (existingRequest.status === "pending") {
          return { result: { error: `Invitation already pending for ${target.username} (@${target.userid})` } };
        }
        // Update existing request back to pending
        const { error } = await supabase
          .from("team_requests")
          .update({ status: "pending", updated_at: new Date().toISOString() })
          .eq("id", existingRequest.id);

        if (error) return { result: { error: error.message } };
        return {
          result: {
            success: true,
            message: `Team invitation sent to ${target.username} (@${target.userid})`,
          },
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

    case "remove_team_member": {
      // Resolve the team (must be leader)
      const teamRes = await resolveTeam(args.team_query, false, true);
      if (teamRes.type === "error") return { result: { error: teamRes.error } };
      if (teamRes.type === "none") return { result: { error: "Team not found or you don't have permission to remove members" } };
      if (teamRes.type === "many") {
        return {
          result: {
            needs_selection: true,
            message: "I found multiple teams. Which team do you want to remove a member from?",
            matches: teamRes.matches.map((t: any) => ({ name: t.name })),
          },
        };
      }

      const team = teamRes.match;

      // Resolve the user to remove
      const who = await resolveUser(args.user_query);
      if (who.type === "error") return { result: { error: who.error } };
      if (who.type === "none") return { result: { error: "User not found" } };
      if (who.type === "many") {
        return {
          result: {
            needs_selection: true,
            message: "I found multiple users. Which member do you want to remove?",
            matches: who.matches.map((u: any) => ({ username: u.username, userid: u.userid })),
          },
        };
      }

      const target = who.match;

      // Can't remove yourself
      if (target.user_id === userId) {
        return { result: { error: "You cannot remove yourself. Use 'leave team' instead." } };
      }

      // Check if target is actually a member of the team
      const { data: membership } = await supabase
        .from("team_members")
        .select("id, is_leader, role")
        .eq("team_id", team.id)
        .eq("user_id", target.user_id)
        .maybeSingle();

      if (!membership) {
        return { result: { error: `${target.username} (@${target.userid}) is not a member of team "${team.name}"` } };
      }

      // Can't remove another leader
      if (membership.is_leader || membership.role === "leader") {
        return { result: { error: `Cannot remove ${target.username} - they are also a team leader` } };
      }

      if (!pendingConfirmation) {
        return {
          result: null,
          needsConfirmation: true,
          confirmationMessage: `I'll remove ${target.username} (@${target.userid}) from team "${team.name}". Should I proceed?`,
        };
      }

      // Remove the member
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("id", membership.id);

      if (error) return { result: { error: error.message } };

      return {
        result: {
          success: true,
          message: `${target.username} (@${target.userid}) has been removed from team "${team.name}"`,
          action_type: "remove_team_member",
        },
      };
    }

    case "get_teams_looking_for_teammates": {
      const resolved = await resolveHackathon(args.hackathon_query);
      if (resolved.type === "error") return { result: { error: resolved.error } };
      if (resolved.type === "none") return { result: { error: "Hackathon not found" } };
      if (resolved.type === "many") {
        return {
          result: {
            needs_selection: true,
            message: "I found multiple hackathons. Which one?",
            matches: resolved.matches.map((h: any) => ({ name: h.name, slug: h.slug })),
          },
        };
      }

      const hackathon = resolved.match;

      // Get teams looking for teammates
      const { data: teams, error: teamsErr } = await supabase
        .from("teams")
        .select("id, name, looking_visibility, created_by")
        .eq("hackathon_id", hackathon.slug)
        .eq("looking_for_teammates", true);

      if (teamsErr) return { result: { error: teamsErr.message } };
      if (!teams?.length) {
        return { result: { message: `No teams are currently looking for teammates in "${hackathon.name}"` } };
      }

      // Get user's friends
      const { data: friends } = await supabase
        .from("friends")
        .select("friend_id, user_id")
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      const friendIds = new Set((friends || []).map((f: any) => f.user_id === userId ? f.friend_id : f.user_id));

      // Filter teams based on visibility
      const visibleTeams = teams.filter((t: any) => {
        if (t.created_by === userId) return false;
        if (t.looking_visibility === "anyone") return true;
        if (t.looking_visibility === "friends_only") return friendIds.has(t.created_by);
        return false;
      });

      if (!visibleTeams.length) {
        return { result: { message: `No teams are looking for you in "${hackathon.name}"` } };
      }

      // Get leader profiles
      const leaderIds = visibleTeams.map((t: any) => t.created_by);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, userid")
        .in("user_id", leaderIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      const result = visibleTeams.map((t: any) => {
        const leader = profileMap.get(t.created_by) as { username?: string; userid?: string } | undefined;
        return {
          name: t.name,
          id: t.id,
          leader: leader ? `${leader.username} (@${leader.userid})` : "Unknown",
          visibility: t.looking_visibility,
        };
      });

      return {
        result: {
          hackathon: hackathon.name,
          teams: result,
          message: `Found ${result.length} team(s) looking for teammates in "${hackathon.name}"`,
        },
      };
    }

    case "request_to_join_team": {
      // Try to find the team
      let teamQuery = supabase
        .from("teams")
        .select("id, name, hackathon_id, created_by, looking_for_teammates, looking_visibility")
        .eq("looking_for_teammates", true)
        .ilike("name", `%${cleanQuery(args.team_query)}%`);

      // Optionally filter by hackathon
      if (args.hackathon_query) {
        const hackRes = await resolveHackathon(args.hackathon_query);
        if (hackRes.type === "single") {
          teamQuery = teamQuery.eq("hackathon_id", hackRes.match.slug);
        }
      }

      const { data: teams, error: teamErr } = await teamQuery.limit(10);

      if (teamErr) return { result: { error: teamErr.message } };
      if (!teams?.length) {
        return { result: { error: "No teams found matching that name that are looking for teammates" } };
      }

      // Filter based on visibility
      const { data: friends } = await supabase
        .from("friends")
        .select("friend_id, user_id")
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      const friendIds = new Set((friends || []).map((f: any) => f.user_id === userId ? f.friend_id : f.user_id));

      const visibleTeams = teams.filter((t: any) => {
        if (t.created_by === userId) return false;
        if (t.looking_visibility === "anyone") return true;
        if (t.looking_visibility === "friends_only") return friendIds.has(t.created_by);
        return false;
      });

      if (!visibleTeams.length) {
        return { result: { error: "No visible teams found. The team may be 'friends only' and you're not friends with the leader." } };
      }

      if (visibleTeams.length > 1) {
        return {
          result: {
            needs_selection: true,
            message: "I found multiple teams. Which one do you want to join?",
            matches: visibleTeams.map((t: any) => ({ name: t.name, hackathon_id: t.hackathon_id })),
          },
        };
      }

      const team = visibleTeams[0];

      // Check if already a member
      const { data: existingMember } = await supabase
        .from("team_members")
        .select("id")
        .eq("team_id", team.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingMember) {
        return { result: { error: `You are already a member of "${team.name}"` } };
      }

      // Check if already requested
      const { data: existingRequest } = await supabase
        .from("team_requests")
        .select("id, status")
        .eq("team_id", team.id)
        .eq("from_user_id", userId)
        .maybeSingle();

      if (existingRequest?.status === "pending") {
        return { result: { error: `You already have a pending request to join "${team.name}"` } };
      }

      // Get hackathon name
      const { data: hackathon } = await supabase
        .from("hackathons")
        .select("name")
        .eq("slug", team.hackathon_id)
        .maybeSingle();

      const hackathonName = hackathon?.name || team.hackathon_id;

      if (!pendingConfirmation) {
        return {
          result: null,
          needsConfirmation: true,
          confirmationMessage: `I'll send a request to join team "${team.name}" in "${hackathonName}". Should I proceed?`,
        };
      }

      // Send the request
      if (existingRequest) {
        await supabase
          .from("team_requests")
          .update({ status: "pending", updated_at: new Date().toISOString() })
          .eq("id", existingRequest.id);
      } else {
        const { error: insertErr } = await supabase.from("team_requests").insert({
          team_id: team.id,
          from_user_id: userId,
          to_user_id: team.created_by,
          status: "pending",
        });

        if (insertErr) return { result: { error: insertErr.message } };
      }

      // Notify the team leader
      await supabase.from("notifications").insert({
        user_id: team.created_by,
        type: "team_join_request",
        title: "Team Join Request",
        message: `${userProfile?.username || "Someone"} wants to join your team "${team.name}"`,
        reference_id: team.id,
        reference_type: "team",
      });

      return {
        result: {
          success: true,
          action_type: "request_to_join_team",
          message: `Request sent to join team "${team.name}" in "${hackathonName}"`,
        },
      };
    }

    case "get_current_datetime": {
      const now = new Date();
      const formatted = now.toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
      });
      const isoTime = now.toISOString();
      return {
        result: {
          formatted,
          iso: isoTime,
          timestamp: now.getTime(),
          message: `The current date and time is ${formatted}`,
        },
      };
    }

    case "get_weather": {
      const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
      if (!perplexityKey) {
        return { result: { error: "Weather service is not configured" } };
      }
      
      // Retry logic for Perplexity API
      const maxRetries = 3;
      let lastError: any = null;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
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
                  content: "You are a weather assistant. Provide current weather conditions for the requested location. Include temperature (in both Celsius and Fahrenheit), conditions, humidity, and any relevant weather alerts. Be concise.",
                },
                { role: "user", content: `What is the current weather in ${args.location}?` },
              ],
            }),
          });
          
          if (response.status === 429) {
            // Rate limited - wait and retry
            const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 500;
            console.log(`Weather API rate limited, retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})`);
            if (attempt < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
          }
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error("Weather API error:", response.status, errorText);
            throw new Error(`Weather API error: ${response.status}`);
          }
          
          const data = await response.json();
          const weatherContent = data.choices?.[0]?.message?.content;
          
          if (!weatherContent) {
            throw new Error("No weather data in response");
          }
          
          return {
            result: {
              weather: weatherContent,
              location: args.location,
              citations: data.citations || [],
            },
          };
        } catch (e) {
          lastError = e;
          console.error(`Weather lookup attempt ${attempt + 1} failed:`, e);
          
          if (attempt < maxRetries - 1) {
            const waitTime = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
      
      return { result: { error: `Unable to get weather for "${args.location}". Please try again in a moment.` } };
    }

    case "get_hackathon_calendar_link": {
      const res = await resolveHackathon(args.hackathon_query);
      if (res.type === "error") return { result: { error: res.error } };
      if (res.type === "none") return { result: { error: "Hackathon not found" } };
      if (res.type === "many") {
        return {
          result: {
            needs_selection: true,
            message: "I found multiple hackathons. Which one do you want to add to calendar?",
            matches: res.matches.map((h: any) => ({ name: h.name, slug: h.slug })),
          },
        };
      }

      const h = res.match;
      const startDate = new Date(h.start_date);
      const endDate = new Date(h.end_date);

      const formatGoogleDate = (date: Date) => {
        return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      };

      const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(h.name)}&dates=${formatGoogleDate(startDate).substring(0, 8)}/${formatGoogleDate(endDate).substring(0, 8)}&details=${encodeURIComponent((h.description || "Hackathon event") + (h.url ? "\n\nWebsite: " + h.url : ""))}&location=${encodeURIComponent(h.location || "Online")}`;

      return {
        result: {
          success: true,
          action_type: "get_hackathon_calendar_link",
          hackathon: h.name,
          calendar_link: calendarUrl,
          message: `📅 Calendar link ready for "${h.name}".`,
          action: {
            type: "open_link",
            url: calendarUrl,
          },
        },
      };
    }

    case "get_hackathon_share_link": {
      const res = await resolveHackathon(args.hackathon_query);
      if (res.type === "error") return { result: { error: res.error } };
      if (res.type === "none") return { result: { error: "Hackathon not found" } };
      if (res.type === "many") {
        return {
          result: {
            needs_selection: true,
            message: "I found multiple hackathons. Which one do you want to share?",
            matches: res.matches.map((h: any) => ({ name: h.name, slug: h.slug })),
          },
        };
      }

      const h = res.match;
      const shareUrl = `https://hackerbuddy.lovable.app/hackathon/${h.slug}`;

      return {
        result: {
          success: true,
          action_type: "get_hackathon_share_link",
          hackathon: h.name,
          share_link: shareUrl,
          official_url: h.url || null,
          message: `📋 Share link ready for "${h.name}".`,
          action: {
            type: "copy_to_clipboard",
            text: shareUrl,
          },
        },
      };
    }

    case "visit_hackathon_website": {
      const res = await resolveHackathon(args.hackathon_query);
      if (res.type === "error") return { result: { error: res.error } };
      if (res.type === "none") return { result: { error: "Hackathon not found" } };
      if (res.type === "many") {
        return {
          result: {
            needs_selection: true,
            message: "I found multiple hackathons. Which one's website do you want?",
            matches: res.matches.map((h: any) => ({ name: h.name, slug: h.slug })),
          },
        };
      }

      const h = res.match;
      if (!h.url) {
        const detailsPage = `https://hackerbuddy.lovable.app/hackathon/${h.slug}`;
        return {
          result: {
            success: true,
            action_type: "visit_hackathon_website",
            hackathon: h.name,
            has_url: false,
            message: `Official website for "${h.name}" is not available yet. Opening the hackathon page instead.`,
            details_page: detailsPage,
            action: {
              type: "open_link",
              url: detailsPage,
            },
          },
        };
      }

      return {
        result: {
          success: true,
          action_type: "visit_hackathon_website",
          hackathon: h.name,
          has_url: true,
          url: h.url,
          message: `🔗 Opening "${h.name}" website...`,
          action: {
            type: "open_link",
            url: h.url,
          },
        },
      };
    }

    case "navigate_to_page": {
      const path = args.path || "/";
      const description = args.description || "";

      // Guardrail: never "navigate" to a hackathon page that doesn't exist in the database.
      // This prevents hallucinated slugs like /hackathon/some-random-name.
      const hackathonMatch = String(path).match(/^\/hackathon\/([^/]+)$/);
      if (hackathonMatch) {
        const slug = hackathonMatch[1];
        const { data: h } = await supabase
          .from("hackathons")
          .select("slug")
          .eq("status", "approved")
          .eq("slug", slug)
          .maybeSingle();

        if (!h) {
          return {
            result: {
              success: false,
              action_type: "navigate_to_page",
              path,
              description,
              message: `❌ Hackathon page not found for slug: ${slug}. Please search first (I won't guess).`,
            },
          };
        }
      }

      // Check if user wants calendar view - append query param
      const lowerDesc = description.toLowerCase();
      let finalPath = path;
      if (
        path === "/" &&
        (lowerDesc.includes("calendar") || lowerDesc.includes("calender"))
      ) {
        finalPath = "/?view=calendar";
      }

      // Build full URL for navigation
      const baseUrl = "https://hackerbuddy.lovable.app";
      const fullUrl = finalPath.startsWith("http") ? finalPath : `${baseUrl}${finalPath}`;

      return {
        result: {
          success: true,
          action_type: "navigate_to_page",
          path: finalPath,
          description,
          message: `📍 Navigate to: ${finalPath}${description ? ` - ${description}` : ""}`,
          action: {
            type: "navigate",
            path: finalPath,
            url: fullUrl,
          },
        },
      };
    }

    case "admin_train_ai": {
      // Check if user is admin
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (!adminRole) {
        return {
          result: {
            success: false,
            error: "Only admins can train the AI. Your request has been logged.",
            message: "❌ Admin access required to train the AI."
          }
        };
      }

      const { example_request, tool_sequence, expected_response } = args;
      
      if (!example_request || !tool_sequence?.length) {
        return {
          result: {
            success: false,
            error: "Missing required fields: example_request and tool_sequence",
            message: "❌ Please provide an example request and the tool sequence."
          }
        };
      }

      const patternHash = generatePatternHash(example_request);
      
      // Check if pattern already exists
      const { data: existing } = await supabase
        .from("ai_learned_patterns")
        .select("id, success_count")
        .eq("pattern_hash", patternHash)
        .maybeSingle();

      if (existing) {
        // Update existing pattern
        await supabase
          .from("ai_learned_patterns")
          .update({
            tool_sequence,
            example_request: example_request.slice(0, 500),
            example_response: expected_response?.slice(0, 500) || null,
            success_count: existing.success_count + 10, // Boost admin-added patterns
            last_used_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        return {
          result: {
            success: true,
            action_type: "admin_train_ai",
            message: `✅ Pattern updated! Hash: ${patternHash}\nTools: ${tool_sequence.join(" → ")}\nThis pattern now has boosted priority.`,
            pattern_hash: patternHash,
          }
        };
      }

      // Create new pattern with high success count (admin-validated)
      await supabase.from("ai_learned_patterns").insert({
        pattern_hash: patternHash,
        request_pattern: patternHash,
        tool_sequence,
        example_request: example_request.slice(0, 500),
        example_response: expected_response?.slice(0, 500) || null,
        success_count: 10, // Start with high count (admin-validated)
        failure_count: 0,
      });

      return {
        result: {
          success: true,
          action_type: "admin_train_ai",
          message: `✅ New pattern added!\nHash: ${patternHash}\nExample: "${example_request.slice(0, 50)}..."\nTools: ${tool_sequence.join(" → ")}\n\nThe AI will now use this pattern for similar requests.`,
          pattern_hash: patternHash,
        }
      };
    }

    case "get_ai_learning_stats": {
      // Check if user is admin
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (!adminRole) {
        return {
          result: {
            success: false,
            error: "Only admins can view AI learning stats.",
            message: "❌ Admin access required."
          }
        };
      }

      // Get pattern stats
      const { data: patterns, count: totalPatterns } = await supabase
        .from("ai_learned_patterns")
        .select("*", { count: "exact" })
        .order("success_count", { ascending: false })
        .limit(10);

      // Get feedback stats
      const { count: totalFeedback } = await supabase
        .from("ai_learning_feedback")
        .select("*", { count: "exact" });

      const { count: successfulFeedback } = await supabase
        .from("ai_learning_feedback")
        .select("*", { count: "exact" })
        .eq("was_successful", true);

      // Calculate stats
      const successRate = totalFeedback ? Math.round((successfulFeedback || 0) / totalFeedback * 100) : 0;
      
      const topPatterns = (patterns || []).map((p: any) => ({
        hash: p.pattern_hash,
        example: p.example_request?.slice(0, 60) + "...",
        tools: p.tool_sequence.join(" → "),
        successes: p.success_count,
        failures: p.failure_count,
        rate: Math.round(p.success_count / (p.success_count + p.failure_count) * 100) + "%"
      }));

      return {
        result: {
          success: true,
          action_type: "get_ai_learning_stats",
          stats: {
            total_patterns: totalPatterns,
            total_interactions: totalFeedback,
            successful_interactions: successfulFeedback,
            success_rate: successRate + "%",
            top_patterns: topPatterns,
          },
          message: `📊 AI Learning Stats:\n• Total patterns: ${totalPatterns}\n• Total interactions: ${totalFeedback}\n• Success rate: ${successRate}%\n\nTop patterns:\n${topPatterns.map((p: any, i: number) => `${i+1}. [${p.rate}] ${p.tools}`).join("\n")}`,
        }
      };
    }

    case "delete_ai_pattern": {
      // Check if user is admin
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (!adminRole) {
        return {
          result: {
            success: false,
            error: "Only admins can delete AI patterns.",
            message: "❌ Admin access required."
          }
        };
      }

      const query = args.pattern_query?.trim();
      if (!query) {
        return {
          result: {
            success: false,
            error: "Please provide a pattern hash or example request text to search for.",
            message: "❌ Missing pattern query."
          }
        };
      }

      // Try to find by hash first
      let { data: patterns } = await supabase
        .from("ai_learned_patterns")
        .select("id, pattern_hash, example_request, tool_sequence")
        .eq("pattern_hash", query);

      // If not found by hash, search by example request
      if (!patterns?.length) {
        const { data: searchResults } = await supabase
          .from("ai_learned_patterns")
          .select("id, pattern_hash, example_request, tool_sequence")
          .ilike("example_request", `%${query}%`)
          .limit(5);
        patterns = searchResults;
      }

      if (!patterns?.length) {
        return {
          result: {
            success: false,
            error: "No patterns found matching your query.",
            message: `❌ No patterns found for: "${query}"`
          }
        };
      }

      if (patterns.length > 1) {
        return {
          result: {
            needs_selection: true,
            message: "Multiple patterns found. Please specify which one to delete:",
            matches: patterns.map((p: any) => ({
              hash: p.pattern_hash,
              example: p.example_request?.slice(0, 60),
              tools: p.tool_sequence.join(" → "),
            })),
          }
        };
      }

      // Delete the single matching pattern
      const patternToDelete = patterns[0];
      await supabase
        .from("ai_learned_patterns")
        .delete()
        .eq("id", patternToDelete.id);

      return {
        result: {
          success: true,
          action_type: "delete_ai_pattern",
          message: `✅ Pattern deleted!\nHash: ${patternToDelete.pattern_hash}\nExample: "${patternToDelete.example_request?.slice(0, 50)}..."`,
          deleted_hash: patternToDelete.pattern_hash,
        }
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
    const now = new Date();
    const formattedDateTime = now.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
    
    let systemPrompt = `You are HackerBuddy, an advanced AI assistant for a hackathon community platform. You are SMART, EFFICIENT, and can handle COMPLEX multi-step requests.

CURRENT DATE AND TIME: ${formattedDateTime}

CURRENT USER (YOU ALREADY KNOW THIS):
- Username: ${profile?.username || "Unknown"}
- Handle: @${profile?.userid || "unknown"}

═══════════════════════════════════════════════════════════════
🗺️ WEBSITE STRUCTURE & NAVIGATION (YOU KNOW THE ENTIRE APP)
═══════════════════════════════════════════════════════════════

You have FULL KNOWLEDGE of the website structure. Here are ALL the pages:

MAIN PAGES:
- / (Home) - Landing page with hackathon listings, hero section, calendar view
- /auth - Sign in / Sign up page
- /reset-password - Password reset page

HACKATHON PAGES:
- /hackathon/:slug - Individual hackathon detail page (shows info, teams, join options)

USER & SOCIAL:
- /friends - **FRIENDS PAGE** - View friends list, search users, send/manage friend requests, view sent requests
- /friend-chat/:friendId - Direct message chat with a specific friend
- /profile - Current user's profile settings
- /user/:userId - View another user's public profile
- /notifications - View all notifications (friend requests, team invites, etc.)

TEAMS:
- /teams - View all teams the user is part of
- /teams/:hackathonId/create - Create a new team for a hackathon
- /teams/:teamId/manage - Manage team settings, members (leader only)
- /teams/:teamId/chat - Team group chat

ADMIN:
- /admin - Admin panel (only visible to admins) - Approve hackathons, manage users

NAVIGATION HELP:
When users ask "where is X" or "how do I find X", tell them the exact page:
- "Where are my friends?" → Go to /friends (Friends link in navigation bar)
- "How do I message someone?" → Go to /friends, click on a friend, or /friend-chat/:id
- "Where can I see hackathons?" → Home page (/) shows all hackathons
- "Where is my profile?" → Click your avatar in the top right, or go to /profile
- "Where are my teams?" → Go to /teams
- "How do I create a team?" → Go to a hackathon page (/hackathon/:slug) and click "Create Team"
- "Where are notifications?" → Bell icon in navigation or /notifications
- "Where is admin panel?" → /admin (only if you're an admin)

IMPORTANT: You can use navigate_to_page tool to help users go directly to any page!

═══════════════════════════════════════════════════════════════
⚠️ CRITICAL: TASK COUNTING - READ THIS VERY CAREFULLY ⚠️
═══════════════════════════════════════════════════════════════

STEP 1: COUNT EACH DISTINCT TASK SEPARATELY
When parsing a user request, identify EACH individual action:

"Create team1 and team2 for X and add hackathon Y" = 3 TASKS:
  1. create_team(name="team1", hackathon="X")
  2. create_team(name="team2", hackathon="X")
  3. submit_hackathon(name="Y", ...)

"Remove friend and send request again" = 2 TASKS:
  1. remove_friend(user="...")
  2. send_friend_request(user="...")

"Send friend request to user X" = 1 TASK:
  1. send_friend_request(user="X")

STEP 2: CALL EXACTLY THE NUMBER OF TOOLS AS TASKS
- 1 task = 1 tool call
- 2 tasks = 2 tool calls  
- 3 tasks = 3 tool calls
- NEVER call a tool more than once for the same task
- NEVER call fewer tools than tasks identified

STEP 3: IF INFO IS MISSING, ASK FOR IT ALL AT ONCE
- Missing hackathon dates/location → ask before calling any tools
- Do NOT skip any task - ask for missing info for ALL tasks

═══════════════════════════════════════════════════════════════
SECURITY RULES
═══════════════════════════════════════════════════════════════
- NEVER expose UUIDs, emails, passwords, or internal IDs
- Only show: username, @handle
- Disambiguation: show names only, never IDs

═══════════════════════════════════════════════════════════════
BEHAVIORAL RULES
═══════════════════════════════════════════════════════════════
1. You KNOW the user's identity - never ask for it
2. "I/me/my" = ${profile?.username} (@${profile?.userid})
3. SEARCH FIRST for partial names, then:
   - 1 match → proceed
   - Multiple → list by NAME and ask
   - None → tell user
4. Data-changing actions require confirmation (but batch them together)
5. Never invent data - if missing, say so
6. Be CONCISE and action-oriented
7. DATABASE-FIRST: For friends/teams/requests state, ALWAYS call get_user_friends / get_user_teams / get_pending_requests first. Do NOT rely on chat memory.
8. HACKATHON QUICK ACTIONS:
   - "open website" / "open link" → MUST call visit_hackathon_website
   - "add to calendar" → MUST call get_hackathon_calendar_link
   - "share/copy link" → MUST call get_hackathon_link (or get_hackathon_share_link)
   Never say "completed" unless the tool actually returned an action.
9. IMPORTANT: Do NOT paste long URLs (especially calendar links). Say "ready" and rely on the action buttons (Open / Copy) in the chat UI.
10. "Leave all my teams in hackathon X" MUST use leave_all_teams_for_hackathon (single tool call).
11. NAVIGATION HELP: When user asks where something is, explain AND offer to navigate them there.

═══════════════════════════════════════════════════════════════
CAPABILITIES
═══════════════════════════════════════════════════════════════
- get_current_datetime: Current time
- get_weather: Weather for any location
- web_search: Search the web
- navigate_to_page: Guide user to a specific page in the app
- search_hackathons: Find hackathons
- get_hackathon_calendar_link: Google Calendar link
- get_hackathon_share_link: Shareable URL
- visit_hackathon_website: Official website (says "updating soon" if no URL)
- create_team: Create a team for hackathon
- leave_team, leave_all_teams_for_hackathon, delete_team: Team management
- remove_team_member: Remove member (leaders only)
- send_friend_request, accept_friend_request: Friend management
- remove_friend: Remove from friend list
- set_looking_for_teammates: Team visibility
- invite_to_team: Invite users
- submit_hackathon: Submit new hackathon for admin approval

═══════════════════════════════════════════════════════════════
HACKATHON SUBMISSION
═══════════════════════════════════════════════════════════════
You CAN submit hackathons for admin approval. Required fields:
- name, start_date, end_date, location, region
Optional: description, url, organizer

═══════════════════════════════════════════════════════════════
AUTO-EXECUTE MULTI-TASK MODE (CRITICAL - READ CAREFULLY)
═══════════════════════════════════════════════════════════════

WHEN USER SAYS ANY OF THESE, EXECUTE ALL TASKS WITHOUT INDIVIDUAL CONFIRMATIONS:
- "perform X tasks" (e.g., "perform 4 tasks")
- "do all X tasks" 
- "execute all tasks"
- "confirm" (after listing tasks)
- "yes, proceed"
- "do it all"
- "run all"
- "consecutively" / "all at once" / "together"

AUTO-EXECUTE MODE:
When user confirms or explicitly requests batch execution:
1. List ALL tasks briefly first (one line each)
2. Execute ALL tool calls in ONE response
3. Report results for ALL tasks together
4. DO NOT ask for confirmation one-by-one

NORMAL MODE (single tasks or user wants to review each):
Ask for confirmation before each destructive action.

═══════════════════════════════════════════════════════════════
COMPREHENSIVE TRAINING EXAMPLES (FOLLOW EXACTLY)
═══════════════════════════════════════════════════════════════

Example 1 - "Create team1 and team2 for L'Oréal Brandstorm"
→ 2 TASKS → Call create_team TWICE (once for team1, once for team2)

Example 2 - "Create teams team3 and team4 for L'Oréal and add hackathon unstopDummy"  
→ 3 TASKS:
  - Task 1: create_team(name="team3", hackathon_query="L'Oréal Brandstorm")
  - Task 2: create_team(name="team4", hackathon_query="L'Oréal Brandstorm")
  - Task 3: submit_hackathon(name="unstopDummy", ...) - BUT need dates/location first!
→ ASK: "I need start date, end date, location, and region for 'unstopDummy'"

Example 3 - "Create team1 team3 in hackathonX, remove friend Y, and add hackathon dummy7"
→ 4 TASKS:
  - Task 1: create_team(name="team1", hackathon_query="hackathonX")
  - Task 2: create_team(name="team3", hackathon_query="hackathonX")
  - Task 3: remove_friend(user="Y")
  - Task 4: submit_hackathon(name="dummy7", ...) - need dates/location first!
→ NEVER assume max 3 tasks. Count EVERY distinct action!

Example 4 - "Create two teams team1 team3 in MLH global hack week and then send friend request to 'Soumyajit' then add a hackathon named dummy8 with info 01/02/26 09/08/26 online asia"
→ 4 TASKS (user provided ALL info):
  - Task 1: create_team(name="team1", hackathon_query="MLH global hack week")
  - Task 2: create_team(name="team3", hackathon_query="MLH global hack week")
  - Task 3: send_friend_request(user_query="Soumyajit")
  - Task 4: submit_hackathon(name="dummy8", start_date="2026-01-02", end_date="2026-09-08", location="Online", region="Asia")
→ Call ALL 4 tools in ONE response!

Example 5 - "perform all 4 tasks" / "confirm" / "do it"
→ IMMEDIATELY execute ALL previously listed tasks
→ DO NOT ask for confirmation again
→ Call all tool functions and report combined results

Example 6 - "Remove friend X and send new request to X"
→ 2 TASKS → Call remove_friend, then send_friend_request

Example 7 - "Send friend request to John"
→ 1 TASK → Call send_friend_request ONCE only

Example 8 - "Where is the friends page?"
→ Tell them: "The Friends page is at /friends. You can also find it in the navigation bar at the top. Would you like me to take you there?"
→ If they say yes, use navigate_to_page(path="/friends")

Example 9 - "Show me the calendar view" / "Take me to calendar"
→ Use navigate_to_page(path="/", description="Calendar view")

Example 10 - "Create 5 teams: alpha, beta, gamma, delta, epsilon for HackMIT"
→ 5 TASKS → Call create_team FIVE times

Example 11 - "Remove friends A, B, C and send requests to X, Y"
→ 5 TASKS:
  - remove_friend(A)
  - remove_friend(B)
  - remove_friend(C)
  - send_friend_request(X)
  - send_friend_request(Y)

Example 12 - "Add hackathon TestHack starting 2026-03-01 ending 2026-03-15 in Boston, North America"
→ 1 TASK with ALL info provided:
  - submit_hackathon(name="TestHack", start_date="2026-03-01", end_date="2026-03-15", location="Boston", region="North America")

═══════════════════════════════════════════════════════════════
CRITICAL RULES (MEMORIZE THESE)
═══════════════════════════════════════════════════════════════

1. There is NO maximum number of tasks. 1, 2, 3, 4, 5, 10, 20 - detect ALL.
2. If user says "perform X tasks", you MUST detect exactly X tasks.
3. If user confirms ("yes", "confirm", "do it", "proceed"), execute ALL pending tasks immediately.
4. When user provides all info upfront, EXECUTE - don't ask again.
5. Count team names separately: "team1, team2, team3" = 3 create_team calls.
6. Count friend names separately: "remove A, B, C" = 3 remove_friend calls.
7. Date formats: DD/MM/YY → YYYY-MM-DD (01/02/26 = 2026-02-01)
8. Parse natural language locations: "online asia" = location="Online", region="Asia"
9. Be SMART: understand context, don't be literal.
10. LEARN from each interaction - save successful patterns.

═══════════════════════════════════════════════════════════════
ADMIN TRAINING CAPABILITIES (ADMIN USERS ONLY)
═══════════════════════════════════════════════════════════════

If an ADMIN user wants to train you with examples:
- Use admin_train_ai tool to add new patterns
- Use get_ai_learning_stats to see learning statistics
- Use delete_ai_pattern to remove bad patterns

Example training command: "Train AI: when user says 'create teams X and Y for hackathon Z', call create_team twice"
→ Call admin_train_ai with:
  - example_request: "create teams X and Y for hackathon Z"
  - tool_sequence: ["create_team", "create_team"]

The AI learns automatically from:
- Every successful multi-task execution (priority learning)
- Every successful single-task execution
- Admin-provided examples (highest priority)

Low-quality patterns are automatically removed if they fail too often.`;

    // Inject learned patterns into system prompt
    const learnedPatterns = await getLearnedPatterns(supabase);
    if (learnedPatterns) {
      systemPrompt += learnedPatterns;
    }

    if (existingSummary?.summary) {
      systemPrompt += `\n\nPrevious conversation summary:\n${existingSummary.summary}`;
    }
    
    // Periodically cleanup bad patterns (1% chance per request)
    if (Math.random() < 0.01) {
      cleanupBadPatterns(supabase);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Track execution time for learning
    const executionStartTime = Date.now();

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
      const confirmedOk = !!result.result && !result.result.error;
      const confirmedMsg =
        result.result?.message || (confirmedOk ? "Action completed." : "Action failed");

      const executionTime = Date.now() - executionStartTime;
      const patternHash = generatePatternHash(message);
      
      recordLearningFeedback(
        supabase,
        message,
        confirmedMsg,
        [{ name: confirmedAction.name, arguments: confirmedAction.arguments }],
        confirmedOk,
        executionTime,
        false // single action
      );

      // Track pattern failure if action failed
      if (!confirmedOk) {
        recordPatternFailure(supabase, patternHash);
      }

      // Update summary in background
      if (shouldUpdateSummary) {
        updateConversationSummary(supabase, user.id, recentHistory, LOVABLE_API_KEY);
      }

      const responseText = confirmedOk
        ? `✅ ${confirmedMsg}`
        : `❌ ${result.result?.error || "Action failed"}`;

      return new Response(
        JSON.stringify({
          response: sanitizeResponse(responseText),
          toolResults: [result.result],
          actionCompleted: result.result?.action_type || confirmedAction.name,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call AI with tools - with retry logic and Perplexity fallback
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    
    const callAIWithRetry = async (body: any, maxRetries = 3): Promise<Response> => {
      // Try Lovable AI first
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });

          if (response.ok) {
            return response;
          }

          if (response.status === 429) {
            const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 500;
            console.log(`Lovable AI rate limited, retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})`);
            
            if (attempt < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
          } else {
            const errorText = await response.text();
            console.error("Lovable AI error:", response.status, errorText);
            break; // Try fallback
          }
        } catch (e) {
          console.error("Lovable AI request failed:", e);
          break; // Try fallback
        }
      }

      // Fallback to Perplexity for non-tool-calling requests
      if (PERPLEXITY_API_KEY && !body.tools) {
        console.log("Falling back to Perplexity API...");
        try {
          const perplexityResponse = await fetch("https://api.perplexity.ai/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "sonar",
              messages: body.messages,
              stream: body.stream || false,
            }),
          });

          if (perplexityResponse.ok) {
            console.log("Perplexity fallback successful");
            return perplexityResponse;
          }
          console.error("Perplexity fallback failed:", perplexityResponse.status);
        } catch (e) {
          console.error("Perplexity request failed:", e);
        }
      }

      throw new Error("RATE_LIMITED");
    };

    let aiResponse: Response;
    try {
      aiResponse = await callAIWithRetry({
        model: "google/gemini-2.5-flash",
        messages,
        tools,
        tool_choice: "auto",
        stream: false,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "RATE_LIMITED") {
        return new Response(
          JSON.stringify({
            error: "I'm receiving too many requests right now. Please try again in a moment.",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw error;
    }

    const aiData = await aiResponse.json();
    const choice = aiData.choices?.[0];

    if (!choice) {
      throw new Error("No response from AI");
    }

    // Handle tool calls (non-streaming)
    if (choice.message?.tool_calls?.length > 0) {
      const toolResults = [];
      let pendingConfirmationActions: any[] = [];
      const executedToolCalls: any[] = [];

      // Check if user has explicitly requested auto-execution
      const lowerMessage = message.toLowerCase();
      const isAutoExecuteMode = 
        lowerMessage.includes("confirm") ||
        lowerMessage.includes("proceed") ||
        lowerMessage.includes("do it") ||
        lowerMessage.includes("yes") ||
        lowerMessage.includes("execute") ||
        lowerMessage.includes("perform") ||
        lowerMessage.includes("consecutively") ||
        lowerMessage.includes("all at once") ||
        lowerMessage.includes("together") ||
        lowerMessage.includes("run all") ||
        lowerMessage.includes("do all") ||
        /perform\s*\d+\s*task/i.test(lowerMessage);

      console.log(`Auto-execute mode: ${isAutoExecuteMode}, Tool calls: ${choice.message.tool_calls.length}`);

      for (let i = 0; i < choice.message.tool_calls.length; i++) {
        const toolCall = choice.message.tool_calls[i];
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || "{}");

        console.log(`Executing tool: ${toolName}`, toolArgs);

        // In auto-execute mode, force confirmation for all actions
        const result = await executeToolCall(
          toolName, 
          toolArgs, 
          supabase, 
          user.id, 
          profile, 
          isAutoExecuteMode,  // Force confirmed if auto-execute mode
          { currentHackathonId }
        );

        if (result.needsConfirmation && !isAutoExecuteMode) {
          // In normal mode, queue this for confirmation
          pendingConfirmationActions.push({
            name: toolName,
            arguments: toolArgs,
            message: result.confirmationMessage,
          });
        } else {
          // Either auto-execute mode or action doesn't need confirmation
          toolResults.push({ tool: toolName, result: result.result });
          executedToolCalls.push({ name: toolName, arguments: toolArgs });
        }
      }

      // If there are pending confirmations (only in non-auto-execute mode)
      if (pendingConfirmationActions.length > 0 && !isAutoExecuteMode) {
        // Build a combined confirmation message for ALL pending actions
        let confirmMessage = "I'm ready to perform the following actions:\n\n";
        pendingConfirmationActions.forEach((action, idx) => {
          confirmMessage += `${idx + 1}. ${action.message.replace(/^I'll |^Should I |^\? /, '')}\n`;
        });
        confirmMessage += "\nShould I proceed with all of these?";
        
        return new Response(
          JSON.stringify({
            response: confirmMessage,
            pendingConfirmation: pendingConfirmationActions[0], // For backward compatibility
            allPendingActions: pendingConfirmationActions,
            alreadyExecuted: toolResults.length > 0 ? toolResults : undefined,
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

      // Always return JSON for tool results so the client can execute actions
      // (opening links/populating clipboard cannot reliably happen if we only stream text).


      const summaryResponse = await callAIWithRetry({
        model: "google/gemini-2.5-flash",
        messages: summaryMessages,
        stream: false,
      });

      const summaryData = await summaryResponse.json();
      const summaryContent =
        summaryData.choices?.[0]?.message?.content || "I completed the action.";

      // Record learning feedback for successful tool execution
      const executionTime = Date.now() - executionStartTime;
      const allToolsSucceeded = toolResults.every((tr: any) => !tr.result?.error);
      const isMultiTask = choice.message.tool_calls.length > 1;
      
      recordLearningFeedback(
        supabase,
        message,
        summaryContent,
        choice.message.tool_calls.map((tc: any) => ({ 
          name: tc.function.name, 
          arguments: JSON.parse(tc.function.arguments || "{}") 
        })),
        allToolsSucceeded,
        executionTime,
        isMultiTask // multi-task patterns get priority
      );

      // Track failures if any tool failed
      if (!allToolsSucceeded) {
        const patternHash = generatePatternHash(message);
        recordPatternFailure(supabase, patternHash);
      }

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
      try {
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

        if (!streamResponse.ok) {
          const errorText = await streamResponse.text();
          console.error("Streaming failed:", streamResponse.status, errorText);
          // Fall through to non-streaming response
        } else if (streamResponse.body) {
          // Update summary in background
          if (shouldUpdateSummary) {
            updateConversationSummary(supabase, user.id, recentHistory, LOVABLE_API_KEY);
          }

          return new Response(streamResponse.body, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
          });
        }
      } catch (streamError) {
        console.error("Stream error, falling back to non-streaming:", streamError);
      }
      // Fall through to non-streaming response below
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
