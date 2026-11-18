(function () {
  document.documentElement.style.visibility = 'hidden';
  sessionStorage.removeItem('jaw_auth');
  function rejectAccess() {
    sessionStorage.setItem('jaw_return', location.pathname + location.search);
    location.replace('/login.html');
  }
  const script = document.createElement('script');
  script.src = '/hub-session.js';
  script.onerror = rejectAccess;
  script.onload = async function () {
    try {
      const client = await window.JAWSHubReady;
      const {data, error} = await client.auth.getUser();
      if (error || !data.user) return rejectAccess();
      const membership = await client.from('hub_team_members').select('role,active').eq('user_id', data.user.id).maybeSingle();
      if (membership.error || !membership.data || !membership.data.active) return rejectAccess();
      window.JAWSHubUser = data.user;
      document.documentElement.style.visibility = '';
      client.auth.onAuthStateChange(function (event) {
        if (event === 'SIGNED_OUT') rejectAccess();
      });
    } catch (_) { rejectAccess(); }
  };
  document.head.appendChild(script);
})();
