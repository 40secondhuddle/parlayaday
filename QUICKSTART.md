# 🚀 Quick Start Guide

Get Parlay-A-Day running in 10 minutes!

## Step 1: Install Dependencies

```bash
npm install
```

This installs React 19, Tailwind CSS v3, Supabase, and all required packages.

## Step 2: Set Up Supabase

### 2.1 Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Create a new organization (if needed)
4. Create a new project
5. Wait 2-3 minutes for setup to complete

### 2.2 Run the Database Setup

1. In your Supabase dashboard, go to **SQL Editor**
2. Open `DATABASE_SETUP.md` in this project
3. Copy and paste each SQL block into the editor
4. Run each block in order:
   - ✅ Create `profiles` table
   - ✅ Create `matchups` table  
   - ✅ Create `user_picks` table
   - ✅ Create `claim_parlay` RPC function
   - ✅ Insert sample data (optional)

### 2.3 Get Your API Credentials

1. Go to **Project Settings** → **API**
2. Copy your **Project URL** (looks like: `https://xxx.supabase.co`)
3. Copy your **anon/public key** (starts with `eyJ...`)

## Step 3: Configure Environment Variables

1. Copy the example env file:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and add your credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

## Step 4: Start the Dev Server

```bash
npm run dev
```

The app should open at `http://localhost:5173`

## Step 5: Test the Application

### Create an Account
1. Click "Sign Up"
2. Enter email and password
3. Check your email for verification
4. Sign in

### Make a Pick
1. Go to **Picks** tab
2. Select predictions on today's matchups
3. Choose a wager amount (1x - 5x)
4. Click "Submit Ticket"

### Settle a Game (Manually for Testing)
1. Go to Supabase Dashboard → **Table Editor**
2. Find the `matchups` table
3. Update a matchup's `winning_option` to either 'A' or 'B'
4. Return to the app

### Claim Your Ticket
1. Go to **History** tab
2. Click "Settle" on any ready tickets
3. Watch your points and tokens update!

## 🎉 You're All Set!

### What's Next?

- **Add more matchups** in the Supabase table editor
- **Invite friends** to test the leaderboard
- **Deploy to production** (see README.md for deployment guides)

## 🐛 Common Issues

### "Failed to load matchups"
- Check that sample data was inserted in Step 2.2
- Verify the `scheduled_date` matches today's date

### "Insufficient tokens"
- Check your profile in the database
- Default is 5 tokens - you may have used them all
- Manually update `beta_tokens` in the `profiles` table for testing

### Styles look broken
- Make sure `npm install` completed successfully
- Delete `.vite` folder and restart: `rm -rf .vite && npm run dev`
- Check that `postcss.config.js` and `tailwind.config.js` exist

### Can't sign in
- Verify Supabase project is not paused
- Check that `.env.local` has correct credentials
- Make sure email verification is set to "disabled" in Supabase Auth settings (for testing)

## 📚 Learn More

- Read `README.md` for full documentation
- Check `DATABASE_SETUP.md` for database details
- Review security policies in the Supabase dashboard

---

**Need help?** Open an issue or check the troubleshooting section in README.md
