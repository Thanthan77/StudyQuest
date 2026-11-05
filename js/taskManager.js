import { supabase } from './supabaseClient.js';

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
    
    // Verrou anti-double-clic pour empêcher les incrémentation en double
    let isUpdating = false;

    function getTodayDate() {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

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

        const toggleBtns = document.querySelectorAll('.toggle-btn');
        toggleBtns.forEach(b => {
            const when = b.getAttribute('data-when');
            const targetWhen = (type === 'dated' ? 'specific' : 'flexible');
            if (when === targetWhen) b.classList.add('active');
            else b.classList.remove('active');
        });

        if (dateContainer) {
            dateContainer.style.display = (type === 'flexible') ? 'none' : 'block';
        }

        const categoryBtns = document.querySelectorAll('.category-btn');
        categoryBtns.forEach(b => {
            const catAttr = b.getAttribute('data-category');
            const targetCat = (category === 'personal' ? 'perso' : 'school');
            if (catAttr === targetCat) b.classList.add('active');
            else b.classList.remove('active');
        });
    }

    const toggleBtns = document.querySelectorAll('.toggle-btn');
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            toggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const when = btn.getAttribute('data-when');
            selectedTaskType = (when === 'specific') ? 'dated' : 'flexible';
            if (dateContainer) {
                dateContainer.style.display = (selectedTaskType === 'flexible') ? 'none' : 'block';
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
            
            let userId = null;
            const storedUser = localStorage.getItem('studyquest_user');
            if (storedUser) userId = JSON.parse(storedUser).id;

            if (!userId) {
                alert("Erreur : Aucun utilisateur connecté.");
                return;
            }

            const taskTitle = titleInput ? titleInput.value.trim() : '';
            const dueDate = selectedTaskType === 'dated' && dateInput ? dateInput.value : null;

            try {
                if (editingTaskId) {
                    const { error } = await supabase
                        .from('tasks')
                        .update({
                            title: taskTitle,
                            task_type: selectedTaskType,
                            due_date: dueDate || null,
                            category: selectedCategory
                        })
                        .eq('id', editingTaskId);
                    if (error) throw error;
                } else {
                    const { error } = await supabase
                        .from('tasks')
                        .insert([{
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
                // On détermine sur quel onglet se placer après l'ajout
                let targetTab = 'today';
                if (selectedTaskType === 'flexible') {
                    targetTab = 'flexible';
                } else if (dueDate) {
                    const todayStr = new Date().toISOString().split('T')[0];
                    if (dueDate > todayStr) targetTab = 'upcoming';
                }

                if (typeof onDataChangeCallback === 'function') {
                    onDataChangeCallback(targetTab);
                }

            } catch (err) {
                console.error("Erreur lors de l'enregistrement :", err.message);
                alert("Erreur : " + err.message);
            }
        });
    }

    if (tasksContainer) {
        tasksContainer.addEventListener('click', async (e) => {
            const taskItem = e.target.closest('.task-item');
            if (!taskItem) return;
            
            const taskId = taskItem.getAttribute('data-id');

            // Terminer / Cocher via la case native
            const checkbox = e.target.closest('.native-task-checkbox');
            if (checkbox) {
                if (isUpdating) return;
                isUpdating = true;

                const isCompleted = checkbox.checked;
                const newStatus = isCompleted ? 'completed' : 'pending';
                
                taskItem.classList.toggle('completed', isCompleted);
                
                try {
                    const completedAtValue = isCompleted ? new Date().toISOString() : null;

                    // 1. Mettre à jour le statut de la tâche
                    const { error: taskError } = await supabase
                        .from('tasks')
                        .update({ 
                            status: newStatus,
                            completed_at: completedAtValue 
                        })
                        .eq('id', taskId);

                    if (taskError) throw taskError;

                    // 2. Mettre à jour le profil (total_completed_tasks) en une seule opération sécurisée
                    let userId = null;
                    const storedUser = localStorage.getItem('studyquest_user');
                    if (storedUser) userId = JSON.parse(storedUser).id;

                    if (userId) {
                        const { data: profileData } = await supabase
                            .from('profiles')
                            .select('total_completed_tasks')
                            .eq('id', userId)
                            .single();

                        if (profileData) {
                            let currentTotal = profileData.total_completed_tasks || 0;
                            // On sécurise pour ne pas dépasser ou descendre sous 0
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
                    console.error("Erreur mise à jour statut :", err.message);
                    checkbox.checked = !isCompleted;
                    taskItem.classList.toggle('completed', !isCompleted);
                } finally {
                    // On laisse un léger délai avant de libérer le verrou pour absorber les double-clics du navigateur
                    setTimeout(() => {
                        isUpdating = false;
                    }, 300);
                }
            }

            // Supprimer
            if (e.target.closest('.delete-task-btn')) {
                if (confirm("Supprimer cette tâche ?")) {
                    try {
                        const { error } = await supabase.from('tasks').delete().eq('id', taskId);
                        if (error) throw error;
                        if (typeof onDataChangeCallback === 'function') onDataChangeCallback();
                    } catch (err) {
                        console.error("Erreur suppression :", err.message);
                    }
                }
            }

            // Modifier 
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
                    console.error("Erreur modification :", err.message);
                }
            }
        });
    }
}