export function getTodayDate() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function isGoalReachedToday(completedTasks) {
    if(completedTasks>=2) {
        return true;
    }
    return false;
}
