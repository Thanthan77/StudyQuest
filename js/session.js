import { supabase } from './supabaseClient.js';

function getTodayDate() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

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
        let { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', localUser.id)
            .single();

        if (profile) {
            const streakCount = document.getElementById('streak-count-display');
            if (streakCount) streakCount.textContent = profile.current_streak ?? 0;

            const freezes = document.getElementById('freezes-display');
            if (freezes) freezes.textContent = `${profile.freezes_count ?? 0}/2`;

            const recordStreak = document.getElementById('record-streak-stat');
            if (recordStreak) recordStreak.textContent = `${profile.longest_streak ?? 0} jours`;

            const currentStreak = document.getElementById('current-streak-stat');
            if (currentStreak) currentStreak.textContent = `${profile.current_streak ?? 0} jours`;
        }

        const tabSpans = document.querySelectorAll('.tasks-tabs .tab-btn span');

        const { count: todayCount } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', localUser.id).eq('task_type', 'dated').eq('due_date', today).eq('status', 'pending');
        if (tabSpans[0]) tabSpans[0].textContent = todayCount || 0;

        const { count: upcomingCount } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', localUser.id).eq('task_type', 'dated').gt('due_date', today).eq('status', 'pending');
        if (tabSpans[1]) tabSpans[1].textContent = upcomingCount || 0;

        const { count: flexibleCount } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', localUser.id).eq('task_type', 'flexible').eq('status', 'pending');
        if (tabSpans[2]) tabSpans[2].textContent = flexibleCount || 0;

        const { count: completedCountBadge } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', localUser.id).eq('status', 'completed');
        if (tabSpans[3]) tabSpans[3].textContent = completedCountBadge || 0;

        let { data: allCompletedTasks } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', localUser.id)
            .eq('status', 'completed');

        const completedCountToday = allCompletedTasks ? allCompletedTasks.filter(task => {
            if (!task.completed_at) return false;

            // On convertit le timestamp UTC de Supabase en date locale de ton navigateur
            const taskDate = new Date(task.completed_at);
            const year = taskDate.getFullYear();
            const month = String(taskDate.getMonth() + 1).padStart(2, '0');
            const day = String(taskDate.getDate()).padStart(2, '0');
            const completedDateOnly = `${year}-${month}-${day}`;

            return completedDateOnly === today;
        }) : [];

        console.log("Tâches complétées aujourd'hui :", completedCountToday);
        console.log("Toutes les tâches 'completed' récupérées de Supabase :", allCompletedTasks);

        const tasksProgress = document.getElementById('tasks-progress-display');
        if (tasksProgress) tasksProgress.textContent = `${completedCountToday.length}/2 tâches validées aujourd'hui`;

        const totalTasksStat = document.getElementById('total-tasks-stat');
        if (totalTasksStat) totalTasksStat.textContent = profile?.total_completed_tasks ?? completedCountToday.length;

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

        let query = supabase.from('tasks').select('*').eq('user_id', localUser.id);

        if (currentTab === 'today') {
            query = query.eq('task_type', 'dated').eq('due_date', today).eq('status', 'pending');
        } else if (currentTab === 'upcoming') {
            query = query.eq('task_type', 'dated').gt('due_date', today).eq('status', 'pending').order('due_date', { ascending: true });
        } else if (currentTab === 'flexible') {
            query = query.eq('task_type', 'flexible').eq('status', 'pending');
        } else if (currentTab === 'completed') {
            query = query.eq('status', 'completed').order('completed_at', { ascending: false });
        }

        let { data: tasks } = await query;
        const tasksContainer = document.getElementById('tasks-container');

        if (tasksContainer) {
            if (!tasks || tasks.length === 0) {
                let emptyMessage = "Vous n'avez pas de tâches aujourd'hui";
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

