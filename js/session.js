import { supabase } from './supabaseClient.js';

// Fonction pour obtenir la date du jour au format YYYY-MM-DD
function getTodayDate() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export async function loadAccueilData(currentTab = 'today') {
    // Récupérer l'utilisateur connecté depuis le localStorage
    const storedUser = localStorage.getItem('studyquest_user');
    if (!storedUser) {
        window.location.href = '../index.html';
        return;
    }
    const localUser = JSON.parse(storedUser);

    // Affichage du pseudo 
    const usernameDisplay = document.getElementById('username-display');
    if (usernameDisplay) {
        usernameDisplay.textContent = localUser.username;
    }

    const today = getTodayDate();

    try {
        // Charger les données du profil depuis Supabase
        let { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', localUser.id)
            .single();

        if (profileError) throw profileError;

        if (profile) {
            // Carte Série
            const streakCount = document.getElementById('streak-count-display');
            if (streakCount) streakCount.textContent = profile.current_streak ?? 0;

            const freezes = document.getElementById('freezes-display');
            if (freezes) freezes.textContent = `${profile.freezes_count ?? 0}/2`;

            const recordStreak = document.getElementById('record-streak-stat');
            if (recordStreak) recordStreak.textContent = `${profile.longest_streak ?? 0} jours`;

            const currentStreak = document.getElementById('current-streak-stat');
            if (currentStreak) currentStreak.textContent = `${profile.current_streak ?? 0} jours`;
        }

        // Affichage des compteurs de tâches dans les onglets
        const tabSpans = document.querySelectorAll('.tasks-tabs .tab-btn span');

        // Compteur "Aujourd'hui" (tâches du jour non complétées)
        const { count: todayCount } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', localUser.id)
            .eq('task_type', 'dated')
            .eq('due_date', today)
            .eq('status', 'pending');
        if (tabSpans[0]) tabSpans[0].textContent = todayCount || 0;

        // Compteur "À venir" (tâches futures non complétées)
        const { count: upcomingCount } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', localUser.id)
            .eq('task_type', 'dated')
            .gt('due_date', today)
            .eq('status', 'pending');
        if (tabSpans[1]) tabSpans[1].textContent = upcomingCount || 0;

        // Compteur "Flexibles" (tâches flexibles non complétées)
        const { count: flexibleCount } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', localUser.id)
            .eq('task_type', 'flexible')
            .eq('status', 'pending');
        if (tabSpans[2]) tabSpans[2].textContent = flexibleCount || 0;

        // 4. Compteur "Complétées" (toutes les tâches terminées)
        const { count: completedCountBadge } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', localUser.id)
            .eq('status', 'completed');
        if (tabSpans[3]) tabSpans[3].textContent = completedCountBadge || 0;


        // Persistance du nombre de tâches complétées aujourd'hui pour l'affichage des mini-cases
        const { data: completedTodayTasks } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', localUser.id)
            .eq('status', 'completed')
            .gte('completed_at', `${today}T00:00:00`)
            .lte('completed_at', `${today}T23:59:59`);

        const completedCountToday = completedTodayTasks ? completedTodayTasks.length : 0;

        // Mettre à jour le texte de progression de la journée
        const tasksProgress = document.getElementById('tasks-progress-display');
        if (tasksProgress) {
            tasksProgress.textContent = `${completedCountToday}/2 tâches validées aujourd'hui`;
        }

        const totalTasksStat = document.getElementById('total-tasks-stat');
        if (totalTasksStat) {
            totalTasksStat.textContent = completedCountToday;
        }

        // Restaurer l'état visuel des mini-cases au rechargement
        const box1 = document.getElementById('mini-box-1');
        const box2 = document.getElementById('mini-box-2');

        if (box1) {
            if (completedCountToday >= 1) {
                box1.classList.add('checked');
                box1.innerHTML = '<i class="fa-solid fa-check"></i>';
            } else {
                box1.classList.remove('checked');
                box1.innerHTML = '';
            }
        }

        if (box2) {
            if (completedCountToday >= 2) {
                box2.classList.add('checked');
                box2.innerHTML = '<i class="fa-solid fa-check"></i>';
            } else {
                box2.classList.remove('checked');
                box2.innerHTML = '';
            }
        }


        // Charger les tâches de l'utilisateur depuis Supabase en fonction de l'onglet sélectionné
        let query = supabase
            .from('tasks')
            .select('*')
            .eq('user_id', localUser.id);

        if (currentTab === 'today') {
            query = query.eq('task_type', 'dated').eq('due_date', today).eq('status', 'pending');
        } else if (currentTab === 'upcoming') {
            query = query.eq('task_type', 'dated').gt('due_date', today).eq('status', 'pending').order('due_date', { ascending: true }).limit(10);
        } else if (currentTab === 'flexible') {
            query = query.eq('task_type', 'flexible').eq('status', 'pending').limit(10);
        } else if (currentTab === 'completed') {
            query = query.eq('status', 'completed').order('completed_at', { ascending: false }).limit(20);
        }

        let { data: tasks, error: tasksError } = await query;
        const tasksContainer = document.getElementById('tasks-container');

        if (tasksContainer) {
            if (tasksError || !tasks || tasks.length === 0) {
                let emptyMessage = "Vous n'avez pas de tâches aujourd'hui";
                if (currentTab === 'upcoming') emptyMessage = "Aucune tâche à venir";
                if (currentTab === 'flexible') emptyMessage = "Aucune tâche flexible";
                if (currentTab === 'completed') emptyMessage = "Aucune tâche complétée pour l'instant";

                tasksContainer.innerHTML = `
                    <div style="padding: 30px; text-align: center; color: #9ca3af; font-size: 0.95rem;">
                        ${emptyMessage}
                    </div>
                `;
            } else {
                tasksContainer.innerHTML = tasks.map(task => {
                    const isCompleted = task.status === 'completed';
                    const isSchool = task.category === 'school';
                    const tagName = isSchool ? 'École' : 'Perso';
                    const tagClass = isSchool ? 'school' : 'perso';

                    return `
                        <div class="task-item ${isCompleted ? 'completed' : ''}" data-id="${task.id}">
                            <div class="task-check">
                                ${isCompleted ? '<i class="fa-solid fa-check"></i>' : ''}
                            </div>
                            <span class="task-name">${task.title}</span>
                            ${task.due_date ? `<span class="task-date" style="margin-left: 8px; font-size: 0.85rem; color: #6b7280;"><i class="fa-regular fa-calendar"></i> ${task.due_date}</span>` : ''}
                            <span class="task-tag ${tagClass}">${tagName}</span>
                            <div class="task-actions">
                                <i class="fa-solid fa-pen edit-task-btn"></i> 
                                <i class="fa-solid fa-trash delete-task-btn"></i>
                            </div>
                        </div>`;
                }).join('');
            }
        }

        // Charge les groupes de l'utilisateur depuis Supabase
        let { data: groups, error: groupsError } = await supabase
            .from('group_members')
            .select('groups(*)')
            .eq('user_id', localUser.id);

        const groupsContainer = document.getElementById('groups-container');
        const groupsCountBadge = document.getElementById('groups-count-badge');

        if (groupsContainer) {
            if (groupsError || !groups || groups.length === 0) {
                if (groupsCountBadge) groupsCountBadge.textContent = "0";
                groupsContainer.innerHTML = `
                    <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 0.9rem; margin-bottom: 10px;">
                        Vous n'avez pas de groupes
                    </div>
                `;
            } else {
                if (groupsCountBadge) groupsCountBadge.textContent = groups.length;
                groupsContainer.innerHTML = groups.map(item => {
                    const group = item.groups;
                    return `
                        <div class="group-item">
                            <span class="group-badge-rank rank-other">${group.rank || '2e'}</span>
                            <div class="group-info">
                                <strong>${group.name}</strong>
                                <small>${group.members_count || '1'} / 10 membres</small>
                            </div>
                            <i class="fa-solid fa-chevron-right"></i>
                        </div>
                    `;
                }).join('');
            }
        }

    } catch (err) {
        console.error("Erreur lors du chargement des données de la page d'accueil :", err.message);
    }
}

// ==========================================
// GESTION DES CLICS SUR LES ONGLETS DE TÂCHES
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Charger par défaut l'onglet "Aujourd'hui"
    loadAccueilData('today');

    const tabBtns = document.querySelectorAll('.tasks-tabs .tab-btn');
    tabBtns.forEach((btn, index) => {
        // On ignore le bouton d'ajout (.add-task-btn s'il est inclus dans le querySelectorAll)
        if (btn.classList.contains('add-task-btn')) return;

        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (index === 0) {
                loadAccueilData('today');
            } else if (index === 1) {
                loadAccueilData('upcoming');
            } else if (index === 2) {
                loadAccueilData('flexible');
            } else if (index === 3) {
                loadAccueilData('completed');
            }
        });
    });
});