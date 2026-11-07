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
            // Si l'objectif n'est plus atteint (ex: l'utilisateur a décoché des tâches)
            if (!goalReachedToday) {
                currentStreak = Math.max(0, currentStreak - 1);
                lastStreakDate = null; // On enlève la date du jour validé
            }
            // Si l'objectif est atteint et qu'on était à 0
            else if (goalReachedToday && currentStreak === 0) {
                currentStreak = 1;
            }
            // Si tout est déjà OK pour aujourd'hui, on ne fait rien de plus
            else {
                return;
            }
        } 
        //Premier Streak : si lastStreakDate est null, on initialise le streak à 1 si l'objectif est atteint
        else if (!lastStreakDate) {
            currentStreak = goalReachedToday ? 1 : 0;
            if (goalReachedToday) {
                lastStreakDate = today;
            }
        } 
        // Si on est un jour après le dernier streak enregistré
        else {
            const lastDate = new Date(lastStreakDate);
            const currentDate = new Date(today);
            const diffDays = Math.round((currentDate - lastDate) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                if (goalReachedToday) {
                    currentStreak += 1;
                } else {
                    if (freezesCount > 0) {
                        freezesCount -= 1;
                    } else {
                        currentStreak = 0;
                    }
                }
            } else if (diffDays > 1) {
                if (freezesCount > 0) {
                    freezesCount -= 1;
                } else {
                    currentStreak = 0;
                }
            }

            if (goalReachedToday) {
                lastStreakDate = today;
                if (currentStreak === 0) currentStreak = 1;
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