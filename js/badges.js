import { supabase } from "./supabaseClient.js";

function getStatForBadgeCategory(category, stats = {}) {
  switch (category) {
    case "tasks":
      return Number(stats.totalCompleted) || 0;
    case "gel":
      return Number(stats.freezesUsed) || 0;
    case "streak":
      return Math.max(
        Number(stats.currentStreak) || 0,
        Number(stats.bestStreak) || 0,
      );
    case "group":
      return Number(stats.groupsCount) || 0;
    default:
      return 0;
  }
}

export async function unlockEarnedBadges({
  userId,
  catalogBadges = [],
  unlockedUserBadges = [],
  stats = {},
}) {
  const unlockedIds = new Set(
    (unlockedUserBadges || []).map((ub) => ub.badge_id ?? ub.id),
  );

  const newlyUnlocked = [];

  for (const badge of catalogBadges) {
    if (!badge?.id || unlockedIds.has(badge.id)) continue;

    const target = Number(badge.target_value) || 0;
    const current = getStatForBadgeCategory(badge.category, stats);

    if (target > 0 && current >= target) {
      unlockedIds.add(badge.id);
      newlyUnlocked.push({
        user_id: userId,
        badge_id: badge.id,
        unlocked_at: new Date().toISOString(),
      });
    }
  }

  if (userId && newlyUnlocked.length > 0) {
    const { error } = await supabase
      .from("user_badges")
      .upsert(newlyUnlocked, {
        onConflict: "user_id,badge_id",
        ignoreDuplicates: true,
      });

    if (error) {
      console.error("Erreur lors du déblocage des badges :", error.message);
    }
  }

  return { unlockedIds, newlyUnlocked };
}