import { initTasksModule } from './taskManager.js';
import { loadAccueilData } from './session.js';
import { startMidnightCountdown } from './countdown.js';

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('username-display')) {
        startMidnightCountdown();
        
        const reloadCurrentTab = (forcedTab = null) => {
            let tabName = forcedTab;

            if (!tabName) {
                const activeBtn = document.querySelector('.tasks-tabs .tab-btn.active');
                tabName = 'today';
                
                if (activeBtn) {
                    const text = activeBtn.textContent.trim().toLowerCase();
                    if (text.includes('venir')) tabName = 'upcoming';
                    else if (text.includes('flexible')) tabName = 'flexible';
                    else if (text.includes('complété')) tabName = 'completed';
                }
            }

            const tabBtns = document.querySelectorAll('.tasks-tabs .tab-btn');
            tabBtns.forEach(btn => {
                const text = btn.textContent.trim().toLowerCase();
                btn.classList.remove('active');
                if (tabName === 'today' && text.includes("aujourd'hui")) btn.classList.add('active');
                if (tabName === 'upcoming' && text.includes("venir")) btn.classList.add('active');
                if (tabName === 'flexible' && text.includes("flexible")) btn.classList.add('active');
                if (tabName === 'completed' && text.includes("complété")) btn.classList.add('active');
            });

            loadAccueilData(tabName);
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