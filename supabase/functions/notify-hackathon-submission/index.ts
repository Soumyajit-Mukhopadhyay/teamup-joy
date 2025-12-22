import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HackathonNotificationRequest {
  hackathon_id: string;
  hackathon_name: string;
  submitter_username: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("notify-hackathon-submission function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hackathon_id, hackathon_name, submitter_username }: HackathonNotificationRequest = await req.json();

    console.log(`Processing notification for hackathon: ${hackathon_name} by ${submitter_username}`);

    // Get admin emails from user_roles table
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all admin user IDs
    const { data: adminRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (rolesError) {
      console.error("Error fetching admin roles:", rolesError);
      throw new Error("Failed to fetch admin users");
    }

    if (!adminRoles || adminRoles.length === 0) {
      console.log("No admin users found");
      return new Response(
        JSON.stringify({ message: "No admins to notify" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get admin emails from auth.users
    const adminUserIds = adminRoles.map(r => r.user_id);
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error("Error fetching users:", usersError);
      throw new Error("Failed to fetch user emails");
    }

    const adminEmails = users
      .filter(u => adminUserIds.includes(u.id) && u.email)
      .map(u => u.email!);

    if (adminEmails.length === 0) {
      console.log("No admin emails found");
      return new Response(
        JSON.stringify({ message: "No admin emails to notify" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending notification to ${adminEmails.length} admin(s)`);

    // Send email to all admins
    const emailResponse = await resend.emails.send({
      from: "HackathonHub <onboarding@resend.dev>",
      to: adminEmails,
      subject: `New Hackathon Submission: ${hackathon_name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #8B5CF6, #D946EF); padding: 30px; border-radius: 12px 12px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
            .hackathon-name { font-size: 20px; font-weight: bold; color: #8B5CF6; margin-bottom: 10px; }
            .info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb; }
            .cta { display: inline-block; background: linear-gradient(135deg, #8B5CF6, #D946EF); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚀 New Hackathon Submission</h1>
            </div>
            <div class="content">
              <div class="info">
                <div class="hackathon-name">${hackathon_name}</div>
                <p><strong>Submitted by:</strong> @${submitter_username}</p>
                <p>A new hackathon has been submitted and is waiting for your approval.</p>
              </div>
              <p>Please review this submission in the admin panel to approve or reject it.</p>
              <a href="${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovable.app') || '#'}/admin" class="cta">
                Review Submission
              </a>
              <div class="footer">
                <p>HackathonHub Admin Notification</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in notify-hackathon-submission:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);