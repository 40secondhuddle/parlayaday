import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { XCircle, CheckCircle2, Trophy, TrendingUp, Clock } from 'lucide-react'

export default function UserProfileModal({ userId, onClose }) {
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState(null)
  const [userPicks, setUserPicks] = useState([])
  const [activeFilter, setActiveFilter] = useState('wins') // 'wins' or 'losses'
  const [expandedTicket, setExpandedTicket] = useState(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    fetchUserData()
  }, [userId])

  async function fetchUserData() {
    setLoading(true)

    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    setUserProfile(profile)

    // Fetch user's settled picks
    const { data: picks } = await supabase
      .from('user_picks')
      .select('*, matchups(*)')
      .eq('user_id', userId)
      .eq('is_claimed', true)
      .order('created_at', { ascending: false })

    setUserPicks(picks || [])
    setLoading(false)
  }

  // Group picks by entry_group
  const groupedPicks = userPicks.reduce((acc, pick) => {
    if (!acc[pick.entry_group]) {
      acc[pick.entry_group] = []
    }
    acc[pick.entry_group].push(pick)
    return acc
  }, {})

  // Separate wins and losses
  const wins = []
  const losses = []

  Object.entries(groupedPicks).forEach(([group, picks]) => {
    const allSettled = picks.every((p) => p.matchups?.winning_option !== null)
    const allCorrect = picks.every(
      (p) => p.selected_option === p.matchups?.winning_option
    )

    if (allSettled) {
      const wager = picks[0].wager_amount || 1
      const basePoints = 100 * Math.pow(2, picks.length - 1)
      const payout = basePoints * wager

      const ticket = {
        group,
        picks,
        payout,
        won: allCorrect,
      }

      if (allCorrect) {
        wins.push(ticket)
      } else {
        losses.push(ticket)
      }
    }
  })

  // Calculate stats
  const totalTickets = wins.length + losses.length
  const winRate = totalTickets > 0 ? ((wins.length / totalTickets) * 100).toFixed(0) : 0
  const totalPointsWon = wins.reduce((sum, t) => sum + t.payout, 0)

  // Filter tickets based on activeFilter
  const displayTickets = activeFilter === 'wins' ? wins : losses
  const visibleTickets = showAll ? displayTickets : displayTickets.slice(0, 5)

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
        <div className="bg-app-bg border border-gray-800 rounded-2xl p-8">
          <p className="text-white font-bold">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-app-bg border border-gray-800 rounded-2xl max-w-md w-full my-8">
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black italic uppercase text-white">
              {userProfile?.username || 'Anonymous'}
            </h2>
            <p className="text-xs text-gray-500 font-bold uppercase mt-1">
              Profile Stats
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <XCircle size={24} />
          </button>
        </div>

        {/* Stats Overview */}
        <div className="p-6 border-b border-gray-800 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm font-bold uppercase">Total Points</span>
            <span className="text-blue-500 font-black text-xl">
              {totalPointsWon.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm font-bold uppercase">Win Rate</span>
            <span className="text-green-500 font-black text-xl">{winRate}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm font-bold uppercase">Total Tickets</span>
            <span className="text-white font-black">
              {wins.length}W - {losses.length}L
            </span>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex gap-2 bg-card-bg p-1 rounded-xl border border-gray-800">
            <button
              onClick={() => {
                setActiveFilter('wins')
                setShowAll(false)
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-black uppercase italic transition-all flex items-center justify-center gap-2 ${
                activeFilter === 'wins'
                  ? 'bg-green-600 text-white shadow-lg'
                  : 'text-gray-500'
              }`}
            >
              <CheckCircle2 size={14} />
              Wins ({wins.length})
            </button>
            <button
              onClick={() => {
                setActiveFilter('losses')
                setShowAll(false)
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-black uppercase italic transition-all flex items-center justify-center gap-2 ${
                activeFilter === 'losses'
                  ? 'bg-red-600 text-white shadow-lg'
                  : 'text-gray-500'
              }`}
            >
              <XCircle size={14} />
              Losses ({losses.length})
            </button>
          </div>
        </div>

        {/* Tickets List */}
        <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
          {visibleTickets.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 font-bold uppercase text-sm">
                No {activeFilter} yet
              </p>
            </div>
          ) : (
            <>
              {visibleTickets.map((ticket) => {
                const isExpanded = expandedTicket === ticket.group

                return (
                  <div
                    key={ticket.group}
                    className={`bg-card-bg border rounded-2xl overflow-hidden ${
                      ticket.won ? 'border-green-500/30' : 'border-red-500/30'
                    }`}
                  >
                    <div
                      onClick={() =>
                        setExpandedTicket(isExpanded ? null : ticket.group)
                      }
                      className="p-4 flex justify-between items-center cursor-pointer hover:bg-app-bg/20 transition-all"
                    >
                      <div>
                        <p className="font-black italic text-sm uppercase text-white">
                          {ticket.picks.length}-Leg Parlay
                          <span
                            className={`ml-2 ${
                              ticket.won ? 'text-green-500' : 'text-red-500'
                            }`}
                          >
                            {ticket.won ? `+${ticket.payout.toLocaleString()}` : '+0'}
                          </span>
                        </p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">
                          {ticket.picks[0].wager_amount}x Multiplier
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {ticket.won ? (
                          <CheckCircle2 size={18} className="text-green-500" />
                        ) : (
                          <XCircle size={18} className="text-red-500" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-2 border-t border-gray-800 pt-3 bg-app-bg/40">
                        {ticket.picks.map((pick, i) => {
                          const win =
                            pick.selected_option === pick.matchups?.winning_option

                          return (
                            <div
                              key={i}
                              className="py-2 border-b border-gray-800 last:border-0"
                            >
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                  {win ? (
                                    <CheckCircle2 size={14} className="text-green-500" />
                                  ) : (
                                    <XCircle size={14} className="text-red-500" />
                                  )}
                                  <div>
                                    <p
                                      className={`font-black uppercase text-[11px] ${
                                        !win ? 'text-gray-600 line-through' : 'text-white'
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
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Show All Button */}
              {!showAll && displayTickets.length > 5 && (
                <button
                  onClick={() => setShowAll(true)}
                  className="w-full bg-gray-800/50 hover:bg-gray-800 py-3 rounded-xl font-black italic uppercase text-sm text-gray-400 transition-all"
                >
                  Show All ({displayTickets.length - 5} more)
                </button>
              )}
            </>
          )}
        </div>

        {/* Close Button */}
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-xl font-black italic uppercase text-white transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}