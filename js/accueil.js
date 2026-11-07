import { initTasksModule } from './taskManager.js';
import { loadAccueilData } from './session.js';
import { startMidnightCountdown } from './countdown.js';

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('username-display')) {
        startMidnightCountdown();
        
        // On mémorise l'onglet actif globalement ici
        let currentActiveTab = 'today';

        const reloadCurrentTab = (forcedTab = null) => {
            if (forcedTab) {
                currentActiveTab = forcedTab;
            }

            const tabBtns = document.querySelectorAll('.tasks-tabs .tab-btn');
            tabBtns.forEach(btn => {
                const text = btn.textContent.trim().toLowerCase();
                btn.classList.remove('active');
                if (currentActiveTab === 'today' && text.includes("aujourd'hui")) btn.classList.add('active');
                if (currentActiveTab === 'upcoming' && text.includes("venir")) btn.classList.add('active');
                if (currentActiveTab === 'flexible' && text.includes("flexible")) btn.classList.add('active');
                if (currentActiveTab === 'completed' && text.includes("complété")) btn.classList.add('active');
            });

            loadAccueilData(currentActiveTab);
        };

        reloadCurrentTab('today');
        initTasksModule(reloadCurrentTab); 

        const tabBtns = document.querySelectorAll('.tasks-tabs .tab-btn');
        tabBtns.forEach((btn, index) => {
            if (btn.classList.contains('add-task-btn')) return;
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                if (index === 0) reloadCurrentTab('today');
                else if (index === 1) reloadCurrentTab('upcoming');
                else if (index === 2) reloadCurrentTab('flexible');
                else if (index === 3) reloadCurrentTab('completed');
            });
        });
    }
});