(() => {
  'use strict';

  // Horario: 0 = domingo. [apertura, cierre] en minutos.
  const HOURS = { 2: [600, 1230], 3: [600, 1230], 4: [600, 1230], 5: [600, 1230], 6: [570, 900] };
  const DAY_NAMES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (min) => `${Math.floor(min / 60)}:${pad(min % 60)}`;
  const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // Ocupación simulada y estable por día/hora para que la demo parezca real.
  const isTaken = (date, min) => {
    let h = 0;
    const s = dayKey(date) + min;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 100 < 38;
  };

  const slotsFor = (date) => {
    const range = HOURS[date.getDay()];
    if (!range) return [];
    const now = new Date();
    const isToday = dayKey(date) === dayKey(now);
    const nowMin = now.getHours() * 60 + now.getMinutes() + 45;
    const out = [];
    for (let m = range[0]; m <= range[1] - 30; m += 30) {
      out.push({ min: m, taken: (isToday && m < nowMin) || isTaken(date, m) });
    }
    return out;
  };

  const openDays = (count) => {
    const days = [];
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    while (days.length < count) {
      if (slotsFor(d).some((s) => !s.taken)) days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  };

  // Próximo hueco libre
  const nextSlotText = () => {
    const first = openDays(1)[0];
    const slot = slotsFor(first).find((s) => !s.taken);
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    let label;
    if (dayKey(first) === dayKey(today)) label = 'hoy';
    else if (dayKey(first) === dayKey(tomorrow)) label = 'mañana';
    else label = `el ${DAY_NAMES[first.getDay()]} ${first.getDate()}`;
    return `Próximo hueco: ${label} a las ${fmt(slot.min)}`;
  };
  document.querySelectorAll('[data-next-slot]').forEach((el) => { el.textContent = nextSlotText(); });
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  // Header sólido al hacer scroll + barra de reserva móvil
  const header = document.querySelector('[data-header]');
  const mobileCta = document.querySelector('[data-mobile-cta]');
  const closing = document.querySelector('[data-closing]');
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-solid', y > 40);
    const nearEnd = closing && closing.getBoundingClientRect().top < window.innerHeight * 0.6;
    mobileCta.classList.toggle('is-visible', y > window.innerHeight * 0.8 && !nearEnd);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Cierre: carga el vídeo al acercarse y lanza la animación al entrar
  if ('IntersectionObserver' in window && closing) {
    const video = closing.querySelector('[data-lazy-video]');
    const loader = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      video.querySelectorAll('source[data-src]').forEach((s) => { s.src = s.dataset.src; });
      video.load();
      video.play().catch(() => {});
      loader.disconnect();
    }, { rootMargin: '400px' });
    loader.observe(closing);

    const reveal = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { closing.classList.add('is-in'); reveal.disconnect(); }
    }, { threshold: 0.35 });
    reveal.observe(closing);
  } else if (closing) {
    closing.classList.add('is-in');
  }

  // ---------- Mazo de cortes ----------
  const deck = document.querySelector('[data-deck]');
  if (deck) {
    const cards = Array.from(deck.querySelectorAll('[data-card]'));
    const currentEl = document.querySelector('[data-deck-current]');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let order = cards.map((_, i) => i);
    let busy = false;
    document.querySelector('[data-deck-total]').textContent = cards.length;

    // Posición de cada carta en el mazo: 0 arriba, el resto asomando detrás.
    const STACK = [
      'translate3d(0, 0, 0) rotate(0deg) scale(1)',
      'translate3d(18px, -16px, 0) rotate(4deg) scale(.96)',
      'translate3d(-16px, -28px, 0) rotate(-3.5deg) scale(.92)',
    ];

    const layout = () => {
      order.forEach((cardIndex, pos) => {
        const card = cards[cardIndex];
        card.dataset.pos = pos;
        card.style.zIndex = String(cards.length - pos);
        card.style.transform = STACK[Math.min(pos, STACK.length - 1)];
        card.style.opacity = pos < STACK.length ? '1' : '0';
        const hidden = pos !== 0;
        card.setAttribute('aria-hidden', String(hidden));
        card.inert = hidden;
      });
      currentEl.textContent = order[0] + 1;
    };

    const fling = (dir) => {
      if (busy) return;
      busy = true;
      const top = cards[order[0]];
      top.classList.remove('is-dragging');
      top.style.transform = `translate3d(${dir * 130}%, -40px, 0) rotate(${dir * 18}deg)`;
      top.style.opacity = '0';
      setTimeout(() => {
        order.push(order.shift());
        // la carta que sale va al fondo sin animar su vuelta
        top.style.transition = 'none';
        layout();
        top.getBoundingClientRect();
        top.style.transition = '';
        busy = false;
      }, reduced ? 0 : 380);
    };

    const back = () => {
      if (busy) return;
      busy = true;
      const last = cards[order[order.length - 1]];
      last.style.transition = 'none';
      last.style.transform = 'translate3d(-130%, -40px, 0) rotate(-18deg)';
      last.style.opacity = '0';
      last.style.zIndex = String(cards.length + 1);
      last.getBoundingClientRect();
      last.style.transition = '';
      order.unshift(order.pop());
      layout();
      setTimeout(() => { busy = false; }, reduced ? 0 : 380);
    };

    document.querySelector('[data-deck-next]').addEventListener('click', () => fling(1));
    document.querySelector('[data-deck-prev]').addEventListener('click', back);
    deck.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); fling(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    });

    // Arrastre con dedo o ratón sobre la carta de arriba
    let startX = 0, startY = 0, dx = 0, startT = 0, dragging = false, decided = false;
    deck.addEventListener('pointerdown', (e) => {
      const card = e.target.closest('[data-card]');
      if (busy || !card || card.dataset.pos !== '0') return;
      dragging = true; decided = false; dx = 0;
      startX = e.clientX; startY = e.clientY; startT = performance.now();
    });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const mx = e.clientX - startX, my = e.clientY - startY;
      if (!decided) {
        if (Math.abs(mx) < 6 && Math.abs(my) < 6) return;
        decided = true;
        // Si el gesto es vertical, dejamos que la página haga scroll.
        if (Math.abs(my) > Math.abs(mx)) { dragging = false; return; }
        cards[order[0]].classList.add('is-dragging');
      }
      dx = mx;
      cards[order[0]].style.transform = `translate3d(${dx}px, ${Math.abs(dx) * -0.06}px, 0) rotate(${dx / 18}deg)`;
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      const top = cards[order[0]];
      if (!decided) return;
      const velocity = Math.abs(dx) / Math.max(1, performance.now() - startT);
      if (Math.abs(dx) > deck.offsetWidth * 0.28 || velocity > 0.6) {
        fling(dx > 0 ? 1 : -1);
      } else {
        top.classList.remove('is-dragging');
        layout();
      }
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);

    layout();
  }

  // ---------- Reserva ----------
  const dialog = document.getElementById('booking');
  const form = dialog.querySelector('[data-booking-form]');
  const done = dialog.querySelector('[data-done]');
  const daysBox = dialog.querySelector('[data-days]');
  const slotsBox = dialog.querySelector('[data-slots]');
  const errorBox = dialog.querySelector('[data-error]');
  let lastTrigger = null;

  const chip = (container, name, value, content, disabled) => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio'; input.name = name; input.value = value; input.disabled = !!disabled;
    const span = document.createElement('span');
    content.forEach((node) => span.append(node));
    label.append(input, span);
    container.append(label);
    return input;
  };

  const renderSlots = (date) => {
    slotsBox.replaceChildren();
    const slots = slotsFor(date);
    let firstFree = null;
    slots.forEach((s) => {
      const input = chip(slotsBox, 'time', fmt(s.min), [fmt(s.min)], s.taken);
      if (!s.taken && !firstFree) firstFree = input;
    });
    if (firstFree) firstFree.checked = true;
  };

  const renderDays = () => {
    daysBox.replaceChildren();
    openDays(6).forEach((d, i) => {
      const small = document.createElement('small'); small.textContent = DAY_NAMES[d.getDay()];
      const b = document.createElement('b'); b.textContent = d.getDate();
      const month = document.createElement('small'); month.textContent = MONTHS[d.getMonth()];
      const input = chip(daysBox, 'day', dayKey(d), [small, b, month]);
      input.dataset.label = `${DAY_NAMES[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
      input.addEventListener('change', () => renderSlots(d));
      if (i === 0) { input.checked = true; renderSlots(d); }
    });
  };

  const openBooking = (trigger) => {
    lastTrigger = trigger;
    form.hidden = false; done.hidden = true; errorBox.textContent = '';
    renderDays();
    const service = trigger && trigger.dataset.service;
    if (service) form.elements.namedItem('service').value = service;
    const barber = (trigger && trigger.dataset.barber) || 'Cualquiera';
    const radio = form.querySelector(`input[name="barber"][value="${barber}"]`);
    if (radio) radio.checked = true;
    dialog.showModal();
  };

  const closeBooking = () => {
    dialog.close();
    if (lastTrigger) lastTrigger.focus();
  };

  document.querySelectorAll('[data-book]').forEach((btn) => btn.addEventListener('click', () => openBooking(btn)));
  dialog.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', closeBooking));
  dialog.addEventListener('click', (e) => { if (e.target === dialog) closeBooking(); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const phone = String(data.get('phone') || '').trim();
    if (!data.get('time')) { errorBox.textContent = 'Ese día no quedan horas libres. Elige otro día.'; return; }
    if (name.length < 2) { errorBox.textContent = 'Escribe tu nombre para la reserva.'; form.elements.namedItem('name').focus(); return; }
    if (!/^[0-9 +]{9,15}$/.test(phone)) { errorBox.textContent = 'Revisa el teléfono: necesitamos al menos 9 cifras.'; form.elements.namedItem('phone').focus(); return; }

    const dayInput = form.querySelector('input[name="day"]:checked');
    const barber = data.get('barber');
    const who = barber === 'Cualquiera' ? 'el primer barbero libre' : barber;
    dialog.querySelector('[data-summary]').textContent =
      `${name.split(' ')[0]}, te esperamos el ${dayInput.dataset.label} a las ${data.get('time')} con ${who}. Servicio: ${data.get('service')}.`;
    form.hidden = true; done.hidden = false;
    form.reset();
  });
})();
