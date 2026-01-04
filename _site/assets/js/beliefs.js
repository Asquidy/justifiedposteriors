/**
 * Beliefs Table Interactivity
 * - Expand/collapse rows
 * - Search/filter functionality
 */

document.addEventListener('DOMContentLoaded', function() {
  // Expand/Collapse functionality
  const headers = document.querySelectorAll('.belief-row__header');

  headers.forEach(header => {
    header.addEventListener('click', function() {
      const content = this.nextElementSibling;
      const isExpanded = this.getAttribute('aria-expanded') === 'true';

      // Toggle state
      this.setAttribute('aria-expanded', !isExpanded);
      content.hidden = isExpanded;
    });
  });

  // Search/Filter functionality
  const searchInput = document.getElementById('beliefs-search');
  const rows = document.querySelectorAll('.belief-row');
  const noResults = document.getElementById('beliefs-no-results');

  if (searchInput) {
    searchInput.addEventListener('input', function() {
      const query = this.value.toLowerCase().trim();
      let visibleCount = 0;

      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const matches = query === '' || text.includes(query);

        row.classList.toggle('belief-row--hidden', !matches);
        if (matches) visibleCount++;
      });

      // Show/hide no results message
      if (noResults) {
        noResults.hidden = visibleCount > 0 || query === '';
      }
    });
  }
});
