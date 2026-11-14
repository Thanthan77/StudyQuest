export function getTodayDate() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function isGoalReachedToday(completedTasks) {
    if(completedTasks>=2) {
        return true;
    }
    return false;
}

export function handleFreezes(currentStreak, freezesCount, freezeUsedNotification, goalReachedToday, lastStreakDate, today) {
    let updatedFreezesCount = freezesCount;
    let updatedNotification = freezeUsedNotification;
    let updatedLastStreakDate = lastStreakDate;

    // Si l'objectif du jour est atteint : on vérifie si le streak actuel donne droit à un gel (tous les 7 jours)
    if (goalReachedToday) {
        updatedLastStreakDate = today;
        
        // Gain d'un gel tous les 7 jours (ex: 7, 14, 21...)
        if (currentStreak > 0 && currentStreak % 7 === 0) {
            updatedFreezesCount += 1;
        }
    } 
    //  Si l'objectif n'est pas atteint et qu'il y a un trou (utilisation d'un gel)
    else if (updatedFreezesCount > 0) {
        updatedFreezesCount -= 1;
        updatedNotification = true; // Active l'alerte pour la prochaine connexion
        
        // Avancement virtuel de la date pour couvrir la transition du gel
        const lastDateObj = new Date(updatedLastStreakDate + 'T00:00:00');
        lastDateObj.setDate(lastDateObj.getDate() + 1);
        updatedLastStreakDate = lastDateObj.toISOString().split('T')[0];
    } 
    // Pas d'objectif atteint et plus de gels disponibles
    else {
        updatedLastStreakDate = null;
    }

    return {
        freezesCount: updatedFreezesCount,
        freezeUsedNotification: updatedNotification,
        lastStreakDate: updatedLastStreakDate
    };
}

export async function checkAndResetRecurringTasks(userId) {
    const today = getTodayDate();

    try {
        // Récupérer toutes les tâches récurrentes de l'utilisateur qui sont complétées
        const { data: recurringTasks, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', userId)
            .eq('task_type', 'recurring')
            .eq('status', 'completed');

        if (error) throw error;
        if (!recurringTasks || recurringTasks.length === 0) return;

        // Vérifier chaque tâche complétée
        for (const task of recurringTasks) {
            if (!task.completed_at) continue;

            const taskDate = new Date(task.completed_at);
            const year = taskDate.getFullYear();
            const month = String(taskDate.getMonth() + 1).padStart(2, '0');
            const day = String(taskDate.getDate()).padStart(2, '0');
            const completedDateOnly = `${year}-${month}-${day}`;

            // Si la tâche a été complétée un jour PRÉCÉDENT, on la remet en 'pending'
            if (completedDateOnly < today) {
                const { error: updateError } = await supabase
                    .from('tasks')
                    .update({
                        status: 'pending',
                        completed_at: null
                    })
                    .eq('id', task.id);

                if (updateError) {
                    console.error(`Erreur lors de la réinitialisation de la tâche récurrente ${task.id} :`, updateError.message);
                }
            }
        }
    } catch (err) {
        console.error("Erreur dans checkAndResetRecurringTasks :", err.message);
    }
}