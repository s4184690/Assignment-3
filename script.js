/* ==========================================================================
   DESIGN NOTES (about 500 words, as the brief requires)

   ACTION AND CONTEXT. I chose Drag for a commercial food site. Build-your-own
   ordering (Chipotle, Sweetgreen and Subway all work this way) is the moment
   where a customer decides what to buy, so a physical "put it in the bowl"
   gesture fits: it copies standing at a counter and pointing at ingredients.
   It also makes customising feel like play, which suits a fast-casual brand.

   WHY POINTER EVENTS, NOT HTML5 DRAG AND DROP. The native drag API has weak
   touch support and a fixed ghost image I cannot style. Pointer Events (MDN,
   "Pointer events") give one code path for mouse, pen and finger, and
   setPointerCapture keeps events flowing even if the cursor leaves the chip.
   Most food ordering happens on phones, so touch is not optional. The CSS
   touch-action:none on each chip stops the page scrolling during a drag.

   FEEDBACK. Nielsen's heuristic "visibility of system status" drives the
   feedback loop. (1) On pickup the chip is copied into a lifted, shadowed
   ghost so the user sees what they hold. (2) While the ghost is over the
   bowl, the bowl grows slightly and its border turns green: a clear "yes,
   you can drop here". (3) On drop, the ingredient pops into the bowl and the
   price, calories and count update straight away, because price is the main
   information a shopper wants. (4) A missed drop slides the ghost back to its
   chip, signalling "nothing happened" without an error message. (5) A full
   bowl shakes and a plain status line says why.

   USABILITY AND ACCESSIBILITY. Dragging is hard for some people, so WCAG 2.2
   success criterion 2.5.7 (Dragging Movements) requires a single-pointer
   alternative. Every chip is focusable and Enter or Space adds it, and bowl
   items can be removed by tap or key. Updates go to aria-live regions for
   screen readers. Focus rings are visible, text contrast is high, and
   prefers-reduced-motion switches the animations off. Large targets follow
   Fitts's law: bigger chips are quicker to hit, especially with a thumb.

   STYLE. Seafoam, teal, mango and chilli come from the ingredients, so the
   colours of the food carry the page and the layout stays quiet. Rockwell
   headings feel friendly and handmade; Gill Sans keeps the body clean.

   CODE ORIGIN. All code is written by me. No libraries are used. The
   ingredient names, prices and calories are invented placeholders.

   REFLECTION. Benefits: the interaction is small, fast to learn and gives
   instant price feedback, which could raise basket size. Challenges: in a
   full project the ingredient list would come from a menu database, prices
   and allergens must be accurate, and the drag needs testing on real phones,
   where scroll and drag gestures can conflict. Absolute positioning of the
   bowl items would need a better layout once portions vary in size. I would
   also track which items are dragged versus tapped, to see whether the
   alternative path matters to real customers.
   ========================================================================== */

const MAX = 5;
// Invented menu: name, short label, colour, kcal, price in dollars
const MENU = [
  {id:"rice",   name:"Sushi rice",    colour:"#f4efe0", kcal:200, price:2.0},
  {id:"salmon", name:"Salmon",        colour:"#f08a6c", kcal:180, price:5.5},
  {id:"tuna",   name:"Tuna",          colour:"#c2314a", kcal:150, price:5.5},
  {id:"tofu",   name:"Tofu",          colour:"#f7e7b0", kcal:90,  price:3.0},
  {id:"edamame",name:"Edamame",       colour:"#7fb83f", kcal:80,  price:1.5},
  {id:"avocado",name:"Avocado",       colour:"#9fc45a", kcal:120, price:2.0},
  {id:"mango",  name:"Mango",         colour:"#f2a900", kcal:60,  price:1.5},
  {id:"ginger", name:"Pickled ginger",colour:"#f3b6c0", kcal:10,  price:0.5}
];

const tray = document.getElementById("tray");
const bowl = document.getElementById("bowl");
const hint = document.getElementById("hint");
const status = document.getElementById("status");
let inBowl = []; // ids currently in the bowl, in order

