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

function startMidnightCountdown() {
    const timerElement = document.getElementById('midnight-timer');
    if (!timerElement) return;

    function updateTimer() {
        const now = new Date();
        
        // Créer une date pour le prochain minuit (00:00:00 du jour suivant)
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0);

        const diff = midnight - now; // Différence en millisecondes

        if (diff <= 0) {
            timerElement.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> C'est minuit !`;
            return;
        }

        // Calcul des heures et des minutes restantes
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        // Injection dynamique dans le HTML du badge
        timerElement.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Minuit dans ${hours}h ${minutes}m ${seconds}s`;
    }

    // Lancer immédiatement puis répéter chaque seconde
    updateTimer();
    setInterval(updateTimer, 1000);
}

// Gestion du modal d'ajout de tâche
function initTaskModal(onTaskAddedCallback) {
    const modal = document.getElementById('task-modal');
    const openModalBtn = document.querySelector('.add-task-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    const addTaskForm = document.getElementById('add-task-form');

    let selectedTaskType = 'dated'; 
    let selectedCategory = 'school'; 

    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
            if (modal) modal.style.display = 'flex';
        });
    }

    function closeModal() {
        if (modal) {
            modal.style.display = 'none';
            if (addTaskForm) addTaskForm.reset();
        }
    }
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

    const toggleBtns = document.querySelectorAll('.toggle-btn');
    const dateContainer = document.getElementById('date-container');

    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            toggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const when = btn.getAttribute('data-when');
            selectedTaskType = (when === 'specific') ? 'dated' : 'flexible';
            
            if (selectedTaskType === 'flexible') {
                if (dateContainer) dateContainer.style.display = 'none';
            } else {
                if (dateContainer) dateContainer.style.display = 'block';
            }
        });
    });

    const categoryBtns = document.querySelectorAll('.category-btn');
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            categoryBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const cat = btn.getAttribute('data-category');
            selectedCategory = (cat === 'perso') ? 'personal' : 'school';
        });
    });

    if (addTaskForm) {
        addTaskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
           // Récupération directe de l'ID depuis le localStorage
            let userId = null;
            const storedUser = localStorage.getItem('studyquest_user');
            if (storedUser) {
                const localUser = JSON.parse(storedUser);
                userId = localUser.id; // C'est le même UUID que dans profiles
            }

            if (!userId) {
                alert("Erreur : Aucun utilisateur connecté.");
                return;
            }
            const titleInput = document.getElementById('task-title-input');
            const dateInput = document.getElementById('task-date-input');

            const taskTitle = titleInput.value.trim();
            const dueDate = selectedTaskType === 'dated' ? dateInput.value : null;

            try {
                const { error } = await supabase
                    .from('tasks')
                    .insert([
                        {
                            user_id: userId,
                            title: taskTitle,
                            task_type: selectedTaskType,
                            due_date: dueDate || null,
                            status: 'pending',
                            category: selectedCategory
                        }
                    ]);

                if (error) throw error;

                closeModal();
                if (typeof onTaskAddedCallback === 'function') {
                    onTaskAddedCallback();
                }

            } catch (err) {
                console.error("Erreur lors de l'ajout de la tâche :", err.message);
                alert("Erreur lors de l'ajout de la tâche : " + err.message);
            }
        });
    }
}
// Lancer le chargement au chargement du DOM si on est sur la page d'accueil
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('username-display')) {
        startMidnightCountdown();
        loadAccueilData();
        initTaskModal(loadAccueilData); // Recharger les données après l'ajout d'une tâche
    }
});