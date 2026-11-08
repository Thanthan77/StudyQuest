import { supabase } from './supabaseClient.js';
import { getTodayDate, isGoalReachedToday } from './utils.js';

export async function checkAndIncrementStreak(userId, completedCountToday = 0) {
    const today = getTodayDate();

    try {
        let { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !profile) throw error;

        let lastStreakDate = profile.last_streak_date;
        let currentStreak = profile.current_streak || 0;
        let longestStreak = profile.longest_streak || 0;
        let freezesCount = profile.freezes_count || 0;

        const goalReachedToday = isGoalReachedToday(completedCountToday);

        // Si on est le même jour que le dernier streak enregistré
        if (lastStreakDate === today) {
            if (!goalReachedToday) {
                // Si l'utilisateur décoche et passe sous l'objectif aujourd'hui
                currentStreak = Math.max(0, currentStreak - 1);
                lastStreakDate = null; 
            } else if (goalReachedToday && currentStreak === 0) {
                currentStreak = 1;
            } else {
                return; 
            }
        } 
        // Premier Streak : si jamais validé auparavant
        else if (!lastStreakDate) {
            currentStreak = goalReachedToday ? 1 : 0;
            if (goalReachedToday) {
                lastStreakDate = today;
            }
        } 
        // Si on est un ou plusieurs jours après le dernier streak enregistré
        else {
            const lastDate = new Date(lastStreakDate);
            const currentDate = new Date(today);
            const diffDays = Math.round((currentDate - lastDate) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                // On laisse l'utilisateur tranquille toute la journée pour qu'il atteigne son objectif.
                // Le streak d'hier est préservé. S'il atteint son objectif aujourd'hui, on incrémentera.
            } else if (diffDays > 1) {
                // Si plus d'un jour s'est écoulé sans valider (et pas de freeze)
                if (freezesCount > 0) {
                    freezesCount -= 1;
                } else {
                    currentStreak = 0;
                }
            }

            // Si l'objectif du jour est atteint, on valide la journée d'aujourd'hui
            if (goalReachedToday) {
                lastStreakDate = today;
                if (diffDays === 1) {
                    currentStreak += 1; // Incrémente car on est le lendemain et l'objectif est atteint
                } else if (currentStreak === 0) {
                    currentStreak = 1;
                }
            }
        }

        const newLongest = Math.max(longestStreak, currentStreak);

        // Mise à jour dans Supabase
        await supabase
            .from('profiles')
            .update({
                current_streak: currentStreak,
                longest_streak: newLongest,
                freezes_count: freezesCount,
                last_streak_date: goalReachedToday ? today : lastStreakDate
            })
            .eq('id', userId);

        console.log("Vérification du streak effectuée. Streak actuel :", currentStreak);

    } catch (err) {
        console.error("Erreur lors de la vérification du streak :", err.message);
    }
}