// Build the tray from data so adding a menu item needs no extra markup.
MENU.forEach(m => {
  const chip = document.createElement("div");
  chip.className = "chip";
  chip.tabIndex = 0;
  chip.dataset.id = m.id;
  chip.setAttribute("role", "button");
  chip.innerHTML = `<span class="dot" style="background:${m.colour}"></span>
    <span><b>${m.name}</b><small>${m.kcal} kcal, $${m.price.toFixed(2)}</small></span>`;
  tray.appendChild(chip);
  chip.addEventListener("pointerdown", e => startDrag(e, chip, m));
  chip.addEventListener("keydown", e => {            // WCAG 2.5.7 alternative
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); add(m); }
  });
});

// Is the point (x, y) inside the round bowl? Distance from centre vs radius.
function overBowl(x, y) {
  const r = bowl.getBoundingClientRect();
  return Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) < r.width / 2;
}

function startDrag(e, chip, m) {
  if (e.button > 0) return;                          // ignore right/middle click
  e.preventDefault();
  chip.setPointerCapture(e.pointerId);
  const start = chip.getBoundingClientRect();
  const ghost = document.createElement("div");
  ghost.className = "ghost";
  ghost.style.background = m.colour;
  document.body.appendChild(ghost);
  const move = ev => {
    ghost.style.left = ev.clientX + "px";
    ghost.style.top = ev.clientY + "px";
    bowl.classList.toggle("ready", overBowl(ev.clientX, ev.clientY) && inBowl.length < MAX);
  };
  const end = ev => {
    chip.removeEventListener("pointermove", move);
    chip.removeEventListener("pointerup", end);
    chip.removeEventListener("pointercancel", end);
    bowl.classList.remove("ready");
    if (ev.type === "pointerup" && overBowl(ev.clientX, ev.clientY)) {
      ghost.remove();
      add(m);
    } else {                                          // missed: slide back, fade
      ghost.classList.add("back");
      ghost.style.left = start.left + 22 + "px";
      ghost.style.top = start.top + start.height / 2 + "px";
      setTimeout(() => ghost.remove(), 240);
    }
  };
  chip.addEventListener("pointermove", move);
  chip.addEventListener("pointerup", end);
  chip.addEventListener("pointercancel", end);
  move(e);
}

function add(m) {
  if (inBowl.includes(m.id)) { say(m.name + " is already in your bowl."); return; }
  if (inBowl.length >= MAX) {
    bowl.classList.remove("full"); void bowl.offsetWidth; bowl.classList.add("full");
    say("Your bowl is full. Remove an ingredient to add " + m.name + ".");
    return;
  }
  inBowl.push(m.id);
  say(m.name + " added.");
  render();
}

function remove(id) {
  inBowl = inBowl.filter(x => x !== id);
  say(MENU.find(m => m.id === id).name + " removed.");
  render();
}

// Place items on a ring inside the bowl, evenly spaced by index.
function render() {
  bowl.querySelectorAll(".item").forEach(n => n.remove());
  inBowl.forEach((id, i) => {
    const m = MENU.find(x => x.id === id);
    const a = (i / MAX) * Math.PI * 2 - Math.PI / 2;
    const n = document.createElement("div");
    n.className = "item";
    n.tabIndex = 0;
    n.setAttribute("role", "button");
    n.setAttribute("aria-label", "Remove " + m.name);
    n.style.cssText = `background:${m.colour};left:${50 + Math.cos(a) * 28}%;top:${50 + Math.sin(a) * 28}%`;
    n.textContent = m.name.split(" ")[0];
    n.addEventListener("click", () => remove(id));
    n.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); remove(id); } });
    bowl.appendChild(n);
  });
  tray.querySelectorAll(".chip").forEach(c => c.classList.toggle("used", inBowl.includes(c.dataset.id)));
  const items = inBowl.map(id => MENU.find(m => m.id === id));
  document.getElementById("price").textContent = "$" + items.reduce((s, m) => s + m.price, 0).toFixed(2);
  document.getElementById("kcal").textContent = items.reduce((s, m) => s + m.kcal, 0) + " kcal";
  document.getElementById("count").textContent = inBowl.length + " of " + MAX;
  document.getElementById("order").disabled = inBowl.length === 0;
  hint.style.display = inBowl.length ? "none" : "grid";
}

function say(t) { status.textContent = t; }

document.getElementById("reset").addEventListener("click", () => { inBowl = []; say("Bowl emptied."); render(); });
document.getElementById("order").addEventListener("click", () => say("Bowl added to your order."));
render();
