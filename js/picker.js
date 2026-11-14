// Exercise picker and the form for creating or editing an exercise.

import { chips, field } from './components.js';
import { MUSCLES } from './library.js';
import { MAX_NAME, cleanName } from './model.js';
import { addExercise, exerciseNameTaken, sortedExercises, updateExercise } from './store.js';
import { openSheet, toast } from './ui.js';
import { fold, h, icon, setChildren } from './util.js';

/**
 * Lets the user choose exercises. Resolves with an array of exercise ids in
 * the order they were tapped, or null when cancelled.
 */
export function pickExercises({ title = 'Übungen', multiple = true } = {}) {
  return new Promise((resolve) => {
    let query = '';
    let muscle = null;
    let result = null;
    const selected = new Set();

    const list = h('div', { class: 'list picker-list' });
    const confirmButton = h('button', {
      class: 'btn-text strong',
      disabled: true,
      onclick: () => {
        result = [...selected];
        sheet.close();
      },
    }, 'Hinzufügen');

    const syncConfirm = () => {
      confirmButton.disabled = selected.size === 0;
      confirmButton.textContent = selected.size ? `Hinzufügen (${selected.size})` : 'Hinzufügen';
    };

    const choose = (exercise, row) => {
      if (!multiple) {
        result = [exercise.id];
        sheet.close();
        return;
      }
      if (selected.has(exercise.id)) selected.delete(exercise.id);
      else selected.add(exercise.id);
      row.classList.toggle('selected', selected.has(exercise.id));
      row.setAttribute('aria-pressed', String(selected.has(exercise.id)));
      syncConfirm();
    };

    const create = async () => {
      const exercise = await exerciseForm({ name: cleanName(query), muscle });
      if (!exercise) return;
      if (!multiple) {
        result = [exercise.id];
        sheet.close();
        return;
      }
      selected.add(exercise.id);
      query = '';
      search.value = '';
      syncConfirm();
      draw();
    };

    const draw = () => {
      const needle = fold(query);
      const matches = sortedExercises()
        .filter((e) => (!muscle || e.muscle === muscle) && (!needle || fold(e.name).includes(needle)));
      setChildren(list,
        matches.map((exercise) => {
          const row = h('button', {
            class: `row${selected.has(exercise.id) ? ' selected' : ''}`,
            'aria-pressed': String(selected.has(exercise.id)),
            onclick: () => choose(exercise, row),
          },
            h('span', { class: 'row-main' },
              h('span', { class: 'row-title' }, exercise.name),
              h('span', { class: 'meta' }, exercise.muscle)),
            multiple && h('span', { class: 'tick', 'aria-hidden': 'true' }, icon('check', 16)));
          return row;
        }),
        !matches.length && h('p', { class: 'list-note' }, 'Keine passende Übung gefunden.'),
        h('button', { class: 'row row-create', onclick: create },
          icon('plus', 18),
          query.trim() ? `„${cleanName(query)}“ neu anlegen` : 'Neue Übung anlegen'),
      );
    };

    const search = h('input', {
      class: 'field search',
      type: 'text',
      inputmode: 'search',
      placeholder: 'Übung suchen',
      'aria-label': 'Übung suchen',
      autocomplete: 'off',
      enterkeyhint: 'search',
      oninput: (event) => {
        query = event.target.value;
        draw();
      },
    });

    const sheet = openSheet({
      title,
      variant: 'full',
      left: h('button', { class: 'btn-text', onclick: () => sheet.close() }, 'Abbrechen'),
      right: multiple && confirmButton,
      onClose: () => resolve(result),
      body: [
        h('div', { class: 'picker-tools' },
          search,
          chips({
            options: MUSCLES,
            value: muscle,
            allLabel: 'Alle',
            label: 'Muskelgruppe',
            onChange: (value) => {
              muscle = value;
              draw();
            },
          })),
        list,
      ],
    });
    draw();
  });
}

/**
 * Dialog to create an exercise, or edit the given one. Resolves with the saved
 * exercise, or null when cancelled.
 */
export function exerciseForm({ exercise = null, name = '', muscle = null } = {}) {
  return new Promise((resolve) => {
    let result = null;
    let chosen = exercise?.muscle ?? muscle ?? MUSCLES[0];
    const input = h('input', {
      class: 'field',
      type: 'text',
      value: exercise?.name ?? name,
      maxLength: MAX_NAME,
      placeholder: 'z. B. Bankdrücken (Maschine)',
      autocomplete: 'off',
      enterkeyhint: 'done',
      onkeydown: (event) => {
        if (event.key === 'Enter') submit();
      },
    });

    const submit = () => {
      const value = cleanName(input.value);
      if (!value) {
        toast('Gib der Übung einen Namen.');
        input.focus();
        return;
      }
      if (exerciseNameTaken(value, exercise?.id)) {
        toast('Eine Übung mit diesem Namen gibt es schon.');
        input.focus();
        return;
      }
      result = exercise
        ? updateExercise(exercise.id, { name: value, muscle: chosen })
        : addExercise({ name: value, muscle: chosen });
      sheet.close();
    };

    const sheet = openSheet({
      title: exercise ? 'Übung bearbeiten' : 'Neue Übung',
      variant: 'dialog',
      onClose: () => resolve(result),
      body: h('div', { class: 'stack' },
        field('Name', input),
        h('div', { class: 'form-field' },
          h('span', { class: 'form-label' }, 'Muskelgruppe'),
          chips({ options: MUSCLES, value: chosen, label: 'Muskelgruppe', onChange: (value) => { chosen = value; } })),
        h('button', { class: 'btn btn-primary btn-block', onclick: submit }, 'Speichern'),
        h('button', { class: 'action cancel', onclick: () => sheet.close() }, 'Abbrechen')),
    });
    input.focus();
  });
}
