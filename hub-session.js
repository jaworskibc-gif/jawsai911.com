(function () {
  window.JAWSHubReady = (async function () {
    if (!window.supabase) await new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      script.onload = resolve; script.onerror = function () { reject(new Error('Sign-in service unavailable. Reload to retry.')); };
      document.head.appendChild(script);
    });
    const client = window.supabase.createClient('https://owkqfledeuetwwmlvnmb.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93a3FmbGVkZXVldHd3bWx2bm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxMzM5MTQsImV4cCI6MjEwMDcwOTkxNH0.lOwjIzs-DyVtvKR8-b1L6RTdlb8iY9_1chgKbY2ml3c');
    window.JAWSHubClient = client;
    return client;
  })();
  window.JAWSHubSignOut = async function () {
    document.documentElement.style.visibility = 'hidden';
    const client = await window.JAWSHubReady;
    await client.auth.signOut({scope:'local'});
    sessionStorage.removeItem('jaw_auth');
    sessionStorage.removeItem('jaw_return');
    location.replace('/login.html');
  };
})();
