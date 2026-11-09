import { supabase } from './supabaseClient.js';
import { getTodayDate, isGoalReachedToday } from './utils.js';

export async function checkAndIncrementStreak(userId, completedCountToday = 0) {
    const today = getTodayDate(); // Format "YYYY-MM-DD"

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

        // Fonction utilitaire locale pour calculer l'écart en jours de manière securisee sans UTC bug
        const getDayDifference = (dateStr1, dateStr2) => {
            const d1 = new Date(dateStr1 + 'T00:00:00');
            const d2 = new Date(dateStr2 + 'T00:00:00');
            return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
        };

        // Si l'utilisateur n'a jamais validé de streak
        if (!lastStreakDate) {
            if (goalReachedToday) {
                currentStreak = 1;
                lastStreakDate = today;
            } else {
                currentStreak = 0;
            }
        } 
        else {
            const diffDays = getDayDifference(lastStreakDate, today);

            //  La dernière validation a eu lieu Aujourd'hui (diffDays === 0) 
            if (diffDays === 0) {
                if (!goalReachedToday) {
                    // On retire le +1 du jour
                    currentStreak = Math.max(0, currentStreak - 1);
                    
                    // Si on annule la journée d'aujourd'hui, on remet last_streak_date à hier
                    // pour que le système sache que le dernier vrai jour validé était hier
                    const yesterdayObj = new Date(today + 'T00:00:00');
                    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
                    lastStreakDate = yesterdayObj.toISOString().split('T')[0];

                    // Si le streak tombe à 0, lastStreakDate devient null
                    if (currentStreak === 0) {
                        lastStreakDate = null;
                    }
                }
            }
            //  La dernière validation date d'hier (diffDays === 1)
            else if (diffDays === 1) {
                if (goalReachedToday) {
                    currentStreak += 1;
                    lastStreakDate = today;
                }
                // Si l'objectif n'est pas encore atteint aujourd'hui, on ne touche à rien
            }
            //  La dernière validation date de plusiers jours (diffDays > 1)
           else if (diffDays > 1) {
                if (goalReachedToday) {
                    // Si l'utilisateur valide ses tâches aujourd'hui malgré le retard, 
                    // on incrémente le streak et on met à jour la date, sans gaspiller de gel !
                    currentStreak += 1;
                    lastStreakDate = today;
                } 
                else if (freezesCount > 0) {
                    // S'il n'a pas atteint l'objectif mais qu'il a un gel, on consomme le gel pour sauver le streak
                    freezesCount -= 1;
                    
                    // On avance virtuellement la date pour que le gel couvre la transition
                    const lastDateObj = new Date(lastStreakDate + 'T00:00:00');
                    lastDateObj.setDate(lastDateObj.getDate() + 1);
                    lastStreakDate = lastDateObj.toISOString().split('T')[0];
                } 
                else {
                    // Pas d'objectif atteint et plus de gels : le streak retombe à 0
                    currentStreak = 0;
                    lastStreakDate = null;
                }
            }
        }

        const newLongest = Math.max(longestStreak, currentStreak);

        // Sauvegarde propre dans Supabase
        await supabase
            .from('profiles')
            .update({
                current_streak: currentStreak,
                longest_streak: newLongest,
                freezes_count: freezesCount,
                last_streak_date: lastStreakDate
            })
            .eq('id', userId);

        console.log("Streak mis à jour avec succès :", currentStreak);

    } catch (err) {
        console.error("Erreur lors de la vérification du streak :", err.message);
    }
}