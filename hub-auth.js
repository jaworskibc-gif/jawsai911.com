(function () {
  if (sessionStorage.getItem('jaw_auth')) return;
  sessionStorage.setItem('jaw_return', location.href);
  var loginPath = location.pathname.indexOf('/toolkit/') !== -1 ? '../login.html' : 'login.html';
  location.replace(loginPath);
})();
