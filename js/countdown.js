export function startMidnightCountdown() {
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