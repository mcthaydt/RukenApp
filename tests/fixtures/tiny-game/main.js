// A game as a maker would write it, as small as it can be. It shows the page that it loaded, and writes down
// everything it can see of the page that holds it, so a journey can check that a game learns nothing about a person.
document.body.dataset.loaded = "yes";

const seen = document.getElementById("seen");
if (seen !== null) {
  seen.textContent = JSON.stringify({
    referrer: document.referrer,
    search: location.search,
    hash: location.hash,
    name: window.name,
    cookie: document.cookie,
    path: location.pathname,
  });
}
