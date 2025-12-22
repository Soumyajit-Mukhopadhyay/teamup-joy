-- Create table for HackerBuddy chat messages
CREATE TABLE public.ai_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tool_calls JSONB DEFAULT NULL,
  tool_results JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster user queries
CREATE INDEX idx_ai_chat_messages_user_id ON public.ai_chat_messages(user_id);
CREATE INDEX idx_ai_chat_messages_created_at ON public.ai_chat_messages(created_at);

-- Enable RLS
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can only view their own messages
CREATE POLICY "Users can view their own AI chat messages"
ON public.ai_chat_messages
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own messages
CREATE POLICY "Users can insert their own AI chat messages"
ON public.ai_chat_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own messages (for clearing chat)
CREATE POLICY "Users can delete their own AI chat messages"
ON public.ai_chat_messages
FOR DELETE
USING (auth.uid() = user_id);

-- Create table for conversation summaries (for RAG)
CREATE TABLE public.ai_conversation_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  summary TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  last_summarized_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_conversation_summaries ENABLE ROW LEVEL SECURITY;

-- Users can only access their own summaries
CREATE POLICY "Users can view their own conversation summary"
ON public.ai_conversation_summaries
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversation summary"
ON public.ai_conversation_summaries
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversation summary"
ON public.ai_conversation_summaries
FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_ai_conversation_summaries_updated_at
BEFORE UPDATE ON public.ai_conversation_summaries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();