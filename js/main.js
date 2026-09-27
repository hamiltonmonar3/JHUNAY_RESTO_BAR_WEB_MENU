const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#site-navigation');
const currentYear = document.querySelector('#current-year');

if (menuToggle && navigation) {
  menuToggle.addEventListener('click', () => {
    const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!isOpen));
    navigation.classList.toggle('is-open', !isOpen);
  });

  navigation.addEventListener('click', (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      menuToggle.setAttribute('aria-expanded', 'false');
      navigation.classList.remove('is-open');
    }
  });
}

if (currentYear) {
  currentYear.textContent = String(new Date().getFullYear());
}
