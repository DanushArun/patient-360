/** @param {{ day: string, chairs: object[] }[]} groups @returns {string[]} */
export function getAvailableVisitDates(groups) {
  return [...new Set(groups.map(({ day }) => day))].sort();
}

/** @param {{ day: string, chairs: object[] }[]} groups @param {string} selectedDate
 * @param {string} query @returns {object[]} */
export function filterDayCareVisits(groups, selectedDate, query) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return groups.filter(({ day }) => selectedDate === "all" || day === selectedDate)
    .sort((left, right) => left.day.localeCompare(right.day))
    .flatMap(({ chairs }) => chairs)
    .filter((chair) => !normalizedQuery || matchesVisit(chair, normalizedQuery));
}

/** @param {object} chair @param {string} query @returns {boolean} */
function matchesVisit(chair, query) {
  return [chair.name, chair.patientId, chair.place, chair.regimen, chair.headlineRule,
    chair.headline, chair.status]
    .some((value) => String(value ?? "").toLocaleLowerCase().includes(query));
}
