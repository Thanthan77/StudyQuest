import { supabase } from './supabaseClient.js';

async function loadAccueilData() {
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
            .eq('username', localUser.username)
            .single();

        if (profileError) throw profileError;

        if (profile) {
            //Carte série
            const streakCountEl = document.querySelector('.streak-count strong');
            if (streakCountEl) streakCountEl.textContent = profile.current_streak ?? 0;

            const streakSubEl = document.querySelector('.streak-sub');
            if (streakSubEl) {
                streakSubEl.innerHTML = `<i class="fa-regular fa-snowflake" style="color: #38bdf8;"></i> Gels <strong>${profile.freezes_count ?? 0}/2</strong> Un gel sauve ta série si tu rates un jour`;
            }

            // Carte statistiques
            const statNumberEl = document.querySelector('.stat-number');
            if (statNumberEl) statNumberEl.textContent = profile.total_completed_tasks ?? 0;

            const statRows = document.querySelectorAll('.stat-row');
            if (statRows.length >= 2) {
                const recordRow = statRows[0].querySelector('strong');
                const currentStreakRow = statRows[1].querySelector('strong');
                
                if (recordRow) recordRow.textContent = `${profile.longest_streak ?? 0} jours`;
                if (currentStreakRow) currentStreakRow.textContent = `${profile.current_streak ?? 0} jours`;
            }
        }

        // Charger les tâches de l'utilisateur depuis Supabase
        let { data: tasks, error: tasksError } = await supabase
            .from('tasks')
            .select('*')
            .eq('username', localUser.username); // Adapte selon ta liaison 

        const tasksContainer = document.getElementById('tasks-container');
        if (tasksContainer) {
            if (tasksError || !tasks || tasks.length === 0) {
                tasksContainer.innerHTML = `
                    <div style="padding: 30px; text-align: center; color: #9ca3af; font-size: 0.95rem;">
                        Vous n'avez pas de tâches aujourd'hui
                    </div>
                `;
            } else {
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
            .select('groups(*)') // Ajuste selon ton schéma relationnel Supabase
            .eq('username', localUser.username);

        const groupsContainer = document.getElementById('groups-container');
        const groupsCountBadge = document.querySelector('.groups-count');

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

// Lancer le chargement au chargement du DOM si on est sur la page d'accueil
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('username-display')) {
        loadAccueilData();
    }
});