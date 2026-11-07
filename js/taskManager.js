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

    let editingTaskId = null;
    let selectedTaskType = 'dated'; 
    let selectedCategory = 'school'; 
    let isUpdating = false;

    // --- GESTION DE LA MODALE ---
    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
            editingTaskId = null;
            if (modalTitle) modalTitle.textContent = "Nouvelle tâche";
            if (submitBtn) submitBtn.textContent = "Ajouter la tâche";
            if (addTaskForm) addTaskForm.reset();
            if (dateInput) dateInput.value = getTodayDate();
            resetFormUI('dated', 'school');
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

    function resetFormUI(type, category) {
        selectedTaskType = type;
        selectedCategory = category;

        document.querySelectorAll('.toggle-btn').forEach(b => {
            const when = b.getAttribute('data-when');
            const targetWhen = (type === 'dated' ? 'specific' : 'flexible');
            b.classList.toggle('active', when === targetWhen);
        });

        if (dateContainer) {
            dateContainer.style.display = (type === 'flexible') ? 'none' : 'block';
        }

        document.querySelectorAll('.category-btn').forEach(b => {
            const catAttr = b.getAttribute('data-category');
            const targetCat = (category === 'personal' ? 'perso' : 'school');
            b.classList.toggle('active', catAttr === targetCat);
        });
    }

    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const when = btn.getAttribute('data-when');
            selectedTaskType = (when === 'specific') ? 'dated' : 'flexible';
            if (dateContainer) {
                dateContainer.style.display = (selectedTaskType === 'flexible') ? 'none' : 'block';
            }
        });
    });

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

            try {
                if (editingTaskId) {
                    const { error } = await supabase.from('tasks').update({
                        title: taskTitle,
                        task_type: selectedTaskType,
                        due_date: dueDate || null,
                        category: selectedCategory
                    }).eq('id', editingTaskId);
                    if (error) throw error;
                } else {
                    const { error } = await supabase.from('tasks').insert([{
                        user_id: userId,
                        title: taskTitle,
                        task_type: selectedTaskType,
                        due_date: dueDate || null,
                        status: 'pending',
                        category: selectedCategory
                    }]);
                    if (error) throw error;
                }

                closeModal();

                let targetTab = 'today';
                if (selectedTaskType === 'flexible') {
                    targetTab = 'flexible';
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

    // --- ACTIONS SUR LES TÂCHES ---
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

                    resetFormUI(taskData.task_type || 'dated', taskData.category || 'school');
                    if (modal) modal.style.display = 'flex';
                } catch (err) {
                    console.error("Erreur lors de la modification :", err.message);
                }
            }
        });
    }
}