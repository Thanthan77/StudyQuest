import { supabase } from './supabaseClient.js';

// Module gestion des tâches
export function initTasksModule(onDataChangeCallback) {
    const modal = document.getElementById('task-modal');
    const openModalBtn = document.querySelector('.add-task-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    const addTaskForm = document.getElementById('add-task-form');
    const tasksContainer = document.getElementById('tasks-container');
    
    const modalTitle = modal ? modal.querySelector('h2') : null;
    const submitBtn = addTaskForm ? addTaskForm.querySelector('.btn-primary') : null;
    
    // Références globales aux inputs du formulaire
    const titleInput = document.getElementById('task-title-input');
    const dateInput = document.getElementById('task-date-input');
    const dateContainer = document.getElementById('date-container');

    let editingTaskId = null;
    let selectedTaskType = 'dated'; 
    let selectedCategory = 'school'; 

    // Fonction pour obtenir la date du jour au format YYYY-MM-DD
    function getTodayDate() {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Gestion de l'ouverture du modal pour un AJOUT
    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
            editingTaskId = null; // Mode ajout
            if (modalTitle) modalTitle.textContent = "Nouvelle tâche";
            if (submitBtn) submitBtn.textContent = "Ajouter la tâche";
            if (addTaskForm) addTaskForm.reset();
            
            // Pré-remplir la date du jour par défaut
            if (dateInput) {
                dateInput.value = getTodayDate();
            }
            
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

    // Fonction utilitaire pour synchroniser les boutons toggle et catégorie
    function resetFormUI(type, category) {
        selectedTaskType = type;
        selectedCategory = category;

        // Boutons "Quand"
        const toggleBtns = document.querySelectorAll('.toggle-btn');
        toggleBtns.forEach(b => {
            const when = b.getAttribute('data-when');
            const targetWhen = (type === 'dated' ? 'specific' : 'flexible');
            if (when === targetWhen) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });

        if (dateContainer) {
            dateContainer.style.display = (type === 'flexible') ? 'none' : 'block';
        }

        // Boutons "Catégorie"
        const categoryBtns = document.querySelectorAll('.category-btn');
        categoryBtns.forEach(b => {
            const catAttr = b.getAttribute('data-category');
            const targetCat = (category === 'personal' ? 'perso' : 'school');
            if (catAttr === targetCat) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });
    }

    // Boutons "Un jour précis" / "Quand je veux"
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

    // Boutons de catégorie "École" / "Personnel"
    const categoryBtns = document.querySelectorAll('.category-btn');
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            categoryBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const cat = btn.getAttribute('data-category');
            selectedCategory = (cat === 'perso') ? 'personal' : 'school';
        });
    });

    // Soumission du formulaire (Gère AJOUT et MODIFICATION)
    if (addTaskForm) {
        addTaskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            let userId = null;
            const storedUser = localStorage.getItem('studyquest_user');
            if (storedUser) {
                userId = JSON.parse(storedUser).id;
            }

            if (!userId) {
                alert("Erreur : Aucun utilisateur connecté.");
                return;
            }

            const taskTitle = titleInput ? titleInput.value.trim() : '';
            const dueDate = selectedTaskType === 'dated' && dateInput ? dateInput.value : null;

            try {
                if (editingTaskId) {
                    // Mode Modification (UPDATE)
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
                    // Mode Ajout (INSERT)
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
                if (typeof onDataChangeCallback === 'function') onDataChangeCallback();

            } catch (err) {
                console.error("Erreur lors de l'enregistrement :", err.message);
                alert("Erreur : " + err.message);
            }
        });
    }

    // Action sur les tâches (cocher, supprimer, modifier)
    if (tasksContainer) {
        tasksContainer.addEventListener('click', async (e) => {
            const taskItem = e.target.closest('.task-item');
            if (!taskItem) return;
            
            const taskId = taskItem.getAttribute('data-id');

            // Terminer / Cocher
            if (e.target.closest('.task-check')) {
                const isCompleted = taskItem.classList.contains('completed');
                const newStatus = isCompleted ? 'pending' : 'completed';
                
                try {
                    const { error: taskError } = await supabase
                        .from('tasks')
                        .update({ status: newStatus })
                        .eq('id', taskId);

                    if (taskError) throw taskError;

                    taskItem.classList.toggle('completed', newStatus === 'completed');

                    let userId = null;
                    const storedUser = localStorage.getItem('studyquest_user');
                    if (storedUser) {
                        userId = JSON.parse(storedUser).id;
                    }

                    if (userId) {
                        const { data: profileData, error: profileFetchError } = await supabase
                            .from('profiles')
                            .select('total_completed_tasks')
                            .eq('id', userId)
                            .single();

                        if (!profileFetchError && profileData) {
                            let currentTotal = profileData.total_completed_tasks || 0;
                            let newTotal = newStatus === 'completed' 
                                ? currentTotal + 1 
                                : Math.max(0, currentTotal - 1);

                            const { error: profileUpdateError } = await supabase
                                .from('profiles')
                                .update({ total_completed_tasks: newTotal })
                                .eq('id', userId);

                            if (profileUpdateError) throw profileUpdateError;
                        }
                    }

                    const completedCount = document.querySelectorAll('.task-item.completed').length;
                    const box1 = document.getElementById('mini-box-1');
                    const box2 = document.getElementById('mini-box-2');

                    if (box1) {
                        if (completedCount >= 1) {
                            box1.classList.add('checked');
                            box1.innerHTML = '<i class="fa-solid fa-check"></i>';
                        } else {
                            box1.classList.remove('checked');
                            box1.innerHTML = '';
                        }
                    }

                    if (box2) {
                        if (completedCount >= 2) {
                            box2.classList.add('checked');
                            box2.innerHTML = '<i class="fa-solid fa-check"></i>';
                        } else {
                            box2.classList.remove('checked');
                            box2.innerHTML = '';
                        }
                    }

                    if (typeof onDataChangeCallback === 'function') onDataChangeCallback();

                } catch (err) {
                    console.error("Erreur lors de la mise à jour du statut ou du profil :", err.message);
                }
            }

            // Supprimer
            if (e.target.closest('.delete-task-btn')) {
                if (confirm("Supprimer cette tâche ?")) {
                    try {
                        const { error } = await supabase
                            .from('tasks')
                            .delete()
                            .eq('id', taskId);

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
                    const { data: taskData, error } = await supabase
                        .from('tasks')
                        .select('*')
                        .eq('id', taskId)
                        .single();

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
                    console.error("Erreur chargement tâche pour modification :", err.message);
                    alert("Impossible de charger les informations de la tâche.");
                }
            }
        });
    }
}