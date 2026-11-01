import { supabase } from './supabaseClient.js';
export async function loadAccueilData() {
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

    try {
        // Charger les vraies données du profil depuis Supabase
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

            const tasksProgress = document.getElementById('tasks-progress-display');
            if (tasksProgress) {
                tasksProgress.textContent = `${profile.total_completed_tasks ?? 0} tâches validées depuis le début`;
            }

            // Carte Statistiques
            const totalTasksStat = document.getElementById('total-tasks-stat');
            if (totalTasksStat) totalTasksStat.textContent = profile.total_completed_tasks ?? 0;

            const recordStreak = document.getElementById('record-streak-stat');
            if (recordStreak) recordStreak.textContent = `${profile.longest_streak ?? 0} jours`;

            const currentStreak = document.getElementById('current-streak-stat');
            if (currentStreak) currentStreak.textContent = `${profile.current_streak ?? 0} jours`;
        }

        // Charger les tâches de l'utilisateur depuis Supabase
        let { data: tasks, error: tasksError } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', localUser.id);

        const tasksContainer = document.getElementById('tasks-container');
        const tasksCountBadge = document.getElementById('tasks-count-badge');

        if (tasksContainer) {
            if (tasksError || !tasks || tasks.length === 0) {
                if (tasksCountBadge) tasksCountBadge.textContent = "0";
                tasksContainer.innerHTML = `
                    <div style="padding: 30px; text-align: center; color: #9ca3af; font-size: 0.95rem;">
                        Vous n'avez pas de tâches aujourd'hui
                    </div>
                `;
            } else {
                if (tasksCountBadge) tasksCountBadge.textContent = tasks.length;
                tasksContainer.innerHTML = tasks.map(task => `
                    <div class="task-item ${task.completed ? 'completed' : ''}">
                        <div class="task-check"><i class="fa-solid fa-check"></i></div>
                        <span class="task-name">${task.title}</span>
                        <span class="task-tag ${task.tag_class || 'school'}">${task.tag_name || 'École'}</span>
                        <div class="task-actions"><i class="fa-solid fa-pen"></i> <i class="fa-solid fa-trash"></i></div>
                    </div>
                `).join('');
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