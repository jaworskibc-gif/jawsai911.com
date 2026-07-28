(function () {
  if (sessionStorage.getItem('jaw_auth')) return;
  sessionStorage.setItem('jaw_return', location.href);
  location.replace('/login.html');
})();
