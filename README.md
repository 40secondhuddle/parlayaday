# 🎲 Parlay-A-Day

A full-stack sports parlay betting application built with React 19, Vite, Tailwind CSS v3, and Supabase.

![Dark Mode](https://img.shields.io/badge/Theme-Dark-060813)
![React](https://img.shields.io/badge/React-19-61DAFB)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4.19-38BDF8)

## ✨ Features

### 🎯 Core Functionality
- **Dynamic Betting Slip**: Real-time wager multiplier with 1x to 5x token wagering
- **Live Game State**: Auto-locking when games start, with "LIVE" badges
- **Parlay System**: Exponential payout formula: `100 × 2^(n-1) × Tokens`
- **Smart Claiming**: Bulk claim for settled tickets with automatic point calculation
- **Toast Notifications**: Real-time feedback for all actions

### 🏆 Tabs & Navigation
- **Picks Tab**: Today's matchups with live lock status
- **History Tab**: Open and Settled tickets with expandable details
- **Leaderboard Tab**: Daily, Weekly, and Monthly rankings
- **Profile Tab**: User stats and account management

### 🔒 Security & Database
- **Row Level Security (RLS)**: Users can only access their own data
- **Server-Side RPCs**: Points and tokens managed via secure functions
- **Auth Integration**: Supabase authentication with email/password
- **Data Integrity**: Validation and constraints on all critical operations

### 🎨 Design
- **Dark Theme**: Professional `#060813` background
- **Bold Typography**: Black-italic, uppercase styling
- **Lucide Icons**: Modern icon library
- **Responsive**: Mobile-first design with smooth animations

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account ([sign up free](https://supabase.com))

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/parlay-a-day.git
cd parlay-a-day
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up Supabase**

Create a new Supabase project and run the SQL from `DATABASE_SETUP.md` in the SQL Editor.

4. **Configure environment variables**

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

5. **Start development server**
```bash
npm run dev
```

Visit `http://localhost:5173`

## 📦 Project Structure

```
parlay-a-day/
├── src/
│   ├── App.jsx           # Main application component
│   ├── main.jsx          # Entry point with Toaster
│   ├── index.css         # Tailwind directives + custom styles
│   └── supabase.js       # Supabase client configuration
├── public/               # Static assets
├── index.html            # HTML entry point
├── package.json          # Dependencies (Tailwind v3)
├── tailwind.config.js    # Tailwind configuration
├── postcss.config.js     # PostCSS configuration
├── vite.config.js        # Vite configuration
├── DATABASE_SETUP.md     # Complete database schema & RLS
└── README.md             # This file
```

## 🗄️ Database Schema

### Tables

**profiles**
- `id` (UUID, PK) - User ID from auth.users
- `username` (TEXT) - Display name
- `beta_tokens` (INTEGER) - Available wagering tokens
- `points` (INTEGER) - Total points earned

**matchups**
- `id` (UUID, PK)
- `player_name` (TEXT) - Athlete name
- `category` (TEXT) - Sport (NBA, NFL, NHL, MLB)
- `question` (TEXT) - Prop question
- `option_a` (TEXT) - First option (e.g., "Over 25.5")
- `option_b` (TEXT) - Second option (e.g., "Under 25.5")
- `lock_time` (TIMESTAMPTZ) - When betting closes
- `winning_option` (TEXT) - 'A', 'B', or NULL
- `scheduled_date` (DATE) - Game date

**user_picks**
- `id` (UUID, PK)
- `user_id` (UUID, FK) - References profiles
- `matchup_id` (UUID, FK) - References matchups
- `selected_option` (TEXT) - 'A' or 'B'
- `entry_group` (TEXT) - Groups picks into parlays
- `wager_amount` (INTEGER) - 1-5 tokens
- `is_claimed` (BOOLEAN) - Settlement status

### RLS Policies

✅ Users can SELECT and INSERT only their own picks
✅ Users can view all profiles (read-only for leaderboard)
✅ Users CANNOT directly update points or tokens
✅ Secure RPC functions handle all point/token changes

## 🔐 Security Features

### Row Level Security (RLS)

```sql
-- Example: Users can only view their own picks
CREATE POLICY "Users can view own picks"
  ON public.user_picks
  FOR SELECT
  USING (auth.uid() = user_id);
```

### Secure RPC Function

```sql
-- Server-side function to claim parlays
CREATE FUNCTION claim_parlay(
  p_entry_group TEXT,
  p_user_id UUID,
  p_points_won INTEGER,
  p_tokens_return INTEGER
)
```

This prevents client-side tampering with points/tokens.

## 🎮 How to Play

1. **Sign Up**: Create an account (starts with 5 tokens)
2. **Make Picks**: Select predictions from today's board
3. **Set Wager**: Choose 1x to 5x token multiplier
4. **Submit Ticket**: Lock in your parlay
5. **Wait for Settlement**: Games must finish and be graded
6. **Claim Rewards**: Hit "Settle" to collect points and tokens

### Payout Formula

```
Payout = 100 × 2^(n-1) × Wager
```

Where `n` = number of legs

**Examples:**
- 2-leg parlay × 3 tokens = 100 × 2^1 × 3 = **600 points**
- 3-leg parlay × 5 tokens = 100 × 2^2 × 5 = **2,000 points**
- 5-leg parlay × 1 token = 100 × 2^4 × 1 = **1,600 points**

## 🛠️ Development

### Build Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

### Clean Install (if styles break)

```bash
rm -rf node_modules package-lock.json .vite
npm install
npm run dev
```

### Testing Database Changes

Use Supabase Studio (dashboard) to:
1. Insert test matchups
2. Manually settle games (set `winning_option`)
3. View user picks and profiles
4. Monitor RLS policy effectiveness

## 🚀 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy!

### Other Platforms

Works on: Netlify, Cloudflare Pages, Render, Railway

**Build Settings:**
- Build command: `npm run build`
- Output directory: `dist`
- Node version: 18+

## 🐛 Troubleshooting

### Styles Not Loading
- Verify `postcss.config.js` exists
- Check that `index.css` has `@tailwind` directives
- Clear cache: `rm -rf .vite node_modules && npm install`

### Supabase Connection Issues
- Verify `.env.local` has correct credentials
- Check Supabase project is not paused
- Ensure RLS policies are created

### Can't Submit Picks
- Check if matchup `lock_time` has passed
- Verify user has enough tokens
- Look for console errors

### Points Not Updating
- Ensure `claim_parlay` RPC function exists
- Check RLS policies on `profiles` table
- Verify all matchups have `winning_option` set

## 📝 To-Do / Roadmap

- [ ] Add user profile editing (username, avatar)
- [ ] Implement admin panel for settling matchups
- [ ] Add push notifications for game results
- [ ] Create leaderboard prizes and achievements
- [ ] Add social features (follow friends, share picks)
- [ ] Implement scheduled jobs for auto-settlement
- [ ] Add detailed statistics and analytics
- [ ] Support for more sports and bet types

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - feel free to use this project for learning or production.

## 🙏 Acknowledgments

- Built with [React](https://react.dev/) 19
- Styled with [Tailwind CSS](https://tailwindcss.com/) v3
- Backend by [Supabase](https://supabase.com/)
- Icons from [Lucide React](https://lucide.dev/)
- Toasts by [React Hot Toast](https://react-hot-toast.com/)

---

**Made with ❤️ for sports betting enthusiasts**

Need help? Open an issue or contact [your-email@example.com]
