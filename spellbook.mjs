// Генератор книги заклинаний: node spellbook.mjs → spellbook.md
// Зеркалит правила magic.js — при изменении движка обновляйте и его.
import { writeFileSync } from 'node:fs';

const E = { fire:'🔥', water:'💧', air:'💨', earth:'🪨', beam:'⚡', ice:'❄', shield:'🛡', light:'☀', dark:'🌑' };
const IDS = Object.keys(E);
const CONFLICTS = [['fire','water'],['fire','ice'],['light','dark']];

function* multisets(k, start = 0, cur = []) {
  if (cur.length === k) { yield [...cur]; return; }
  for (let i = start; i < IDS.length; i++) {
    cur.push(IDS[i]);
    yield* multisets(k, i, cur);
    cur.pop();
  }
}

function describe(els) {
  const n = id => els.filter(x => x === id).length;
  const len = els.length;
  const fx = () => [
    n('fire') && `горение ${n('fire')}/с (3с)`,
    n('ice') && (n('ice') >= 3 ? 'заморозка 1.5с' : 'замедление 4с'),
    n('dark') && `проклятие ${6 + 2 * n('dark')}с`,
  ].filter(Boolean).join(', ');

  if (n('shield')) {
    if (n('dark'))  return ['Мина', `урон ${8 + 2 * n('dark')}, радиус ${(2 + 0.4 * len).toFixed(1)}, живёт 60с`];
    if (n('earth')) return ['Каменная стена', `${Math.min(5, 1 + len)}×3 перед собой`];
    if (n('air'))   return ['Нова', `отброс ${10 + 2 * len} в радиусе 6`];
    if (n('ice'))   return ['Каменная кожа', `+${3 * len} брони на 8с`];
    return ['Барьер', `поглощает ${3 * len} урона, 10с`];
  }
  if (n('air') && n('dark'))  return ['Телепорт', `${8 + 3 * n('air')} блоков по взгляду`];
  if (n('air') && n('light')) return ['Левитация', `${4 + 2 * n('air')}с (Space/Shift — вверх/вниз)`];
  if (n('beam') && n('fire') && n('earth'))
    return ['Метеорит', `с неба в точку прицела, взрыв R${(3 + 0.5 * n('earth')).toFixed(1)}, урон ${14 + 2 * len}`];
  if (n('beam')) {
    if (n('light') && n('light') * 2 >= len)
      return ['Луч лечения', `+${3 * n('light')} HP цели, снимает дебаффы`];
    const d = 2 + 2 * n('fire') + 2 * n('earth') + n('ice') + n('dark') + n('water');
    return ['Луч', `хитскан 40 блоков, урон ${d}${fx() ? '; ' + fx() : ''}`];
  }
  if (n('light') && n('light') * 2 >= len)
    return ['Самолечение', `+${3 * n('light') + len} HP, снимает дебаффы`];
  if (n('air') && n('air') * 2 >= len)
    return ['Ускорение', `×1.6 на ${3 + 2 * n('air')}с`];
  const dmg = 3 * n('fire') + 4 * n('earth') + 2 * n('ice') + 2 * n('dark') + n('water') + n('air') + 2 * n('light');
  if (n('fire') && n('earth'))
    return ['Взрывной снаряд', `AoE R${(1.5 + 0.6 * (n('fire') + n('earth'))).toFixed(1)}, разрушает блоки, урон до ${dmg}${fx() ? '; ' + fx() : ''}`];
  return ['Снаряд', `урон ${dmg}, отброс ${6 + 3 * n('water') + 2 * n('air')}${n('earth') ? ', летит по дуге' : ''}${fx() ? '; ' + fx() : ''}`];
}

const rows = [];
for (let k = 1; k <= 5; k++)
  for (const els of multisets(k)) {
    if (CONFLICTS.some(([a, b]) => els.includes(a) && els.includes(b))) continue;
    const [cat, desc] = describe(els);
    rows.push({ icons: els.map(e => E[e]).join(' '), cat, desc, mana: els.length * 2 });
  }

let md = `# Книга заклинаний — ${rows.length} комбинаций\n`;
for (const c of [...new Set(rows.map(r => r.cat))]) {
  const list = rows.filter(r => r.cat === c);
  md += `\n## ${c} — ${list.length} вариантов\n\n| Комбо | Мана | Эффект |\n|---|---|---|\n`;
  for (const r of list) md += `| ${r.icons} | ${r.mana} | ${r.desc} |\n`;
}
writeFileSync('spellbook.md', md);
console.log(`Сгенерировано ${rows.length} комбинаций → spellbook.md`);