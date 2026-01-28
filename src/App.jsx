import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import toast from 'react-hot-toast'
import {
  Layout,
  Trophy,
  History as HistoryIcon,
  User,
  Coins,
  Lock,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  TrendingUp,
  Info,
} from 'lucide-react'

export default function App() {
  // Auth State
  const [session, setSession] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // App State
  const [matchups, setMatchups] = useState([])
  const [selections, setSelections] = useState({})
  const [wagerAmount, setWagerAmount] = useState(1)
  const [userProfile, setUserProfile] = useState(null)
  const [activeEntries, setActiveEntries] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [lbFilter, setLbFilter] = useState('weekly')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('picks')
  const [historyFilter, setHistoryFilter] = useState('open')
  const [expandedTicket, setExpandedTicket] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Initialize auth and time ticker
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 10000) // Update every 10 seconds

    return () => {
      subscription.unsubscribe()
      clearInterval(timer)
    }
  }, [])

  // Fetch data when logged in
  useEffect(() => {
    if (session?.user) {
      fetchProfile()
      fetchMatchups()
      fetchHistory()
    }
  }, [session])

  // Fetch leaderboard when tab changes
  useEffect(() => {
    if (activeTab === 'leaderboard' && session) {
      fetchLeaderboard()
    }
  }, [activeTab, lbFilter, session])

  // ===== DATA FETCHING =====
  async function fetchProfile() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (error) {
      console.error('Profile fetch error:', error)
      return
    }
    setUserProfile(data)
  }

  async function fetchMatchups() {
    setLoading(true)
    const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD format

    const { data, error } = await supabase
      .from('matchups')
      .select('*')
      .eq('scheduled_date', today)
      .order('lock_time', { ascending: true })

    if (error) {
      console.error('Matchups fetch error:', error)
      toast.error('Failed to load matchups')
    } else {
      setMatchups(data || [])
    }
    setLoading(false)
  }

  async function fetchHistory() {
    const { data, error } = await supabase
      .from('user_picks')
      .select('*, matchups(*)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('History fetch error:', error)
    } else {
      setActiveEntries(data || [])
    }
  }

  async function fetchLeaderboard() {
    setLoading(true)

    // Get all profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, points')

    if (!profiles) {
      setLoading(false)
      return
    }

    // Filter by timeframe
    let dateFilter = new Date()
    if (lbFilter === 'daily') {
      dateFilter.setHours(0, 0, 0, 0)
    } else if (lbFilter === 'weekly') {
      dateFilter.setDate(dateFilter.getDate() - 7)
    } else if (lbFilter === 'monthly') {
      dateFilter.setDate(dateFilter.getDate() - 30)
    }

    // Get picks for the timeframe
    const { data: picks } = await supabase
      .from('user_picks')
      .select('*, matchups(*)')
      .gte('created_at', dateFilter.toISOString())
      .eq('is_claimed', true)

    if (!picks) {
      setLoading(false)
      return
    }

    // Calculate points per user
    const userScores = {}
    profiles.forEach((p) => {
      userScores[p.id] = {
        username: p.username || 'Anonymous',
        points: 0,
        id: p.id,
      }
    })

    // Group picks by entry_group
    const grouped = picks.reduce((acc, pick) => {
      if (!acc[pick.entry_group]) {
        acc[pick.entry_group] = []
      }
      acc[pick.entry_group].push(pick)
      return acc
    }, {})

    // Calculate points for winning parlays
    Object.values(grouped).forEach((group) => {
      const userId = group[0].user_id
      const wager = group[0].wager_amount || 1
      const allWin = group.every(
        (leg) => leg.matchups?.winning_option === leg.selected_option
      )

      if (allWin && userScores[userId]) {
        const basePoints = 100 * Math.pow(2, group.length - 1)
        userScores[userId].points += basePoints * wager
      }
    })

    const sorted = Object.values(userScores).sort((a, b) => b.points - a.points)
    setLeaderboard(sorted)
    setLoading(false)
  }

  // ===== AUTH HANDLERS =====
  async function handleAuth(e) {
    e.preventDefault()
    setAuthLoading(true)

    if (authMode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Check your email to verify your account!')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Welcome back!')
      }
    }

    setAuthLoading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    toast.success('Signed out')
  }

  // ===== SELECTION HANDLERS =====
  function handleSelection(matchupId, option) {
    const matchup = matchups.find((m) => m.id === matchupId)
    if (!matchup) return

    const isLocked = currentTime >= new Date(matchup.lock_time)
    if (isLocked) return

    setSelections((prev) => {
      const next = { ...prev }
      if (next[matchupId] === option) {
        delete next[matchupId]
      } else {
        next[matchupId] = option
      }
      return next
    })
  }

  async function submitTicket() {
    const numPicks = Object.keys(selections).length
    if (numPicks === 0) {
      toast.error('Select at least one pick')
      return
    }

    if (!userProfile || userProfile.beta_tokens < wagerAmount) {
      toast.error('Insufficient tokens')
      return
    }

    setLoading(true)

    const entryGroup = Date.now().toString()
    const picks = Object.keys(selections).map((matchupId) => ({
      user_id: session.user.id,
      matchup_id: matchupId,
      selected_option: selections[matchupId],
      entry_group: entryGroup,
      wager_amount: wagerAmount,
      is_claimed: false,
    }))

    const { error } = await supabase.from('user_picks').insert(picks)

    if (error) {
      console.error('Insert error:', error)
      toast.error('Failed to submit ticket')
      setLoading(false)
      return
    }

    // Deduct tokens
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ beta_tokens: userProfile.beta_tokens - wagerAmount })
      .eq('id', session.user.id)

    if (updateError) {
      console.error('Token deduction error:', updateError)
      toast.error('Failed to deduct tokens')
    } else {
      toast.success('Ticket submitted!')
      setSelections({})
      setWagerAmount(1)
      fetchProfile()
      fetchHistory()
    }

    setLoading(false)
  }

  // ===== CLAIM HANDLERS =====
  async function claimTicket(entryGroup) {
    setLoading(true)

    const picks = activeEntries.filter((p) => p.entry_group === entryGroup)
    const wager = picks[0]?.wager_amount || 1
    const allWin = picks.every(
      (p) => p.matchups?.winning_option === p.selected_option
    )

    let pointsToAdd = 0
    if (allWin) {
      const basePoints = 100 * Math.pow(2, picks.length - 1)
      pointsToAdd = basePoints * wager
    }

    // Call RPC to claim
    const { error: rpcError } = await supabase.rpc('claim_parlay', {
      p_entry_group: entryGroup,
      p_user_id: session.user.id,
      p_points_won: pointsToAdd,
      p_tokens_return: wager,
    })

    if (rpcError) {
      console.error('Claim RPC error:', rpcError)
      toast.error('Failed to claim ticket')
    } else {
      if (allWin) {
        toast.success(`Won ${pointsToAdd.toLocaleString()} points!`)
      } else {
        toast.error('Parlay lost')
      }
      fetchProfile()
      fetchHistory()
    }

    setLoading(false)
  }

  async function claimAllTickets() {
    const grouped = activeEntries.reduce((acc, pick) => {
      if (!acc[pick.entry_group]) {
        acc[pick.entry_group] = []
      }
      acc[pick.entry_group].push(pick)
      return acc
    }, {})

    const readyGroups = Object.entries(grouped).filter(
      ([_, picks]) =>
        !picks[0].is_claimed &&
        picks.every((p) => p.matchups?.winning_option !== null)
    )

    if (readyGroups.length === 0) {
      toast.error('No tickets ready to claim')
      return
    }

    setLoading(true)

    for (const [group, _] of readyGroups) {
      await claimTicket(group)
    }

    setLoading(false)
  }

  async function cancelTicket(entryGroup) {
    // Show warning toast
    toast('⚠️ Warning: Unlocking will return token and void entry', {
      duration: 4000,
      icon: '⚠️',
    })

    // Wait a moment for user to see the warning
    await new Promise(resolve => setTimeout(resolve, 500))

    if (!confirm('Unlock this ticket? You will get your token(s) back but cannot win points.')) {
      return
    }

    setLoading(true)

    const picks = activeEntries.filter((p) => p.entry_group === entryGroup)
    const wager = picks[0]?.wager_amount || 1

    // Mark as claimed (voided) and return tokens
    const { error: updateError } = await supabase
      .from('user_picks')
      .update({ is_claimed: true })
      .eq('entry_group', entryGroup)

    if (updateError) {
      console.error('Unlock error:', updateError)
      toast.error('Failed to unlock ticket')
      setLoading(false)
      return
    }

    // Return tokens to user
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ beta_tokens: userProfile.beta_tokens + wager })
      .eq('id', session.user.id)

    if (profileError) {
      console.error('Token return error:', profileError)
      toast.error('Failed to return tokens')
    } else {
      toast.success(`Ticket unlocked. ${wager} token${wager > 1 ? 's' : ''} returned!`)
      fetchProfile()
      fetchHistory()
    }

    setLoading(false)
  }

  // ===== COMPUTED VALUES =====
  const selectionCount = Object.keys(selections).length
  const potentialWin =
    selectionCount > 0 ? 100 * Math.pow(2, selectionCount - 1) * wagerAmount : 0

  // Group history by entry_group
  const groupedHistory = activeEntries.reduce((acc, pick) => {
    if (!acc[pick.entry_group]) {
      acc[pick.entry_group] = []
    }
    acc[pick.entry_group].push(pick)
    return acc
  }, {})

  // ===== AUTH SCREEN =====
  if (!session) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center p-4">
        <div className="bg-card-bg border border-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black italic uppercase text-white mb-2 text-shadow">
              Parlay-A-Day
            </h1>
            <p className="text-gray-500 text-sm font-bold uppercase">
              Daily Sports Betting Challenge
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-app-bg border border-gray-800 rounded-xl text-white font-bold placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-app-bg border border-gray-800 rounded-xl text-white font-bold placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all"
            />
            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-xl font-black italic uppercase text-white transition-all disabled:opacity-50"
            >
              {authLoading ? 'Loading...' : authMode === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <button
            onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
            className="w-full mt-4 text-gray-500 hover:text-blue-500 text-sm font-bold uppercase transition-all"
          >
            {authMode === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
          </button>
        </div>
      </div>
    )
  }

  // ===== MAIN APP =====
  return (
    <div className="min-h-screen bg-app-bg pb-24">
      {/* Header */}
      <nav className="bg-nav-bg border-b border-gray-800 px-4 py-4 sticky top-0 z-40">
  <div className="flex justify-between items-center max-w-md mx-auto">
    <div>
      <h1 className="text-xl font-black italic uppercase text-white">
        Parlay-A-Day
      </h1>
      <p className="text-[10px] text-gray-500 font-bold uppercase">
        {userProfile?.username || 'Player'}
      </p>
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={() => setActiveTab('info')}
        className="p-2 rounded-lg hover:bg-gray-800/50 transition-all"
      >
        <Info size={20} className="text-gray-500 hover:text-blue-500" />
      </button>
            <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/30 text-blue-500">
              <TrendingUp size={14} />
              <span className="text-xs font-black">
                {userProfile?.points?.toLocaleString() || 0}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/30 text-yellow-500">
              <Coins size={14} />
              <span className="text-xs font-black">{userProfile?.beta_tokens || 0}</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="p-4 max-w-md mx-auto pb-80">
        {/* PICKS TAB */}
        {activeTab === 'picks' && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-widest">
              Today's Board
            </h3>

            {loading && matchups.length === 0 ? (
              <div className="text-center py-12 text-gray-600">Loading...</div>
            ) : matchups.length === 0 ? (
              <div className="bg-card-bg border border-gray-800 rounded-2xl p-8 text-center">
                <p className="text-gray-500 font-bold uppercase text-sm">
                  No matchups available today
                </p>
              </div>
            ) : (
              matchups.map((m) => {
                const isLocked = currentTime >= new Date(m.lock_time)
                const isLive = isLocked && m.winning_option === null

                return (
                  <div
                    key={m.id}
                    className={`bg-card-bg rounded-2xl border border-gray-800 p-4 shadow-xl transition-all ${
                      isLocked ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                        {m.category}
                      </p>
                      {isLive && (
                        <div className="flex items-center gap-1 bg-red-500/20 text-red-500 px-2 py-0.5 rounded-full border border-red-500/50">
                          <Lock size={10} />
                          <span className="text-[9px] font-black uppercase">Live</span>
                        </div>
                      )}
                    </div>

                    <h3 className="text-lg font-black italic uppercase mt-1 text-blue-500">
                      {m.player_name}
                    </h3>
                    <p className="text-white text-xs font-bold mb-4 mt-0.5 italic uppercase">
                      {m.question}
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        disabled={isLocked}
                        onClick={() => handleSelection(m.id, 'A')}
                        className={`py-3 rounded-xl font-black italic uppercase text-[15px] border-2 transition-all ${
                          selections[m.id] === 'A'
                            ? 'border-blue-500 bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]'
                            : 'border-gray-800 bg-app-bg text-white hover:border-gray-700 disabled:cursor-not-allowed'
                        }`}
                      >
                        {m.option_a}
                      </button>
                      <button
                        disabled={isLocked}
                        onClick={() => handleSelection(m.id, 'B')}
                        className={`py-3 rounded-xl font-black italic uppercase text-[15px] border-2 transition-all ${
                          selections[m.id] === 'B'
                            ? 'border-blue-500 bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]'
                            : 'border-gray-800 bg-app-bg text-white hover:border-gray-700 disabled:cursor-not-allowed'
                        }`}
                      >
                        {m.option_b}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex gap-2 bg-card-bg p-1 rounded-xl border border-gray-800">
              <button
                onClick={() => setHistoryFilter('open')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase italic transition-all ${
                  historyFilter === 'open'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-500'
                }`}
              >
                Open
              </button>
              <button
                onClick={() => setHistoryFilter('settled')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase italic transition-all ${
                  historyFilter === 'settled'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-500'
                }`}
              >
                Settled
              </button>
            </div>

            {/* Claim All Button */}
            {historyFilter === 'open' && (() => {
              const readyGroups = Object.entries(groupedHistory).filter(
                ([_, picks]) =>
                  !picks[0].is_claimed &&
                  picks.every((p) => p.matchups?.winning_option !== null)
              )

              return readyGroups.length > 0 ? (
                <button
                  onClick={claimAllTickets}
                  disabled={loading}
                  className="w-full bg-green-600/20 border border-green-500/50 py-3 rounded-xl font-black italic uppercase text-green-500 text-[10px] flex justify-center items-center gap-2 hover:bg-green-600/30 transition-all disabled:opacity-50"
                >
                  <CheckCircle2 size={14} />
                  {loading ? 'Processing...' : `Claim All (${readyGroups.length})`}
                </button>
              ) : null
            })()}

            {/* Tickets */}
            {Object.entries(groupedHistory)
              .filter(([_, picks]) =>
                historyFilter === 'open' ? !picks[0].is_claimed : picks[0].is_claimed
              )
              .map(([group, picks]) => {
                const wager = picks[0].wager_amount || 1
                const basePoints = 100 * Math.pow(2, picks.length - 1)
                const payout = basePoints * wager
                const isExpanded = expandedTicket === group
                const allSettled = picks.every((p) => p.matchups?.winning_option !== null)
                const allCorrect = picks.every(
                  (p) => p.selected_option === p.matchups?.winning_option
                )

                return (
                  <div
                    key={group}
                    className={`bg-card-bg border rounded-2xl overflow-hidden ${
                      allSettled && historyFilter === 'open'
                        ? 'border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.1)]'
                        : 'border-gray-800'
                    }`}
                  >
                    <div
                      onClick={() => setExpandedTicket(isExpanded ? null : group)}
                      className="p-4 flex justify-between items-center cursor-pointer hover:bg-app-bg/20 transition-all"
                    >
                      <div>
                        <p className="font-black italic text-sm uppercase text-white">
                          Parlay Slip
                          <span className="text-blue-500 ml-2">+{payout.toLocaleString()}</span>
                        </p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">
                          {picks.length} Legs • {wager}x Wager
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {allSettled && !picks[0].is_claimed && (
                          <span className="text-[9px] bg-yellow-500 text-black px-2 py-1 rounded font-black animate-pulse">
                            SETTLE
                          </span>
                        )}
                        {historyFilter === 'settled' &&
                          (allCorrect ? (
                            <CheckCircle2 size={18} className="text-green-500" />
                          ) : (
                            <XCircle size={18} className="text-red-500" />
                          ))}
                        <ChevronDown
                          size={20}
                          className={`text-gray-600 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-2 border-t border-gray-800 pt-3 bg-app-bg/40">
                        {picks.map((pick, i) => {
                          const settled = pick.matchups?.winning_option !== null
                          const win = pick.selected_option === pick.matchups?.winning_option

                          return (
                            <div
                              key={i}
                              className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0"
                            >
                              <div className="flex items-center gap-3">
                                {!settled ? (
                                  <Clock size={14} className="text-gray-600" />
                                ) : win ? (
                                  <CheckCircle2 size={14} className="text-green-500" />
                                ) : (
                                  <XCircle size={14} className="text-red-500" />
                                )}
                                <div className="flex flex-col">
                                  <p
                                    className={`font-black uppercase text-[11px] ${
                                      settled && !win ? 'text-gray-600 line-through' : 'text-white'
                                    }`}
                                  >
                                    {pick.matchups?.player_name}
                                  </p>
                                  <p className="text-[9px] text-gray-500 uppercase font-bold">
                                    {pick.matchups?.question}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[10px] font-black italic text-blue-500">
                                {pick.selected_option === 'A'
                                  ? pick.matchups?.option_a
                                  : pick.matchups?.option_b}
                              </span>
                            </div>
                          )
                        })}

                        {!picks[0].is_claimed && (
                          <div className="space-y-2 mt-4">
                            {allSettled ? (
                              <button
                              onClick={(e) => {
                                e.stopPropagation()
                                claimTicket(group)
                              }}
                              disabled={loading}
                              className="w-full bg-yellow-500 hover:bg-yellow-600 py-3 rounded-xl font-black italic uppercase text-black transition-all disabled:opacity-50"
                            >
                              {loading
                                ? 'Processing...'
                                : allCorrect
                                ? `Congrats! Claim Tokens (${wager}) and Points (+${payout.toLocaleString()})`
                                : `Claim Tokens (${wager})`}
                            </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  cancelTicket(group)
                                }}
                                disabled={loading}
                                className="w-full bg-red-600/20 border border-red-500/50 hover:bg-red-600/30 py-3 rounded-xl font-black italic uppercase text-red-500 transition-all disabled:opacity-50"
                              >
                                {loading ? 'Unlocking...' : 'Unlock'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

            {Object.entries(groupedHistory).filter(([_, picks]) =>
              historyFilter === 'open' ? !picks[0].is_claimed : picks[0].is_claimed
            ).length === 0 && (
              <div className="bg-card-bg border border-gray-800 rounded-2xl p-8 text-center">
                <p className="text-gray-500 font-bold uppercase text-sm">
                  No {historyFilter} tickets
                </p>
              </div>
            )}
          </div>
        )}

        {/* LEADERBOARD TAB */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-4">
            <div className="flex gap-2 bg-card-bg p-1 rounded-xl border border-gray-800">
              {['daily', 'weekly', 'monthly'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setLbFilter(filter)}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase italic transition-all ${
                    lbFilter === filter
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'text-gray-500'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="bg-card-bg rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
              <table className="w-full text-left">
                <thead className="bg-app-bg/50 border-b border-gray-800">
                  <tr className="text-[9px] font-black uppercase text-gray-500 italic">
                    <th className="p-4">Rank</th>
                    <th className="p-4">User</th>
                    <th className="p-4 text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan="3" className="p-8 text-center text-gray-600">
                        Loading...
                      </td>
                    </tr>
                  ) : leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="p-8 text-center text-gray-600">
                        No data yet
                      </td>
                    </tr>
                  ) : (
                    leaderboard.slice(0, 100).map((user, i) => (
                      <tr
                        key={user.id}
                        className="border-b border-gray-800/50 last:border-0 hover:bg-app-bg/20 transition-all"
                      >
                        <td
                          className={`p-4 font-black italic ${
                            i === 0
                              ? 'text-yellow-500'
                              : i === 1
                              ? 'text-gray-400'
                              : i === 2
                              ? 'text-orange-600'
                              : 'text-gray-500'
                          }`}
                        >
                          #{i + 1}
                        </td>
                        <td className="p-4 font-bold text-white uppercase">
                          {user.username}
                          {user.id === session.user.id && (
                            <span className="ml-2 text-[9px] bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded-full">
                              YOU
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right font-black italic text-blue-500">
                          {user.points.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="bg-card-bg border border-gray-800 rounded-2xl p-6">
              <h3 className="text-xl font-black italic uppercase text-white mb-4">
                Profile
              </h3>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm font-bold uppercase">Username</span>
                  <span className="text-white font-black">
                    {userProfile?.username || 'Anonymous'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm font-bold uppercase">Total Points</span>
                  <span className="text-blue-500 font-black text-xl">
                    {userProfile?.points?.toLocaleString() || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm font-bold uppercase">Tokens</span>
                  <span className="text-yellow-500 font-black text-xl">
                    {userProfile?.beta_tokens || 0}
                  </span>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="w-full bg-red-600/20 border border-red-500/50 hover:bg-red-600/30 py-3 rounded-xl font-black italic uppercase text-red-500 transition-all"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
        {/* INFO TAB */}
{activeTab === 'info' && (
  <div className="space-y-4">
    <div className="bg-card-bg border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-500/20 p-3 rounded-xl">
          <Info size={24} className="text-blue-500" />
        </div>
        <h3 className="text-2xl font-black italic uppercase text-white">
          How It Works
        </h3>
      </div>

      <div className="space-y-6">
        {/* Daily Picks */}
        <div>
          <h4 className="text-blue-500 font-black uppercase text-sm mb-2 flex items-center gap-2">
            <span className="bg-blue-500 text-black w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
            Daily Picks
          </h4>
          <p className="text-gray-400 text-sm leading-relaxed">
            Every day, choose from NFL props. Make your predictions. You can select multiple picks to build a parlay.
          </p>
        </div>

        {/* Lock Tokens */}
        <div>
          <h4 className="text-yellow-500 font-black uppercase text-sm mb-2 flex items-center gap-2">
            <span className="bg-yellow-500 text-black w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
            Lock Tokens
          </h4>
          <p className="text-gray-400 text-sm leading-relaxed">
            Each ticket locks 1-5 tokens (your choice). You start with 5 tokens. The more you lock, the bigger your potential payout! You can unlock your tokens at any time.
          </p>
        </div>

        {/* Win Points */}
        <div>
          <h4 className="text-green-500 font-black uppercase text-sm mb-2 flex items-center gap-2">
            <span className="bg-green-500 text-black w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
            Win Points
          </h4>
          <p className="text-gray-400 text-sm leading-relaxed">
            When games settle, claim your ticket. If you win, you get your tokens back PLUS points. If you lose, you still get your tokens back.
          </p>
        </div>

        {/* Payout Formula */}
        <div className="bg-app-bg border border-gray-800 rounded-xl p-4">
          <h4 className="text-white font-black uppercase text-sm mb-3">Payout Formula</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">1 Leg × 1 Token</span>
              <span className="text-blue-500 font-black">100 PTS</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">2 Legs × 1 Token</span>
              <span className="text-blue-500 font-black">200 PTS</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">3 Legs × 1 Token</span>
              <span className="text-blue-500 font-black">400 PTS</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">4 Legs × 1 Token</span>
              <span className="text-blue-500 font-black">800 PTS</span>
            </div>
            <div className="flex justify-between items-center border-t border-gray-800 pt-2">
              <span className="text-gray-500">5 Legs × 5 Tokens</span>
              <span className="text-yellow-500 font-black">8,000 PTS 🔥</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-600 mt-3 text-center uppercase font-bold">
            Formula: 100 × 2^(legs-1) × tokens
          </p>
        </div>

        {/* Unlock Feature */}
        <div>
          <h4 className="text-red-500 font-black uppercase text-sm mb-2 flex items-center gap-2">
            <Lock size={16} className="text-red-500" />
            Unlock Anytime
          </h4>
          <p className="text-gray-400 text-sm leading-relaxed">
            Changed your mind? Unlock your ticket to get your tokens back. The ticket will be voided (no points possible).
          </p>
        </div>

        {/* Coming Soon */}
        <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl p-5">
          <h4 className="text-purple-400 font-black uppercase text-sm mb-3 flex items-center gap-2">
            <TrendingUp size={16} />
            Coming Soon 🚀
          </h4>
          <div className="space-y-3 text-sm text-gray-300">
            <p className="flex items-start gap-2">
              <span className="text-purple-500 mt-1">•</span>
              <span><strong className="text-white">Redeem Points for Tokens:</strong> Convert your points back into tokens to keep playing</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-purple-500 mt-1">•</span>
              <span><strong className="text-white">Crypto Integration:</strong> Blockchain-based rewards.</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-purple-500 mt-1">•</span>
              <span><strong className="text-white">More Sports:</strong> NBA, NFL, NHL, MLB, and more daily props</span>
            </p>
          </div>
        </div>

        {/* Tips */}
        <div className="border-t border-gray-800 pt-4">
          <h4 className="text-blue-500 font-black uppercase text-xs mb-3">Pro Tips</h4>
          <ul className="space-y-2 text-xs text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-blue-500">→</span>
              <span>Start with 1-2 leg parlays to build your token stack</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">→</span>
              <span>Higher leg parlays = exponential payouts but harder to win</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">→</span>
              <span>Check the leaderboard to see top performers</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">→</span>
              <span>You always get your tokens back, so don't be afraid to play!</span>
            </li>
          </ul>
        </div>
      </div>

      <button
        onClick={() => setActiveTab('picks')}
        className="w-full mt-6 bg-blue-600 hover:bg-blue-700 py-3 rounded-xl font-black italic uppercase text-white transition-all"
      >
        Got It! Let's Play
      </button>
    </div>
  </div>
)}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-nav-bg border-t border-gray-800 px-6 py-4 flex justify-between items-center z-50">
        <button
          onClick={() => setActiveTab('picks')}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'picks' ? 'text-blue-500' : 'text-gray-600'
          }`}
        >
          <Layout size={24} />
          <span className="text-[9px] font-black uppercase">Picks</span>
        </button>

        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'leaderboard' ? 'text-blue-500' : 'text-gray-600'
          }`}
        >
          <Trophy size={24} />
          <span className="text-[9px] font-black uppercase">Board</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'history' ? 'text-blue-500' : 'text-gray-600'
          }`}
        >
          <HistoryIcon size={24} />
          <span className="text-[9px] font-black uppercase">History</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'profile' ? 'text-blue-500' : 'text-gray-600'
          }`}
        >
          <User size={24} />
          <span className="text-[9px] font-black uppercase">Profile</span>
        </button>
      </nav>

      {/* Dynamic Slip */}
      {selectionCount > 0 && activeTab === 'picks' && (
        <div className="fixed bottom-20 left-0 right-0 p-4 z-40 animate-slide-up">
          <div className="max-w-md mx-auto bg-card-bg border-t-2 border-blue-500 rounded-3xl p-5 shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-[10px] font-black uppercase text-blue-400 mb-1">
                  Potential Win
                </p>
                <p className="font-black italic text-3xl text-white tracking-tighter">
                  {potentialWin.toLocaleString()}
                  <span className="text-sm text-gray-500 ml-2">PTS</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-gray-500 font-bold uppercase mb-1">
                  {selectionCount} Leg{selectionCount > 1 ? 's' : ''}
                </p>
                <p className="text-[11px] text-yellow-500 font-black uppercase mb-2">
                  Locks {wagerAmount} Token{wagerAmount > 1 ? 's' : ''}
                </p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((w) => (
                    <button
                      key={w}
                      onClick={() => setWagerAmount(w)}
                      disabled={!userProfile || userProfile.beta_tokens < w}
                      className={`w-8 h-8 rounded-lg font-black text-xs transition-all ${
                        wagerAmount === w
                          ? 'bg-yellow-500 text-black'
                          : 'bg-app-bg border border-gray-800 text-gray-600 hover:border-yellow-500 disabled:opacity-30 disabled:cursor-not-allowed'
                      }`}
                    >
                      {w}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={submitTicket}
              disabled={loading || !userProfile || userProfile.beta_tokens < wagerAmount}
              className="w-full bg-blue-600 hover:bg-blue-700 py-4 rounded-xl font-black italic uppercase text-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(37,99,235,0.2)]"
            >
              {loading ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}