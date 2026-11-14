import { supabase } from './supabaseClient.js';
import { getTodayDate } from './utils.js';

export function initTasksModule(onDataChangeCallback) {
    const modal = document.getElementById('task-modal');
    const openModalBtn = document.querySelector('.add-task-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    const addTaskForm = document.getElementById('add-task-form');
    const tasksContainer = document.getElementById('tasks-container');

    const modalTitle = modal ? modal.querySelector('h2') : null;
    const submitBtn = addTaskForm ? addTaskForm.querySelector('.btn-primary') : null;
    const titleInput = document.getElementById('task-title-input');
    const dateInput = document.getElementById('task-date-input');
    const dateContainer = document.getElementById('date-container');
    const recurrenceContainer = document.getElementById('recurrence-container');
    const weeklyDaysContainer = document.getElementById('weekly-days-container');

    let editingTaskId = null;
    let selectedTaskType = 'dated'; 
    let selectedCategory = 'school'; 
    let isUpdating = false;
    let selectedRecurrenceType = 'daily'; // 'daily' ou 'weekly'

    // Gestion de l'ouverture du modal pour ajouter une nouvelle tâche
    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
            editingTaskId = null;
            if (modalTitle) modalTitle.textContent = "Nouvelle tâche";
            if (submitBtn) submitBtn.textContent = "Ajouter la tâche";
            if (addTaskForm) addTaskForm.reset();
            if (dateInput) dateInput.value = getTodayDate();
            resetFormUI('dated', 'school', 'daily', []);
            if (modal) modal.style.display = 'flex';
        });
    }

    function closeModal() {
        if (modal) {
            modal.style.display = 'none';
            if (addTaskForm) addTaskForm.reset();
            editingTaskId = null;
        }
    }
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

    // Fonction pour réinitialiser ou charger l'UI de la modale
    function resetFormUI(type, category, recType = 'daily', recDays = []) {
        selectedTaskType = type;
        selectedCategory = category;
        selectedRecurrenceType = recType;

        // 1. Boutons de type principal (specific, flexible, recurring)
        document.querySelectorAll('.toggle-btn').forEach(b => {
            const when = b.getAttribute('data-when');
            let targetWhen = 'specific';
            if (type === 'flexible') targetWhen = 'flexible';
            if (type === 'recurring') targetWhen = 'recurring';
            b.classList.toggle('active', when === targetWhen);
        });

        // 2. Affichage des conteneurs selon le type de tâche
        if (dateContainer) {
            dateContainer.style.display = (type === 'dated') ? 'block' : 'none';
        }
        if (recurrenceContainer) {
            recurrenceContainer.style.display = (type === 'recurring') ? 'block' : 'none';
        }

        // 3. Boutons de sous-fréquence (daily / weekly)
        document.querySelectorAll('.rec-btn').forEach(b => {
            const rec = b.getAttribute('data-rec');
            b.classList.toggle('active', rec === recType);
        });

        if (weeklyDaysContainer) {
            weeklyDaysContainer.style.display = (recType === 'weekly' && type === 'recurring') ? 'block' : 'none';
        }

        // 4. Cocher les jours de la semaine si présents
        document.querySelectorAll('input[name="rec-day"]').forEach(cb => {
            cb.checked = recDays.includes(parseInt(cb.value));
        });

        // 5. Catégorie
        document.querySelectorAll('.category-btn').forEach(b => {
            const catAttr = b.getAttribute('data-category');
            const targetCat = (category === 'personal' ? 'perso' : 'school');
            b.classList.toggle('active', catAttr === targetCat);
        });
    }

    // Gestion du clic sur les types principaux
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const when = btn.getAttribute('data-when');
            
            if (when === 'specific') selectedTaskType = 'dated';
            else if (when === 'flexible') selectedTaskType = 'flexible';
            else if (when === 'recurring') selectedTaskType = 'recurring';

            if (dateContainer) dateContainer.style.display = (selectedTaskType === 'dated') ? 'block' : 'none';
            if (recurrenceContainer) recurrenceContainer.style.display = (selectedTaskType === 'recurring') ? 'block' : 'none';
        });
    });

    // Gestion du clic sur la sous-fréquence (daily / weekly)
    document.querySelectorAll('.rec-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.rec-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedRecurrenceType = btn.getAttribute('data-rec');

            if (weeklyDaysContainer) {
                weeklyDaysContainer.style.display = (selectedRecurrenceType === 'weekly') ? 'block' : 'none';
            }
        });
    });

    // Gestion du clic sur les catégories
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const cat = btn.getAttribute('data-category');
            selectedCategory = (cat === 'perso') ? 'personal' : 'school';
        });
    });

    // --- SOUMISSION DU FORMULAIRE ---
    if (addTaskForm) {
        addTaskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const storedUser = localStorage.getItem('studyquest_user');
            if (!storedUser) {
                alert("Erreur : Aucun utilisateur connecté.");
                return;
            }
            const userId = JSON.parse(storedUser).id;
            const taskTitle = titleInput ? titleInput.value.trim() : '';
            const dueDate = selectedTaskType === 'dated' && dateInput ? dateInput.value : null;

            // Récupération dynamique des données de récurrence au moment du submit
            let recurrenceTypeVal = null;
            let recurrenceDaysVal = null;

            if (selectedTaskType === 'recurring') {
                recurrenceTypeVal = selectedRecurrenceType; // 'daily' ou 'weekly'
                if (selectedRecurrenceType === 'weekly') {
                    const checkedDays = document.querySelectorAll('input[name="rec-day"]:checked');
                    recurrenceDaysVal = Array.from(checkedDays).map(cb => parseInt(cb.value));
                }
            }

            try {
                if (editingTaskId) {
                    const { error } = await supabase.from('tasks').update({
                        title: taskTitle,
                        task_type: selectedTaskType,
                        due_date: dueDate || null,
                        category: selectedCategory,
                        recurrence_type: recurrenceTypeVal,      
                        recurrence_days: recurrenceDaysVal
                    }).eq('id', editingTaskId);
                    if (error) throw error;
                } else {
                    const { error } = await supabase.from('tasks').insert([{
                        user_id: userId,
                        title: taskTitle,
                        task_type: selectedTaskType,
                        due_date: dueDate || null,
                        status: 'pending',
                        category: selectedCategory,
                        recurrence_type: recurrenceTypeVal,    
                        recurrence_days: recurrenceDaysVal
                    }]);
                    if (error) throw error;
                }

                closeModal();

                let targetTab = 'today';
                if (selectedTaskType === 'flexible') {
                    targetTab = 'flexible';
                } else if (selectedTaskType === 'recurring') {
                    targetTab = 'today';
                } else if (dueDate && dueDate > getTodayDate()) {
                    targetTab = 'upcoming';
                }

                if (typeof onDataChangeCallback === 'function') {
                    onDataChangeCallback(targetTab);
                }

            } catch (err) {
                console.error("Erreur lors de l'enregistrement de la tâche :", err.message);
                alert("Erreur : " + err.message);
            }
        });
    }

    // --- ACTIONS SUR LES TÂCHES (Compléter, Supprimer, Modifier) ---
    if (tasksContainer) {
        tasksContainer.addEventListener('click', async (e) => {
            const taskItem = e.target.closest('.task-item');
            if (!taskItem) return;
            
            const taskId = taskItem.getAttribute('data-id');

            // 1. Case à cocher (Compléter / Décocher)
            const checkbox = e.target.closest('.native-task-checkbox');
            if (checkbox) {
                if (isUpdating) return;
                isUpdating = true;

                const isCompleted = checkbox.checked;
                const newStatus = isCompleted ? 'completed' : 'pending';
                taskItem.classList.toggle('completed', isCompleted);
                
                try {
                    const completedAtValue = isCompleted ? new Date().toISOString() : null;

                    const { error: taskError } = await supabase
                        .from('tasks')
                        .update({ 
                            status: newStatus,
                            completed_at: completedAtValue 
                        })
                        .eq('id', taskId);

                    if (taskError) throw taskError;

                    // Mise à jour du compteur total de tâches complétées dans le profil
                    const storedUser = localStorage.getItem('studyquest_user');
                    if (storedUser) {
                        const userId = JSON.parse(storedUser).id;
                        const { data: profileData } = await supabase
                            .from('profiles')
                            .select('total_completed_tasks')
                            .eq('id', userId)
                            .single();

                        if (profileData) {
                            let currentTotal = profileData.total_completed_tasks || 0;
                            let newTotal = isCompleted ? currentTotal + 1 : Math.max(0, currentTotal - 1);

                            await supabase
                                .from('profiles')
                                .update({ total_completed_tasks: newTotal })
                                .eq('id', userId);
                        }
                    }

                    if (typeof onDataChangeCallback === 'function') {
                        onDataChangeCallback();
                    }

                } catch (err) {
                    console.error("Erreur lors de la mise à jour du statut :", err.message);
                    checkbox.checked = !isCompleted;
                    taskItem.classList.toggle('completed', !isCompleted);
                } finally {
                    setTimeout(() => { isUpdating = false; }, 300);
                }
            }

            // 2. Supprimer
            if (e.target.closest('.delete-task-btn')) {
                if (confirm("Supprimer cette tâche ?")) {
                    try {
                        const { error } = await supabase.from('tasks').delete().eq('id', taskId);
                        if (error) throw error;
                        if (typeof onDataChangeCallback === 'function') onDataChangeCallback();
                    } catch (err) {
                        console.error("Erreur lors de la suppression :", err.message);
                    }
                }
            }

            // 3. Modifier
            if (e.target.closest('.edit-task-btn')) {
                try {
                    const { data: taskData, error } = await supabase.from('tasks').select('*').eq('id', taskId).single();
                    if (error) throw error;
                    if (!taskData) return;

                    editingTaskId = taskId;
                    if (modalTitle) modalTitle.textContent = "Modifier la tâche";
                    if (submitBtn) submitBtn.textContent = "Enregistrer les modifications";

                    if (titleInput) titleInput.value = taskData.title || '';
                    if (dateInput) dateInput.value = taskData.due_date || '';

                    // Charger les paramètres de récurrence existants dans le formulaire
                    resetFormUI(
                        taskData.task_type || 'dated', 
                        taskData.category || 'school',
                        taskData.recurrence_type || 'daily',
                        taskData.recurrence_days || []
                    );

                    if (modal) modal.style.display = 'flex';
                } catch (err) {
                    console.error("Erreur lors de la modification :", err.message);
                }
            }
        });
    }
}