document.addEventListener('DOMContentLoaded', () => {
    const pinInputs = document.querySelectorAll('.pin-input');

    pinInputs.forEach((input, index) => {
        // Empêcher de taper autre chose que des chiffres
        input.addEventListener('keypress', (e) => {
            if (!/[0-9]/.test(e.key)) {
                e.preventDefault();
            }
        });

        // Gérer la saisie et le passage automatique au suivant
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            
            // Garder uniquement le dernier caractère si l'utilisateur en colle plusieurs
            if (value.length > 1) {
                e.target.value = value.slice(-1);
            }

            // Si un chiffre est entré et qu'il y a une case suivante, on focus
            if (e.target.value && index < pinInputs.length - 1) {
                pinInputs[index + 1].focus();
            }
        });

        // Gérer la touche Retour en arrière (Backspace) pour reculer
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace') {
                if (input.value === '' && index > 0) {
                    // Si la case est déjà vide, on recule et on efface la précédente
                    pinInputs[index - 1].focus();
                    pinInputs[index - 1].value = '';
                } else {
                    // Sinon on efface la case actuelle
                    input.value = '';
                }
            }
        });
    });
});