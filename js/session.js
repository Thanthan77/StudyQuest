import { supabase } from './supabaseClient.js';
import { getTodayDate, isGoalReachedToday } from './utils.js';
import { checkAndIncrementStreak } from './app.js';

export async function loadAccueilData(currentTab = 'today') {
    const storedUser = localStorage.getItem('studyquest_user');
    if (!storedUser) {
        window.location.href = '../index.html';
        return;
    }
    const localUser = JSON.parse(storedUser);

    const usernameDisplay = document.getElementById('username-display');
    if (usernameDisplay) usernameDisplay.textContent = localUser.username;

    const today = getTodayDate();

    try {
        // Promise.all : On lance toutes les lectures Supabase en même temps pour zéro latence
        const [
            profileRes,
            todayCountRes,
            overdueCountRes,
            upcomingCountRes,
            flexibleCountRes,
            completedBadgeRes,
            allCompletedTasksRes,
            tasksRes
        ] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', localUser.id).single(),
            supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', localUser.id).eq('task_type', 'dated').eq('due_date', today).eq('status', 'pending'),
            supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', localUser.id).eq('task_type', 'dated').lt('due_date', today).eq('status', 'pending'), // 👈 Corrigé ici (.lt au lieu de .gt)
            supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', localUser.id).eq('task_type', 'dated').gt('due_date', today).eq('status', 'pending'),
            supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', localUser.id).eq('task_type', 'flexible').eq('status', 'pending'),
            supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', localUser.id).eq('status', 'completed'),
            supabase.from('tasks').select('*').eq('user_id', localUser.id).eq('status', 'completed'),
            fetchTasksForTab(localUser.id, currentTab, today)
        ]);

        let profile = profileRes.data;
        let allCompletedTasks = allCompletedTasksRes.data;

        const tabSpans = document.querySelectorAll('.tasks-tabs .tab-btn span');
        if (tabSpans[0]) tabSpans[0].textContent = todayCountRes.count || 0;
        if (tabSpans[1]) tabSpans[1].textContent = overdueCountRes.count || 0;
        if (tabSpans[2]) tabSpans[2].textContent = upcomingCountRes.count || 0;
        if (tabSpans[3]) tabSpans[3].textContent = flexibleCountRes.count || 0;
        if (tabSpans[4]) tabSpans[4].textContent = completedBadgeRes.count || 0;

        const completedCountToday = allCompletedTasks ? allCompletedTasks.filter(task => {
            if (!task.completed_at) return false;

            const taskDate = new Date(task.completed_at);
            const year = taskDate.getFullYear();
            const month = String(taskDate.getMonth() + 1).padStart(2, '0');
            const day = String(taskDate.getDate()).padStart(2, '0');
            const completedDateOnly = `${year}-${month}-${day}`;

            return completedDateOnly === today;
        }) : [];

        // Premier Streak Check : On vérifie si l'utilisateur a complété ses tâches aujourd'hui et on incrémente le streak si nécessaire
        try {
            await checkAndIncrementStreak(localUser.id, completedCountToday.length);
            
            // On récupère le profil fraîchement mis à jour pour que l'UI affiche la nouvelle valeur exacte
            const { data: refreshedProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', localUser.id)
                .single();
            if (refreshedProfile) profile = refreshedProfile;
        } catch (streakError) {
            console.error("Erreur mineure (streak non bloquant) :", streakError);
        }

        // Profile Stats Update : On met à jour les stats du profil 
        if (profile) {
            const streakCount = document.getElementById('streak-count-display');
            if (streakCount) streakCount.textContent = profile.current_streak ?? 0;

            const freezes = document.getElementById('freezes-display');
            if (freezes) freezes.textContent = `${profile.freezes_count ?? 0}/2`;

            const recordStreak = document.getElementById('record-streak-stat');
            if (recordStreak) recordStreak.textContent = `${profile.longest_streak ?? 0} jours`;

            const currentStreak = document.getElementById('current-streak-stat');
            if (currentStreak) currentStreak.textContent = `${profile.current_streak ?? 0} jours`;

            const daysIntoCycle = (profile.current_streak ?? 0) % 7;
            const percentage = (daysIntoCycle / 7) * 100;

            const progressFill = document.getElementById('gel-progress-fill');
            const progressText = document.getElementById('gel-progress-text');
            if (progressFill) progressFill.style.width = `${percentage}%`;
            if (progressText) progressText.textContent = `${daysIntoCycle} / 7 jours`;
        }

        if (profile && profile.freeze_used_notification) {
            // Affiche ton message ou ton popup d'alerte
            alert("Ouf ! Un gel de streak a été utilisé automatiquement pour sauver votre série suite à votre absence.");

            // Réinitialise le flag dans Supabase pour ne plus afficher l'alerte au prochain rechargement
            await supabase
                .from('profiles')
                .update({ freeze_used_notification: false })
                .eq('id', localUser.id);
        }

        const tasksProgress = document.getElementById('tasks-progress-display');
        if (tasksProgress) tasksProgress.textContent = `${completedCountToday.length}/2 tâches validées aujourd'hui`;

        const goalReached = isGoalReachedToday(completedCountToday.length);
        console.log("Objectif du jour atteint ?", goalReached);

        const totalTasksStat = document.getElementById('total-tasks-stat');
        if (totalTasksStat) {
            totalTasksStat.textContent = allCompletedTasks ? allCompletedTasks.length : 0;
        }

        const box1 = document.getElementById('mini-box-1');
        const box2 = document.getElementById('mini-box-2');

        if (box1) {
            if (completedCountToday.length >= 1) {
                box1.classList.add('checked');
                box1.innerHTML = '<i class="fa-solid fa-check"></i>';
            } else {
                box1.classList.remove('checked');
                box1.innerHTML = '';
            }
        }

        if (box2) {
            if (completedCountToday.length >= 2) {
                box2.classList.add('checked');
                box2.innerHTML = '<i class="fa-solid fa-check"></i>';
            } else {
                box2.classList.remove('checked');
                box2.innerHTML = '';
            }
        }

        let { data: tasks } = tasksRes;
        const tasksContainer = document.getElementById('tasks-container');

        if (tasksContainer) {
            if (!tasks || tasks.length === 0) {
                let emptyMessage = "Vous n'avez pas de tâches aujourd'hui";
                if (currentTab === 'overdue') emptyMessage = "Aucune tâche en retard 🎉";
                if (currentTab === 'upcoming') emptyMessage = "Aucune tâche à venir";
                if (currentTab === 'flexible') emptyMessage = "Aucune tâche flexible";
                if (currentTab === 'completed') emptyMessage = "Aucune tâche complétée pour l'instant";

                tasksContainer.innerHTML = `<div class="empty-state-tasks">${emptyMessage}</div>`;
            } else {
                tasksContainer.innerHTML = tasks.map(task => {
                    const isCompleted = task.status === 'completed';
                    const isSchool = task.category === 'school';
                    return `
                        <div class="task-item ${isCompleted ? 'completed' : ''}" data-id="${task.id}">
                            <label class="task-check" style="cursor: pointer;">
                                <input type="checkbox" class="native-task-checkbox" ${isCompleted ? 'checked' : ''} style="cursor: pointer;">
                            </label>
                            <span class="task-name">${task.title}</span>
                            ${task.due_date ? `<span class="task-date"><i class="fa-regular fa-calendar"></i> ${task.due_date}</span>` : ''}
                            <span class="task-tag ${isSchool ? 'school' : 'perso'}">${isSchool ? 'École' : 'Perso'}</span>
                            <div class="task-actions">
                                <i class="fa-solid fa-pen edit-task-btn"></i> 
                                <i class="fa-solid fa-trash delete-task-btn"></i>
                            </div>
                        </div>`;
                }).join('');
            }
        }
    } catch (err) {
        console.error("Erreur de chargement :", err.message);
    }
}

// Fonction utilitaire pour la requête dynamique de l'onglet
function fetchTasksForTab(userId, currentTab, today) {
    let query = supabase.from('tasks').select('*').eq('user_id', userId);

    if (currentTab === 'today') {
        query = query.eq('task_type', 'dated').eq('due_date', today).eq('status', 'pending');
    } else if (currentTab === 'overdue') {
        query = query.eq('task_type', 'dated').lt('due_date', today).eq('status', 'pending').order('due_date', { ascending: true }); // 👈 Ajouté ici
    } else if (currentTab === 'upcoming') {
        query = query.eq('task_type', 'dated').gt('due_date', today).eq('status', 'pending').order('due_date', { ascending: true });
    } else if (currentTab === 'flexible') {
        query = query.eq('task_type', 'flexible').eq('status', 'pending');
    } else if (currentTab === 'completed') {
        query = query.eq('status', 'completed').order('completed_at', { ascending: false });
    }
    return query;
}