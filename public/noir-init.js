(function () {
  try {
    var p = location.pathname.replace(/^\/en(\/|$)/, '/');
    var pub = p === '/' || /^\/(booking|book|my-bookings|my-loyalty|reviews|shop|auction|repair-policy|about|privacy|shipping-policy|careers|track|partner|services|areas)(\/|$)/.test(p);
    if (pub) document.documentElement.classList.add('noir');
  } catch (e) {}
})();
