export function formatRank(index) {
  return index === 0 ? "1er" : `${index + 1}e`;
}

export function computeRankedMembers(rawMembers = []) {
  const sorted = [...rawMembers].sort(
    (a, b) =>
      b.completedTasks - a.completedTasks ||
      b.streak - a.streak ||
      a.name.localeCompare(b.name, "fr"),
  );

  let currentRankIndex = 0;

  return sorted.map((member, index) => {
    if (index > 0) {
      const prev = sorted[index - 1];
      const hasSameStats =
        prev.completedTasks === member.completedTasks &&
        prev.streak === member.streak;

      if (!hasSameStats) {
        currentRankIndex = index;
      }
    }

    return {
      ...member,
      rankIndex: currentRankIndex,
      rankLabel: formatRank(currentRankIndex),
    };
  });
}