import { supabase } from './supabaseClient.js';
// Module gestion des tâches
export function initTasksModule(onDataChangeCallback) {
    const modal = document.getElementById('task-modal');
    const openModalBtn = document.querySelector('.add-task-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    const addTaskForm = document.getElementById('add-task-form');
    const tasksContainer = document.getElementById('tasks-container');

    let selectedTaskType = 'dated'; 
    let selectedCategory = 'school'; 

    //  Gestion de l'ouverture et fermeture du modal
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

    // Boutons "Un jour précis" / "Quand je veux"
    const toggleBtns = document.querySelectorAll('.toggle-btn');
    const dateContainer = document.getElementById('date-container');

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

    //  Ajout d'une tâche via le formulaire
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

            const titleInput = document.getElementById('task-title-input');
            const dateInput = document.getElementById('task-date-input');

            const taskTitle = titleInput.value.trim();
            const dueDate = selectedTaskType === 'dated' ? dateInput.value : null;

            try {
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

                closeModal();
                if (typeof onDataChangeCallback === 'function') onDataChangeCallback();

            } catch (err) {
                console.error("Erreur lors de l'ajout :", err.message);
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
                    const { error } = await supabase
                        .from('tasks')
                        .update({ status: newStatus })
                        .eq('id', taskId);

                    if (error) throw error;
                    if (typeof onDataChangeCallback === 'function') onDataChangeCallback();
                } catch (err) {
                    console.error("Erreur mise à jour statut :", err.message);
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
                const titleSpan = taskItem.querySelector('.task-name');
                const newTitle = prompt("Modifier la tâche :", titleSpan ? titleSpan.textContent : '');

                if (newTitle !== null && newTitle.trim() !== "") {
                    try {
                        const { error } = await supabase
                            .from('tasks')
                            .update({ title: newTitle.trim() })
                            .eq('id', taskId);

                        if (error) throw error;
                        if (typeof onDataChangeCallback === 'function') onDataChangeCallback();
                    } catch (err) {
                        console.error("Erreur modification :", err.message);
                    }
                }
            }
        });
    }
}