# Supabase Database Setup for Parlay-A-Day

Run these SQL commands in your Supabase SQL Editor to set up the database:

## 1. Enable Row Level Security

```sql
-- Enable RLS on auth.users (already enabled by default in Supabase)
-- We'll create custom tables with RLS enabled
```

## 2. Create Tables

### Profiles Table

```sql
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT,
  beta_tokens INTEGER DEFAULT 5 NOT NULL,
  points INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile username only"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    -- Prevent direct updates to points and beta_tokens via client
    points = (SELECT points FROM public.profiles WHERE id = auth.uid()) AND
    beta_tokens = (SELECT beta_tokens FROM public.profiles WHERE id = auth.uid())
  );

-- Create trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, beta_tokens, points)
  VALUES (NEW.id, NEW.email, 5, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Matchups Table

```sql
CREATE TABLE IF NOT EXISTS public.matchups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name TEXT NOT NULL,
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  lock_time TIMESTAMP WITH TIME ZONE NOT NULL,
  winning_option TEXT CHECK (winning_option IN ('A', 'B') OR winning_option IS NULL),
  scheduled_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.matchups ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read matchups
CREATE POLICY "Anyone can view matchups"
  ON public.matchups
  FOR SELECT
  USING (true);

-- Policy: Only admins can insert/update matchups (handled via service role or admin panel)
-- For now, we'll allow inserts for testing - remove this in production
CREATE POLICY "Service role can manage matchups"
  ON public.matchups
  FOR ALL
  USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_matchups_scheduled_date 
  ON public.matchups(scheduled_date);
```

### User Picks Table

```sql
CREATE TABLE IF NOT EXISTS public.user_picks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  matchup_id UUID REFERENCES public.matchups(id) ON DELETE CASCADE NOT NULL,
  selected_option TEXT NOT NULL CHECK (selected_option IN ('A', 'B')),
  entry_group TEXT NOT NULL,
  wager_amount INTEGER DEFAULT 1 NOT NULL CHECK (wager_amount > 0),
  is_claimed BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_picks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own picks
CREATE POLICY "Users can view own picks"
  ON public.user_picks
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can only insert their own picks
CREATE POLICY "Users can insert own picks"
  ON public.user_picks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users cannot update picks directly (only via RPC)
CREATE POLICY "No direct updates to picks"
  ON public.user_picks
  FOR UPDATE
  USING (false);

-- Policy: Users cannot delete picks
CREATE POLICY "No deleting picks"
  ON public.user_picks
  FOR DELETE
  USING (false);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_picks_user_id 
  ON public.user_picks(user_id);

CREATE INDEX IF NOT EXISTS idx_user_picks_entry_group 
  ON public.user_picks(entry_group);

CREATE INDEX IF NOT EXISTS idx_user_picks_created_at 
  ON public.user_picks(created_at);
```

## 3. Create RPC Functions for Secure Operations

### Claim Parlay Function

```sql
CREATE OR REPLACE FUNCTION public.claim_parlay(
  p_entry_group TEXT,
  p_user_id UUID,
  p_points_won INTEGER,
  p_tokens_return INTEGER
)
RETURNS VOID AS $$
BEGIN
  -- Verify the caller owns this entry group
  IF NOT EXISTS (
    SELECT 1 FROM public.user_picks
    WHERE entry_group = p_entry_group
    AND user_id = p_user_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Entry group does not belong to user';
  END IF;

  -- Verify all picks in the group are settled
  IF EXISTS (
    SELECT 1 FROM public.user_picks up
    JOIN public.matchups m ON up.matchup_id = m.id
    WHERE up.entry_group = p_entry_group
    AND m.winning_option IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot claim: Not all matchups are settled';
  END IF;

  -- Mark all picks in the entry group as claimed
  UPDATE public.user_picks
  SET is_claimed = true
  WHERE entry_group = p_entry_group
  AND user_id = p_user_id;

  -- Update user's points and return tokens
  UPDATE public.profiles
  SET 
    points = points + p_points_won,
    beta_tokens = beta_tokens + p_tokens_return,
    updated_at = NOW()
  WHERE id = p_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Admin Function to Settle Matchups (Optional)

```sql
CREATE OR REPLACE FUNCTION public.settle_matchup(
  p_matchup_id UUID,
  p_winning_option TEXT
)
RETURNS VOID AS $$
BEGIN
  -- In production, add admin role check here
  UPDATE public.matchups
  SET winning_option = p_winning_option
  WHERE id = p_matchup_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 4. Insert Sample Data (For Testing)

```sql
-- Insert sample matchups for today
INSERT INTO public.matchups (
  player_name,
  category,
  question,
  option_a,
  option_b,
  lock_time,
  scheduled_date
) VALUES
  (
    'LeBron James',
    'NBA',
    'Total Points',
    'Over 25.5',
    'Under 25.5',
    NOW() + INTERVAL '2 hours',
    CURRENT_DATE
  ),
  (
    'Patrick Mahomes',
    'NFL',
    'Passing Yards',
    'Over 300.5',
    'Under 300.5',
    NOW() + INTERVAL '4 hours',
    CURRENT_DATE
  ),
  (
    'Connor McDavid',
    'NHL',
    'Points',
    'Over 1.5',
    'Under 1.5',
    NOW() + INTERVAL '3 hours',
    CURRENT_DATE
  ),
  (
    'Aaron Judge',
    'MLB',
    'Total Bases',
    'Over 1.5',
    'Under 1.5',
    NOW() + INTERVAL '5 hours',
    CURRENT_DATE
  );
```

## 5. Grant Necessary Permissions

```sql
-- Grant execute permission on RPC functions to authenticated users
GRANT EXECUTE ON FUNCTION public.claim_parlay TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_matchup TO authenticated;

-- Grant usage on sequences (if any)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
```

## 6. Environment Variables

Create a `.env.local` file in your project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Get these values from: Supabase Dashboard → Project Settings → API

## Security Notes

1. **RLS Policies**: All tables have Row Level Security enabled
2. **Token Management**: Users cannot directly modify their `beta_tokens` or `points` - only via RPC
3. **Pick Integrity**: Users can only insert their own picks and cannot update/delete them
4. **Claim Verification**: The `claim_parlay` RPC verifies ownership and settlement status
5. **Admin Functions**: The `settle_matchup` function should be restricted to admin roles in production

## Testing the Setup

1. Sign up for a new account
2. Check that you receive 5 beta tokens automatically
3. Try selecting picks and submitting a ticket
4. Manually settle a matchup (update `winning_option` in the database)
5. Claim your ticket and verify points/tokens are updated

## Production Hardening

For production deployment:

1. Remove the permissive `matchups` policy and restrict to service role
2. Add admin role checks to `settle_matchup` function
3. Add rate limiting on pick submissions
4. Add validation for wager amounts based on available tokens
5. Implement scheduled jobs to auto-settle matchups when games end
6. Add comprehensive logging and error handling
