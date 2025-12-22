-- Add new columns to ai_learning_feedback for better pattern learning
ALTER TABLE public.ai_learning_feedback 
ADD COLUMN IF NOT EXISTS tool_sequence TEXT[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS multi_task_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS execution_time_ms INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pattern_hash TEXT DEFAULT NULL;

-- Create index for faster pattern lookups
CREATE INDEX IF NOT EXISTS idx_learning_feedback_pattern 
ON public.ai_learning_feedback(pattern_hash) 
WHERE was_successful = true;

CREATE INDEX IF NOT EXISTS idx_learning_feedback_request_type 
ON public.ai_learning_feedback(request_type) 
WHERE was_successful = true;

-- Create a table to store learned patterns (aggregated successful patterns)
CREATE TABLE IF NOT EXISTS public.ai_learned_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern_hash TEXT NOT NULL UNIQUE,
  request_pattern TEXT NOT NULL,
  tool_sequence TEXT[] NOT NULL,
  success_count INTEGER NOT NULL DEFAULT 1,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  example_request TEXT,
  example_response TEXT
);

-- Enable RLS on the new table
ALTER TABLE public.ai_learned_patterns ENABLE ROW LEVEL SECURITY;

-- System can read/write patterns (used by edge function with service role)
CREATE POLICY "System can manage patterns" 
ON public.ai_learned_patterns 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create index for pattern lookup by success rate
CREATE INDEX IF NOT EXISTS idx_learned_patterns_success 
ON public.ai_learned_patterns((success_count::float / NULLIF(success_count + failure_count, 0)) DESC);