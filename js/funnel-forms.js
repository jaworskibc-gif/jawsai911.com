/* Intentionally fail closed until the existing CRM/calendar service is verified.
   No public CRM writes, alternate database, local lead storage, or email fallback. */
document.querySelectorAll('.funnel-form').forEach(function(form) {
  form.addEventListener('submit', function(event) {
    event.preventDefault();
    document.getElementById('booking-status').focus();
  });
});
