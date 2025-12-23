-- Add hidden_at column for soft delete of chat messages
ALTER TABLE public.ai_chat_messages ADD COLUMN IF NOT EXISTS hidden_at timestamp with time zone DEFAULT NULL;

-- Create index for faster queries on non-hidden messages
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_hidden_at ON public.ai_chat_messages(hidden_at) WHERE hidden_at IS NULL;